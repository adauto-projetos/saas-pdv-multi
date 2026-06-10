import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@/db";
import { products, tenants } from "@/db/schema";
import type { ProductDto, ProductUnit, TenantSettingsDto } from "@/types/product";

/**
 * Executor = conexão direta (`db`) OU transação RLS (`RlsTx`). As funções aqui
 * recebem o executor de fora para que o service decida o contexto: produto sempre
 * sob `withUserRls` (RLS ativa); onboarding/seed direto no `db` (bypassa RLS).
 * TODA função filtra por `tenant_id` — filtro de aplicação aditivo à RLS.
 */
type Executor = Pick<Database, "insert" | "select" | "update">;

type ProductRow = typeof products.$inferSelect;

/** Coerção numeric(string do Postgres) -> number; nunca expõe a row crua. */
function toProductDto(row: ProductRow): ProductDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    barcode: row.barcode,
    unit: row.unit as ProductUnit,
    costCents: row.costCents,
    markupPercent: row.markupPercent != null ? Number(row.markupPercent) : null,
    salePriceCents: row.salePriceCents,
    priceIsManual: row.priceIsManual,
    stockQuantity: Number(row.stockQuantity),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type CreateProductData = {
  name: string;
  barcode?: string | null;
  unit: ProductUnit;
  costCents?: number | null;
  markupPercent?: number | null;
  salePriceCents: number;
  priceIsManual: boolean;
  stockQuantity: number;
};

export type UpdateProductData = Partial<{
  name: string;
  barcode: string | null;
  unit: ProductUnit;
  costCents: number | null;
  markupPercent: number | null;
  salePriceCents: number;
  priceIsManual: boolean;
  stockQuantity: number;
}>;

export async function insertProduct(
  tx: Executor,
  tenantId: string,
  data: CreateProductData,
): Promise<ProductDto> {
  const [row] = await tx
    .insert(products)
    .values({
      tenantId,
      name: data.name,
      barcode: data.barcode ?? null,
      unit: data.unit,
      costCents: data.costCents ?? null,
      // numeric -> string na escrita.
      markupPercent:
        data.markupPercent != null ? data.markupPercent.toString() : null,
      salePriceCents: data.salePriceCents,
      priceIsManual: data.priceIsManual,
      stockQuantity: data.stockQuantity.toString(),
    })
    .returning();
  return toProductDto(row);
}

export async function updateProductRow(
  tx: Executor,
  tenantId: string,
  productId: string,
  data: UpdateProductData,
): Promise<ProductDto | null> {
  const set: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
  if (data.name !== undefined) set.name = data.name;
  if (data.barcode !== undefined) set.barcode = data.barcode;
  if (data.unit !== undefined) set.unit = data.unit;
  if (data.costCents !== undefined) set.costCents = data.costCents;
  if (data.markupPercent !== undefined)
    set.markupPercent =
      data.markupPercent === null ? null : data.markupPercent.toString();
  if (data.salePriceCents !== undefined) set.salePriceCents = data.salePriceCents;
  if (data.priceIsManual !== undefined) set.priceIsManual = data.priceIsManual;
  if (data.stockQuantity !== undefined)
    set.stockQuantity = data.stockQuantity.toString();

  const [row] = await tx
    .update(products)
    .set(set)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .returning();
  return row ? toProductDto(row) : null;
}

export async function selectProducts(
  tx: Executor,
  tenantId: string,
): Promise<ProductDto[]> {
  const rows = await tx
    .select()
    .from(products)
    .where(eq(products.tenantId, tenantId))
    .orderBy(asc(products.name));
  return rows.map(toProductDto);
}

export async function selectProductById(
  tx: Executor,
  tenantId: string,
  productId: string,
): Promise<ProductDto | null> {
  const [row] = await tx
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
    .limit(1);
  return row ? toProductDto(row) : null;
}

export async function selectTenantDefaultMarkup(
  tx: Executor,
  tenantId: string,
): Promise<number | null> {
  const [row] = await tx
    .select({ percent: tenants.defaultMarkupPercent })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row ? Number(row.percent) : null;
}

export async function updateTenantDefaultMarkup(
  tx: Executor,
  tenantId: string,
  percent: number,
): Promise<TenantSettingsDto | null> {
  const [row] = await tx
    .update(tenants)
    .set({ defaultMarkupPercent: percent.toString(), updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning({ id: tenants.id, percent: tenants.defaultMarkupPercent });
  return row
    ? { tenantId: row.id, defaultMarkupPercent: Number(row.percent) }
    : null;
}
