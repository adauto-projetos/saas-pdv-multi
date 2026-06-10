import { withUserRls } from "@/db/rls";
import { NotFoundError } from "@/lib/services/errors";
import {
  adjustProductStock,
  selectLowStockProducts,
  selectProductById,
  setProductMinStock,
  setProductStock,
} from "@/lib/services/products/data";
import type {
  MinStockInput,
  MovementFilterInput,
  StockAdjustmentInput,
  StockEntryInput,
} from "@/lib/validation/stock";
import type { AuthContext, ProductDto } from "@/types/product";
import type { StockMovementDto } from "@/types/stock";

import * as data from "./data";

/** RF01 — entrada: grava movimento `entrada` (+qty) e sobe o estoque, na mesma tx (RN02). */
export async function recordEntry(
  ctx: AuthContext,
  input: StockEntryInput,
): Promise<StockMovementDto> {
  return withUserRls(ctx.userId, async (tx) => {
    const movement = await data.insertMovement(tx, ctx.tenantId, {
      productId: input.productId,
      type: "entrada",
      quantity: input.quantity,
      reason: input.reason,
      userId: ctx.userId,
    });
    await adjustProductStock(tx, ctx.tenantId, input.productId, input.quantity);
    return movement;
  });
}

/**
 * RF02 — ajuste por contagem: delta = contagem real − estoque atual; grava `ajuste`
 * e acerta o estoque para a contagem. Tudo na mesma tx (RN02).
 */
export async function recordAdjustment(
  ctx: AuthContext,
  input: StockAdjustmentInput,
): Promise<StockMovementDto> {
  return withUserRls(ctx.userId, async (tx) => {
    const product = await selectProductById(tx, ctx.tenantId, input.productId);
    if (!product) throw new NotFoundError("Produto não encontrado");

    // Arredonda o delta a 3 casas (numeric(10,3)) p/ evitar artefato de float.
    const delta =
      Math.round((input.countedQuantity - product.stockQuantity) * 1000) / 1000;
    const movement = await data.insertMovement(tx, ctx.tenantId, {
      productId: input.productId,
      type: "ajuste",
      quantity: delta,
      reason: input.reason ?? `Contagem: ${input.countedQuantity}`,
      userId: ctx.userId,
    });
    // Seta o estoque EXATAMENTE para a contagem (sem somar delta = sem drift).
    await setProductStock(tx, ctx.tenantId, input.productId, input.countedQuantity);
    return movement;
  });
}

/** RF05 — histórico de movimentações do produto, filtrável. */
export async function listMovements(
  ctx: AuthContext,
  input: MovementFilterInput,
): Promise<StockMovementDto[]> {
  return withUserRls(ctx.userId, (tx) =>
    data.selectMovements(tx, ctx.tenantId, input.productId, {
      type: input.type,
      from: input.from,
      to: input.to,
    }),
  );
}

/** RF06 — define o nível mínimo do produto (aceita null). */
export async function setMinStock(
  ctx: AuthContext,
  input: MinStockInput,
): Promise<ProductDto> {
  const product = await withUserRls(ctx.userId, (tx) =>
    setProductMinStock(tx, ctx.tenantId, input.productId, input.minStock),
  );
  if (!product) throw new NotFoundError("Produto não encontrado");
  return product;
}

/** RF07 — produtos com estoque baixo (≤ mínimo). */
export async function listLowStock(ctx: AuthContext): Promise<ProductDto[]> {
  return withUserRls(ctx.userId, (tx) =>
    selectLowStockProducts(tx, ctx.tenantId),
  );
}
