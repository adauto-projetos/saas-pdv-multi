import { withUserRls } from "@/db/rls";
import { ConflictError, isUniqueViolation, NotFoundError } from "@/lib/services/errors";
import type {
  ApplyCostChangeInput,
  CreateProductInput,
  PreviewCostChangeInput,
  UpdateProductInput,
} from "@/lib/validation/product";
import type {
  AuthContext,
  PriceSuggestionDto,
  ProductDto,
} from "@/types/product";

import * as data from "./data";
import { resolvePriceOnCreate, suggestPriceOnCostChange } from "./markup";

const BARCODE_CONFLICT_MESSAGE =
  "Código de barras já cadastrado nesta loja";

/**
 * Cria produto sob a RLS do usuário (RN05): `tenantId` vem do contexto de auth,
 * nunca do input. Decide preço/flag manual (RF03/RF04) e traduz violação de unique
 * de código de barras em ConflictError (RN01).
 */
export async function createProduct(
  ctx: AuthContext,
  input: CreateProductInput,
): Promise<ProductDto> {
  const { salePriceCents, priceIsManual } = resolvePriceOnCreate(input);
  try {
    return await withUserRls(ctx.userId, (tx) =>
      data.insertProduct(tx, ctx.tenantId, {
        name: input.name,
        barcode: input.barcode ?? null,
        unit: input.unit,
        costCents: input.costCents ?? null,
        markupPercent: input.markupPercent ?? null,
        salePriceCents,
        priceIsManual,
        stockQuantity: input.stockQuantity,
        minStock: input.minStock ?? null,
      }),
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(BARCODE_CONFLICT_MESSAGE, "barcode");
    }
    throw error;
  }
}

/** Edita campos do produto (RF07). Cost change deve passar pela RF06, não por aqui. */
export async function updateProduct(
  ctx: AuthContext,
  input: UpdateProductInput,
): Promise<ProductDto> {
  const patch: data.UpdateProductData = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.barcode !== undefined) patch.barcode = input.barcode ?? null;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.stockQuantity !== undefined) patch.stockQuantity = input.stockQuantity;
  if (input.minStock !== undefined) patch.minStock = input.minStock ?? null;
  if (input.costCents !== undefined) patch.costCents = input.costCents ?? null;
  if (input.markupPercent !== undefined)
    patch.markupPercent = input.markupPercent ?? null;
  // Preço informado explicitamente => override manual (RF03).
  if (input.salePriceCents !== undefined) {
    patch.salePriceCents = input.salePriceCents;
    patch.priceIsManual = true;
  }

  try {
    const result = await withUserRls(ctx.userId, (tx) =>
      data.updateProductRow(tx, ctx.tenantId, input.id, patch),
    );
    if (!result) throw new NotFoundError("Produto não encontrado");
    return result;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(BARCODE_CONFLICT_MESSAGE, "barcode");
    }
    throw error;
  }
}

/** Lista produtos da loja, incluindo estoque (somente leitura) (RF07/RF08). */
export async function listProducts(ctx: AuthContext): Promise<ProductDto[]> {
  return withUserRls(ctx.userId, (tx) => data.selectProducts(tx, ctx.tenantId));
}

export async function getProduct(
  ctx: AuthContext,
  productId: string,
): Promise<ProductDto> {
  const product = await withUserRls(ctx.userId, (tx) =>
    data.selectProductById(tx, ctx.tenantId, productId),
  );
  if (!product) throw new NotFoundError("Produto não encontrado");
  return product;
}

/** RF06 — preview: sugere novo preço a partir da margem armazenada. NÃO persiste. */
export async function previewPriceOnCostChange(
  ctx: AuthContext,
  input: PreviewCostChangeInput,
): Promise<PriceSuggestionDto> {
  const product = await getProduct(ctx, input.id);
  return suggestPriceOnCostChange(product, input.newCostCents);
}

/**
 * RF06 — confirma: salva SEMPRE o novo custo. Se aceitou, atualiza também o preço
 * (e zera o flag manual); se cancelou, mantém preço e flag (só o custo muda).
 */
export async function applyCostChange(
  ctx: AuthContext,
  input: ApplyCostChangeInput,
): Promise<ProductDto> {
  const result = await withUserRls(ctx.userId, async (tx) => {
    const product = await data.selectProductById(tx, ctx.tenantId, input.id);
    if (!product) return null;

    const suggestion = suggestPriceOnCostChange(product, input.newCostCents);
    const patch: data.UpdateProductData = { costCents: input.newCostCents };
    if (input.acceptSuggestion) {
      patch.salePriceCents = suggestion.suggestedSalePriceCents;
      patch.priceIsManual = false;
    }
    return data.updateProductRow(tx, ctx.tenantId, input.id, patch);
  });

  if (!result) throw new NotFoundError("Produto não encontrado");
  return result;
}
