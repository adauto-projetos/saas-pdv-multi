"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { requireAuthContext } from "@/lib/auth";
import { requireAnyPermission, requirePermission } from "@/lib/auth/permissions";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import * as service from "@/lib/services/products/product-service";
import {
  applyCostChangeSchema,
  createProductSchema,
  previewCostChangeSchema,
  productIdSchema,
  updateProductSchema,
} from "@/lib/validation/product";
import { imageRemoveSchema } from "@/lib/validation/storage";
import type { PriceSuggestionDto, ProductDto } from "@/types/product";

/** Mapeia erros de validação do zod para { campo: mensagem }. */
function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createProductAction(
  input: unknown,
): Promise<ActionResult<ProductDto>> {
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os campos do formulário.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const ctx = await requireAuthContext();
    await requirePermission(ctx, "produtos");
    const product = await service.createProduct(ctx, parsed.data);
    revalidatePath("/products");
    return { ok: true, data: product };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateProductAction(
  input: unknown,
): Promise<ActionResult<ProductDto>> {
  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os campos do formulário.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const ctx = await requireAuthContext();
    await requirePermission(ctx, "produtos");
    const product = await service.updateProduct(ctx, parsed.data);
    revalidatePath("/products");
    return { ok: true, data: product };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listProductsAction(): Promise<ActionResult<ProductDto[]>> {
  try {
    const ctx = await requireAuthContext();
    // Leitura compartilhada: gestores de produto e operadores do PDV (caixa).
    await requireAnyPermission(ctx, ["produtos", "caixa"]);
    return { ok: true, data: await service.listProducts(ctx) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getProductAction(
  input: unknown,
): Promise<ActionResult<ProductDto>> {
  const parsed = productIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Produto inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    await requirePermission(ctx, "produtos");
    return { ok: true, data: await service.getProduct(ctx, parsed.data.id) };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * RF02 — remove a foto do produto. Zera a referência no banco e apaga o arquivo no
 * R2 (tolerante a falha, RF09). O upload/troca é feito pelo route handler
 * `POST /api/products/[id]/upload` (recebe multipart); aqui só a remoção.
 */
export async function removeProductImageAction(
  input: unknown,
): Promise<ActionResult<ProductDto>> {
  const parsed = imageRemoveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Produto inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    await requirePermission(ctx, "produtos");
    const product = await service.removeProductImage(ctx, parsed.data.id);
    revalidatePath("/products");
    return { ok: true, data: product };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * RF07 — exclui o produto e, se houver, remove sua foto do R2 (tolerante, RF09).
 * Contrato exposto pela feature 0016F; sem fiação de UI por ora.
 */
export async function deleteProductAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = productIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Produto inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    await requirePermission(ctx, "produtos");
    await service.deleteProduct(ctx, parsed.data.id);
    revalidatePath("/products");
    return { ok: true, data: { id: parsed.data.id } };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF06 — preview (não persiste). */
export async function previewPriceOnCostChangeAction(
  input: unknown,
): Promise<ActionResult<PriceSuggestionDto>> {
  const parsed = previewCostChangeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Custo inválido.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const ctx = await requireAuthContext();
    await requirePermission(ctx, "produtos");
    const suggestion = await service.previewPriceOnCostChange(ctx, parsed.data);
    return { ok: true, data: suggestion };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF06 — confirma (persiste custo + preço se aceito). */
export async function applyCostChangeAction(
  input: unknown,
): Promise<ActionResult<ProductDto>> {
  const parsed = applyCostChangeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Dados inválidos.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const ctx = await requireAuthContext();
    await requirePermission(ctx, "produtos");
    const product = await service.applyCostChange(ctx, parsed.data);
    revalidatePath("/products");
    return { ok: true, data: product };
  } catch (error) {
    return toActionError(error);
  }
}
