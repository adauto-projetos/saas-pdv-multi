import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  cashMovements,
  customers,
  payables,
  products,
  receivables,
  tenantMembers,
  tenants,
  users,
} from "@/db/schema";
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

export async function seedProduct(
  tenantId: string,
  opts: {
    name?: string;
    unit?: ProductUnit;
    salePriceCents?: number;
    stockQuantity?: number;
    minStock?: number | null;
    barcode?: string | null;
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
