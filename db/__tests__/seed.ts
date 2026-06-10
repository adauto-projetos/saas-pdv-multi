import { eq } from "drizzle-orm";

import { db } from "@/db";
import { products, tenantMembers, tenants, users } from "@/db/schema";
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
      priceIsManual: false,
      barcode: opts.barcode ?? null,
    })
    .returning({ id: products.id });
  return product.id;
}
