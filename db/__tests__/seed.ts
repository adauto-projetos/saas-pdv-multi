import { eq } from "drizzle-orm";
import postgres from "postgres";

import { db } from "@/db";
import { hashPassword } from "@/lib/auth/password";
import {
  cashMovements,
  cashSessions,
  comandaItems,
  comandas,
  customers,
  payables,
  products,
  receivables,
  tenantMembers,
  tenants,
  userPermissions,
  users,
} from "@/db/schema";
import type { PermissionCode } from "@/lib/validation/usuarios";
import type { ProductUnit } from "@/types/product";

/**
 * Helpers para os testes de integração/RLS. Local: basta o Postgres do Docker
 * (DATABASE_URL). Sem Supabase/service-role — os usuários são criados direto na
 * tabela `users` (o hash não importa: os testes não fazem login de verdade).
 */
export const HAS_DB = !!process.env.DATABASE_URL;
// Compat com os testes existentes: agora "auth" = ter o banco local.
export const HAS_AUTH = HAS_DB;

export async function createTestUser(): Promise<{
  userId: string;
  email: string;
}> {
  const email = `pdv-test+${Date.now()}-${Math.floor(
    Math.random() * 1_000_000,
  )}@example.com`;
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: "test-hash" })
    .returning({ id: users.id });
  return { userId: user.id, email };
}

export async function deleteTestUser(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

/** Grava uma senha bcrypt real para o usuário (testes de override/login). */
export async function setUserPassword(
  userId: string,
  plain: string,
): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(plain) })
    .where(eq(users.id, userId));
}

export async function seedTenant(
  userId: string,
  name = "Loja Teste",
  defaultMarkupPercent = "30.00",
): Promise<string> {
  const [tenant] = await db
    .insert(tenants)
    .values({ name, defaultMarkupPercent })
    .returning({ id: tenants.id });
  await db
    .insert(tenantMembers)
    .values({ tenantId: tenant.id, userId, role: "owner" });
  return tenant.id;
}

/** Remove o tenant (cascade apaga members, products, sales e sale_items). */
export async function cleanupTenant(tenantId: string): Promise<void> {
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}

/**
 * Serializa seções de teste que mutam o singleton GLOBAL `platform_settings`
 * (ex.: `max_operators`) entre arquivos de teste que rodam em paralelo (workers).
 *
 * Usa um advisory lock de SESSÃO numa conexão DEDICADA (fora do pool do `db`):
 * assim segurar o lock não consome um slot do pool — `fn` pode abrir suas próprias
 * transações (ex.: `createOperator`) sem risco de deadlock por exaustão de
 * conexões. Serializa entre processos via lock no Postgres.
 */
export async function withGlobalSettingsLock<T>(
  fn: () => Promise<T>,
): Promise<T> {
  const url = process.env.DATABASE_URL ?? "";
  const lockClient = postgres(url, { max: 1, prepare: false });
  try {
    await lockClient`select pg_advisory_lock(914003)`;
    return await fn();
  } finally {
    await lockClient`select pg_advisory_unlock(914003)`;
    await lockClient.end();
  }
}

// ---------------------------------------------------------------------------
// Operadores + permissões seed helpers (0014F/SF01). Owner `db` (bypassa RLS).
// ---------------------------------------------------------------------------

/**
 * Cria um operador (usuário + vínculo `operator`) no tenant, com permissões
 * opcionais. Retorna o userId/email. Bypassa RLS — correto para semear teste.
 */
export async function seedOperator(
  tenantId: string,
  opts: {
    permissions?: PermissionCode[];
    isActive?: boolean;
    name?: string;
    /** Senha em texto puro; se dada, gravada como bcrypt (testes de override). */
    password?: string;
  } = {},
): Promise<{ userId: string; email: string }> {
  const { userId, email } = await createTestUser();
  if (opts.password) await setUserPassword(userId, opts.password);
  if (opts.name) {
    await db.update(users).set({ name: opts.name }).where(eq(users.id, userId));
  }
  await db.insert(tenantMembers).values({
    tenantId,
    userId,
    role: "operator",
    isActive: opts.isActive ?? true,
  });
  if (opts.permissions && opts.permissions.length > 0) {
    await db.insert(userPermissions).values(
      opts.permissions.map((code) => ({
        tenantId,
        userId,
        permissionCode: code,
        grantedBy: null,
      })),
    );
  }
  return { userId, email };
}

export async function seedProduct(
  tenantId: string,
  opts: {
    name?: string;
    unit?: ProductUnit;
    salePriceCents?: number;
    stockQuantity?: number;
    minStock?: number | null;
    barcode?: string | null;
    costCents?: number | null;
  } = {},
): Promise<string> {
  const [product] = await db
    .insert(products)
    .values({
      tenantId,
      name: opts.name ?? "Produto Teste",
      unit: opts.unit ?? "un",
      salePriceCents: opts.salePriceCents ?? 1000,
      stockQuantity: (opts.stockQuantity ?? 0).toString(),
      minStock: opts.minStock != null ? opts.minStock.toString() : null,
      priceIsManual: false,
      barcode: opts.barcode ?? null,
      costCents: opts.costCents ?? null,
    })
    .returning({ id: products.id });
  return product.id;
}

// ---------------------------------------------------------------------------
// Finance seed helpers (0004F). All inserts use the owner `db` connection —
// bypasses RLS intentionally (correct for seeding test data across tenants).
// Cascade via tenant_id removes all finance rows when cleanupTenant() is called.
// ---------------------------------------------------------------------------

/** Inserts a customer for the given tenant; returns the customer id. */
export async function seedCustomer(
  tenantId: string,
  name = "Cliente Teste",
  phone: string | null = null,
): Promise<string> {
  const [customer] = await db
    .insert(customers)
    .values({ tenantId, name, phone })
    .returning({ id: customers.id });
  return customer.id;
}

/** Inserts a receivable; returns the receivable id. */
export async function seedReceivable(
  tenantId: string,
  userId: string,
  opts: {
    customerId: string;
    totalCents: number;
    origin?: "venda" | "avulsa";
    dueDate?: string | null;
    saleId?: string | null;
    description?: string | null;
  },
): Promise<string> {
  const [receivable] = await db
    .insert(receivables)
    .values({
      tenantId,
      userId,
      customerId: opts.customerId,
      totalCents: opts.totalCents,
      origin: opts.origin ?? "avulsa",
      dueDate: opts.dueDate ?? null,
      saleId: opts.saleId ?? null,
      description: opts.description ?? null,
    })
    .returning({ id: receivables.id });
  return receivable.id;
}

/** Inserts a payable; returns the payable id. */
export async function seedPayable(
  tenantId: string,
  userId: string,
  opts: {
    description: string;
    totalCents: number;
    category: string;
    dueDate?: string | null;
  },
): Promise<string> {
  const [payable] = await db
    .insert(payables)
    .values({
      tenantId,
      userId,
      description: opts.description,
      totalCents: opts.totalCents,
      category: opts.category,
      dueDate: opts.dueDate ?? null,
    })
    .returning({ id: payables.id });
  return payable.id;
}

/** Inserts a cash movement; returns the cash_movement id. */
export async function seedCashMovement(
  tenantId: string,
  userId: string,
  opts: {
    amountCents: number;
    type: "entrada" | "saida";
    origin?: "venda" | "recebimento" | "pagamento" | "manual";
    description?: string | null;
  },
): Promise<string> {
  const [movement] = await db
    .insert(cashMovements)
    .values({
      tenantId,
      userId,
      amountCents: opts.amountCents,
      type: opts.type,
      origin: opts.origin ?? "manual",
      description: opts.description ?? null,
    })
    .returning({ id: cashMovements.id });
  return movement.id;
}

// ---------------------------------------------------------------------------
// Lucro/fechamento seed helpers (0005F). Inserts use the owner `db` connection —
// bypasses RLS intentionally (correct for seeding test data across tenants).
// ---------------------------------------------------------------------------

/**
 * Inserts a cash session for the given tenant/user; returns the session id.
 * Uses owner `db` to bypass RLS — correct for seeding test data.
 */
export async function seedCashSession(
  tenantId: string,
  userId: string,
  opts: {
    openingBalanceCents: number;
    status?: "aberta" | "fechada";
  },
): Promise<string> {
  const [session] = await db
    .insert(cashSessions)
    .values({
      tenantId,
      openingBalanceCents: opts.openingBalanceCents,
      openedBy: userId,
      status: opts.status ?? "aberta",
    })
    .returning({ id: cashSessions.id });
  return session.id;
}

// ---------------------------------------------------------------------------
// Comanda/mesa seed helpers (0006F). All inserts use the owner `db` connection —
// bypasses RLS intentionally (correct for seeding test data across tenants).
// Cascade via tenant_id removes all comanda rows when cleanupTenant() is called.
// ---------------------------------------------------------------------------

/**
 * Inserts a comanda for the given tenant/user; returns the full inserted row.
 * Uses owner `db` to bypass RLS — correct for seeding test data.
 */
export async function seedComanda(
  tenantId: string,
  userId: string,
  opts: {
    label?: string;
    status?: "aberta" | "fechada" | "cancelada";
    saleId?: string | null;
  } = {},
): Promise<typeof comandas.$inferSelect> {
  const [row] = await db
    .insert(comandas)
    .values({
      tenantId,
      openedBy: userId,
      label: opts.label ?? "Mesa Teste",
      status: opts.status ?? "aberta",
      saleId: opts.saleId ?? null,
    })
    .returning();
  return row;
}

/**
 * Inserts a comanda item for the given tenant/comanda/product; returns the full row.
 * Uses owner `db` to bypass RLS — correct for seeding test data.
 */
export async function seedComandaItem(
  tenantId: string,
  comandaId: string,
  productId: string,
  opts: {
    quantity?: number;
    observation?: string | null;
  } = {},
): Promise<typeof comandaItems.$inferSelect> {
  const [row] = await db
    .insert(comandaItems)
    .values({
      tenantId,
      comandaId,
      productId,
      quantity: (opts.quantity ?? 1).toString(),
      observation: opts.observation ?? null,
    })
    .returning();
  return row;
}

/**
 * Updates sale_price_cents on an existing product (admin db, bypasses RLS).
 * Useful for price-change tests (RN05 — partial total reflects current price).
 */
export async function setProductPrice(
  productId: string,
  salePriceCents: number,
): Promise<void> {
  await db
    .update(products)
    .set({ salePriceCents })
    .where(eq(products.id, productId));
}

/**
 * Returns the current stock_quantity for a product (admin db, bypasses RLS).
 * The value is stored as a numeric string in Postgres — returned as a string
 * to match Drizzle's numeric inference. Parse with parseFloat() when comparing.
 */
export async function getProductStock(productId: string): Promise<string> {
  const [row] = await db
    .select({ stockQuantity: products.stockQuantity })
    .from(products)
    .where(eq(products.id, productId));
  if (!row) throw new Error(`Product ${productId} not found`);
  return row.stockQuantity;
}
