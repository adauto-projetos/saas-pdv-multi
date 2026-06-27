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

import * as imageService from "./image-service";
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
        emoji: input.emoji ?? null,
        category: input.category ?? null,
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
  if (input.emoji !== undefined) patch.emoji = input.emoji ?? null;
  if (input.category !== undefined) patch.category = input.category ?? null;
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

/**
 * Anexa/troca a foto do produto (RF01/RF02/RF06). Lê a chave atual sob RLS, processa
 * a imagem (sharp valida RN05 + resize/WebP RNF01), grava no R2 com chave aleatória
 * prefixada por tenant (RN03/RN04), e persiste imageKey/imageUrl sob RLS. Se já havia
 * foto, o arquivo antigo é removido (RF06) tolerando falha (RF09). RN02: chave única —
 * a nova sobrescreve a referência da anterior. Desacoplado do create/update (RF08).
 */
export async function uploadProductImage(
  ctx: AuthContext,
  productId: string,
  bytes: Buffer,
): Promise<ProductDto> {
  // 1. Lê a foto atual (confirma que o produto existe nesta loja) e o nome da loja,
  //    sob RLS, na mesma transação.
  const { current, storeName } = await withUserRls(ctx.userId, async (tx) => {
    const current = await data.selectProductById(tx, ctx.tenantId, productId);
    const storeName = await data.selectTenantName(tx, ctx.tenantId);
    return { current, storeName };
  });
  if (!current) throw new NotFoundError("Produto não encontrado");

  // 2. Processa + grava no R2 (fora da transação — I/O externo). RN03: pasta por loja
  //    `<slug-do-nome>-<tenantId>/` — legível no painel e única por tenant.
  const keyPrefix = imageService.storeKeyPrefix(storeName ?? "", ctx.tenantId);
  const { key, url } = await imageService.uploadImage(
    keyPrefix,
    bytes,
    current.imageKey,
  );

  // 3. Persiste a referência sob RLS.
  const result = await withUserRls(ctx.userId, (tx) =>
    data.updateProductRow(tx, ctx.tenantId, productId, {
      imageKey: key,
      imageUrl: url,
    }),
  );
  if (!result) throw new NotFoundError("Produto não encontrado");
  return result;
}

/**
 * Remove a foto do produto (RF02): zera imageKey/imageUrl sob RLS e apaga o arquivo
 * no R2 tolerando falha (RF09). Idempotente: produto sem foto retorna sem efeito.
 */
export async function removeProductImage(
  ctx: AuthContext,
  productId: string,
): Promise<ProductDto> {
  const current = await withUserRls(ctx.userId, (tx) =>
    data.selectProductById(tx, ctx.tenantId, productId),
  );
  if (!current) throw new NotFoundError("Produto não encontrado");

  // Apaga o arquivo ANTES de zerar a referência (RF09 tolerante): se o delete no R2
  // falha, a linha ainda guarda a chave e a ação pode ser reexecutada; zerar primeiro
  // perderia a chave e deixaria um órfão sem rastro num crash entre os dois passos.
  if (current.imageKey) {
    await imageService.safeDelete(current.imageKey);
  }

  const result = await withUserRls(ctx.userId, (tx) =>
    data.updateProductRow(tx, ctx.tenantId, productId, {
      imageKey: null,
      imageUrl: null,
    }),
  );
  if (!result) throw new NotFoundError("Produto não encontrado");
  return result;
}

/**
 * Exclui o produto (RF07). Apaga a linha sob RLS e, se havia foto, remove o arquivo
 * do R2 tolerando falha (RF09 — órfão raro é aceito). Lança NotFoundError se a linha
 * não existia nessa loja.
 */
export async function deleteProduct(
  ctx: AuthContext,
  productId: string,
): Promise<void> {
  const deleted = await withUserRls(ctx.userId, (tx) =>
    data.deleteProductRow(tx, ctx.tenantId, productId),
  );
  if (!deleted) throw new NotFoundError("Produto não encontrado");

  if (deleted.imageKey) {
    await imageService.safeDelete(deleted.imageKey);
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
