import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { productCategories, products } from "@/db/schema";
import type { CategoryColor } from "@/lib/validation/product";
import type { ProductCategoryDto } from "@/types/product";

/**
 * Executor = conexão direta (`db`) OU transação RLS (`RlsTx`). O service decide o
 * contexto: categoria sempre sob `withUserRls` (RLS ativa); seed/onboarding direto
 * no `db` (bypassa RLS). TODA função filtra por `tenant_id` — aditivo à RLS.
 */
type Executor = Pick<Database, "insert" | "select" | "update">;

type ProductCategoryRow = typeof productCategories.$inferSelect;

/** Nunca expõe a row crua; `color` é sempre um slug da CATEGORY_PALETTE. */
function toProductCategoryDto(row: ProductCategoryRow): ProductCategoryDto {
  return {
    id: row.id,
    name: row.name,
    color: row.color as CategoryColor,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function insertProductCategory(
  tx: Executor,
  tenantId: string,
  data: { name: string; color: CategoryColor; position: number },
): Promise<ProductCategoryDto> {
  const [row] = await tx
    .insert(productCategories)
    .values({
      tenantId,
      name: data.name,
      color: data.color,
      position: data.position,
    })
    .returning();
  return toProductCategoryDto(row);
}

/** Categorias do tenant na ordem manual (RF06); createdAt desempata posições iguais. */
export async function selectProductCategories(
  tx: Executor,
  tenantId: string,
): Promise<ProductCategoryDto[]> {
  const rows = await tx
    .select()
    .from(productCategories)
    .where(eq(productCategories.tenantId, tenantId))
    .orderBy(asc(productCategories.position), asc(productCategories.createdAt));
  return rows.map(toProductCategoryDto);
}

export async function selectProductCategoryById(
  tx: Executor,
  tenantId: string,
  id: string,
): Promise<ProductCategoryDto | null> {
  const [row] = await tx
    .select()
    .from(productCategories)
    .where(
      and(eq(productCategories.tenantId, tenantId), eq(productCategories.id, id)),
    )
    .limit(1);
  return row ? toProductCategoryDto(row) : null;
}

/** Renomeia/recolore (RF02/RF05). Retorna null quando o id não existe no tenant. */
export async function updateProductCategoryRow(
  tx: Executor,
  tenantId: string,
  id: string,
  data: { name?: string; color?: CategoryColor },
): Promise<ProductCategoryDto | null> {
  const set: Partial<typeof productCategories.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (data.name !== undefined) set.name = data.name;
  if (data.color !== undefined) set.color = data.color;

  const [row] = await tx
    .update(productCategories)
    .set(set)
    .where(
      and(eq(productCategories.tenantId, tenantId), eq(productCategories.id, id)),
    )
    .returning();
  return row ? toProductCategoryDto(row) : null;
}

/**
 * Reordena em lote (RF06): grava position = índice na lista (0..n-1). A
 * equivalência exata de `orderedIds` com o conjunto do tenant é validada no
 * service ANTES de chamar aqui.
 */
export async function updateProductCategoryPositions(
  tx: Executor,
  tenantId: string,
  orderedIds: string[],
): Promise<void> {
  const now = new Date();
  for (const [index, id] of orderedIds.entries()) {
    await tx
      .update(productCategories)
      .set({ position: index, updatedAt: now })
      .where(
        and(
          eq(productCategories.tenantId, tenantId),
          eq(productCategories.id, id),
        ),
      );
  }
}

/** Produtos vinculados à categoria — base do aviso "N produtos serão movidos" (RF03). */
export async function countProductsByCategoryId(
  tx: Executor,
  tenantId: string,
  categoryId: string,
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(products)
    .where(
      and(eq(products.tenantId, tenantId), eq(products.categoryId, categoryId)),
    );
  return row?.count ?? 0;
}

/**
 * Apaga a categoria (RF03). O FK `products.category_id ON DELETE SET NULL` move
 * os produtos para "Sem categoria" (RN04). Retorna undefined quando nenhuma
 * linha foi apagada (id inexistente nesse tenant).
 */
export async function deleteProductCategoryRow(
  tx: Pick<Database, "delete">,
  tenantId: string,
  id: string,
): Promise<{ id: string } | undefined> {
  const [row] = await tx
    .delete(productCategories)
    .where(
      and(eq(productCategories.tenantId, tenantId), eq(productCategories.id, id)),
    )
    .returning({ id: productCategories.id });
  return row ? { id: row.id } : undefined;
}
