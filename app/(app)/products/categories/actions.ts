"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { requireAuthContext } from "@/lib/auth";
import { requireAnyPermission, requirePermission } from "@/lib/auth/permissions";
import { requireActiveTenant } from "@/lib/auth/tenant-guard";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import * as service from "@/lib/services/products/category-service";
import {
  createProductCategorySchema,
  productCategoryIdSchema,
  reorderProductCategoriesSchema,
  updateProductCategorySchema,
} from "@/lib/validation/product";
import type { ProductCategoryDto } from "@/types/product";

/** Mapeia erros de validação do zod para { campo: mensagem }. */
function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Toda escrita de categoria reflete nas três superfícies que a exibem:
 * gestão (/products/categories), formulário/listagem (/products) e chips
 * do caixa (/caixa) — RF02/RF06/RF07.
 */
function revalidateCategorySurfaces(): void {
  revalidatePath("/products");
  revalidatePath("/products/categories");
  revalidatePath("/caixa");
}

/** RF01/RF04 — cria categoria; DTO volta para seleção inline, no fim da ordem. */
export async function createProductCategoryAction(
  input: unknown,
): Promise<ActionResult<ProductCategoryDto>> {
  const parsed = createProductCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os campos do formulário.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    await requirePermission(ctx, "produtos");
    const category = await service.createProductCategory(ctx, parsed.data);
    revalidateCategorySurfaces();
    return { ok: true, data: category };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * RF05/RF06/RF07 — lista ordenada por `position`. Leitura compartilhada:
 * gestores de produto e operadores do PDV (chips do caixa), mesmo precedente
 * de `listProductsForCaixaAction`.
 */
export async function listProductCategoriesAction(): Promise<
  ActionResult<ProductCategoryDto[]>
> {
  try {
    const ctx = await requireAuthContext();
    await requireAnyPermission(ctx, ["produtos", "caixa"]);
    return { ok: true, data: await service.listProductCategories(ctx) };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF02/RF05 — renomeia e/ou recolore a categoria. */
export async function updateProductCategoryAction(
  input: unknown,
): Promise<ActionResult<ProductCategoryDto>> {
  const parsed = updateProductCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os campos do formulário.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    await requirePermission(ctx, "produtos");
    const category = await service.updateProductCategory(ctx, parsed.data);
    revalidateCategorySurfaces();
    return { ok: true, data: category };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF06 — ordem manual: recebe a lista COMPLETA de ids na nova ordem. */
export async function reorderProductCategoriesAction(
  input: unknown,
): Promise<ActionResult<ProductCategoryDto[]>> {
  const parsed = reorderProductCategoriesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Lista de categorias inválida." };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    await requirePermission(ctx, "produtos");
    const categories = await service.reorderProductCategories(
      ctx,
      parsed.data.orderedIds,
    );
    revalidateCategorySurfaces();
    return { ok: true, data: categories };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF03 — contagem para o aviso "N produtos serão movidos para Sem categoria". */
export async function countProductsInCategoryAction(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  const parsed = productCategoryIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Categoria inválida." };
  }
  try {
    const ctx = await requireAuthContext();
    await requireAnyPermission(ctx, ["produtos", "caixa"]);
    const result = await service.countProductsInCategory(ctx, parsed.data.id);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * RF03 — exclui a categoria; o FK ON DELETE SET NULL move os produtos para
 * "Sem categoria" (RN04). Retorna `movedCount` para o toast de confirmação.
 */
export async function deleteProductCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string; movedCount: number }>> {
  const parsed = productCategoryIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Categoria inválida." };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    await requirePermission(ctx, "produtos");
    const result = await service.deleteProductCategory(ctx, parsed.data.id);
    revalidateCategorySurfaces();
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}
