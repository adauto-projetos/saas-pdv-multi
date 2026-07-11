import { withUserRls } from "@/db/rls";
import {
  ConflictError,
  isUniqueViolation,
  NotFoundError,
  ValidationError,
} from "@/lib/services/errors";
import { CATEGORY_COLOR_SLUGS } from "@/lib/validation/product";
import type {
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
} from "@/lib/validation/product";
import type { AuthContext, ProductCategoryDto } from "@/types/product";

import * as data from "./category-data";

const NAME_CONFLICT_MESSAGE = "Já existe uma categoria com esse nome";
const RESERVED_NAME_MESSAGE = '"Sem categoria" é um nome reservado';
const NOT_FOUND_MESSAGE = "Categoria não encontrada";
const INVALID_LIST_MESSAGE = "Lista de categorias inválida";

/**
 * Normaliza o nome para as comparações de RN01/RN06: minúsculas + remoção de
 * acentos via NFD (o projeto não tem `unaccent`/`citext`; o unique index
 * `(tenant_id, name)` é o backstop exato no banco).
 */
export function normalizeCategoryName(name: string): string {
  return name
    .normalize("NFD")
    // Remove os combining marks que o NFD separa (faixa U+0300–U+036F).
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** RN06: "Sem categoria" é a AUSÊNCIA de categoria (RN04), nunca um registro. */
const RESERVED_NAME = normalizeCategoryName("Sem categoria");

function assertNotReserved(name: string): void {
  if (normalizeCategoryName(name) === RESERVED_NAME) {
    throw new ValidationError(RESERVED_NAME_MESSAGE, {
      name: RESERVED_NAME_MESSAGE,
    });
  }
}

/**
 * RF01/RF04 — cria categoria. RN06 (nome reservado) e RN01 (duplicado
 * normalizado no tenant) antes do insert; RN05 quando a cor é omitida: próxima
 * cor da paleta cíclica (`palette[count % len]`). Entra no fim da ordem manual
 * (position = max + 1, RF06).
 */
export async function createProductCategory(
  ctx: AuthContext,
  input: CreateProductCategoryInput,
): Promise<ProductCategoryDto> {
  assertNotReserved(input.name);
  const normalized = normalizeCategoryName(input.name);

  try {
    return await withUserRls(ctx.userId, async (tx) => {
      const existing = await data.selectProductCategories(tx, ctx.tenantId);
      if (existing.some((c) => normalizeCategoryName(c.name) === normalized)) {
        throw new ConflictError(NAME_CONFLICT_MESSAGE, "name");
      }
      const color =
        input.color ??
        CATEGORY_COLOR_SLUGS[existing.length % CATEGORY_COLOR_SLUGS.length];
      const position =
        existing.reduce((max, c) => Math.max(max, c.position), -1) + 1;
      return data.insertProductCategory(tx, ctx.tenantId, {
        name: input.name,
        color,
        position,
      });
    });
  } catch (error) {
    // Backstop do unique index (tenant_id, name) — corrida entre dois creates.
    if (isUniqueViolation(error)) {
      throw new ConflictError(NAME_CONFLICT_MESSAGE, "name");
    }
    throw error;
  }
}

/** RF05/RF06/RF07 — lista ordenada por position. Nunca inclui "Sem categoria" (RN04). */
export async function listProductCategories(
  ctx: AuthContext,
): Promise<ProductCategoryDto[]> {
  return withUserRls(ctx.userId, (tx) =>
    data.selectProductCategories(tx, ctx.tenantId),
  );
}

/**
 * RF02/RF05 — renomeia e/ou recolore. No rename, RN06 + RN01 (excluindo o
 * próprio id). Id fora do tenant → NotFoundError (a RLS já esconde a linha).
 */
export async function updateProductCategory(
  ctx: AuthContext,
  input: UpdateProductCategoryInput,
): Promise<ProductCategoryDto> {
  if (input.name !== undefined) assertNotReserved(input.name);

  try {
    return await withUserRls(ctx.userId, async (tx) => {
      if (input.name !== undefined) {
        const normalized = normalizeCategoryName(input.name);
        const existing = await data.selectProductCategories(tx, ctx.tenantId);
        const duplicate = existing.some(
          (c) => c.id !== input.id && normalizeCategoryName(c.name) === normalized,
        );
        if (duplicate) throw new ConflictError(NAME_CONFLICT_MESSAGE, "name");
      }
      const updated = await data.updateProductCategoryRow(
        tx,
        ctx.tenantId,
        input.id,
        { name: input.name, color: input.color },
      );
      if (!updated) throw new NotFoundError(NOT_FOUND_MESSAGE);
      return updated;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(NAME_CONFLICT_MESSAGE, "name");
    }
    throw error;
  }
}

/**
 * RF06 — ordem manual. `orderedIds` deve ser EXATAMENTE o conjunto completo de
 * categorias do tenant (sem faltas, sobras ou repetições); grava positions
 * 0..n-1 e devolve a lista reordenada.
 */
export async function reorderProductCategories(
  ctx: AuthContext,
  orderedIds: string[],
): Promise<ProductCategoryDto[]> {
  return withUserRls(ctx.userId, async (tx) => {
    const existing = await data.selectProductCategories(tx, ctx.tenantId);
    const existingIds = new Set(existing.map((c) => c.id));
    const isExactSet =
      orderedIds.length === existingIds.size &&
      new Set(orderedIds).size === orderedIds.length &&
      orderedIds.every((id) => existingIds.has(id));
    if (!isExactSet) throw new ValidationError(INVALID_LIST_MESSAGE);

    await data.updateProductCategoryPositions(tx, ctx.tenantId, orderedIds);
    return data.selectProductCategories(tx, ctx.tenantId);
  });
}

/** RF03 — quantos produtos serão movidos para "Sem categoria" ao excluir. */
export async function countProductsInCategory(
  ctx: AuthContext,
  id: string,
): Promise<{ count: number }> {
  return withUserRls(ctx.userId, async (tx) => {
    const category = await data.selectProductCategoryById(tx, ctx.tenantId, id);
    if (!category) throw new NotFoundError(NOT_FOUND_MESSAGE);
    const count = await data.countProductsByCategoryId(tx, ctx.tenantId, id);
    return { count };
  });
}

/**
 * RF03 — exclui a categoria. Conta os vinculados ANTES (mesma tx) e retorna
 * `movedCount`: o FK ON DELETE SET NULL move esses produtos para "Sem
 * categoria" (RN04). Vendas lançadas não são tocadas (RN07 — sale_items guarda
 * snapshot e não referencia categoria).
 */
export async function deleteProductCategory(
  ctx: AuthContext,
  id: string,
): Promise<{ id: string; movedCount: number }> {
  return withUserRls(ctx.userId, async (tx) => {
    const movedCount = await data.countProductsByCategoryId(tx, ctx.tenantId, id);
    const deleted = await data.deleteProductCategoryRow(tx, ctx.tenantId, id);
    if (!deleted) throw new NotFoundError(NOT_FOUND_MESSAGE);
    return { id, movedCount };
  });
}
