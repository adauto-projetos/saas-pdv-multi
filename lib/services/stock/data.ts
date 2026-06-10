import { and, desc, eq, gte, lte } from "drizzle-orm";

import type { Database } from "@/db";
import { stockMovements } from "@/db/schema";
import { adjustProductStock } from "@/lib/services/products/data";
import type { MovementType } from "@/lib/validation/stock";
import type { StockMovementDto } from "@/types/stock";

type Executor = Pick<Database, "insert" | "select" | "update">;

type MovementInput = {
  productId: string;
  type: MovementType;
  quantity: number; // delta assinado
  reason?: string | null;
  saleId?: string | null;
  userId: string;
};

function toMovementDto(row: typeof stockMovements.$inferSelect): StockMovementDto {
  return {
    id: row.id,
    productId: row.productId,
    type: row.type as MovementType,
    quantity: Number(row.quantity),
    reason: row.reason,
    saleId: row.saleId,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function insertMovement(
  tx: Executor,
  tenantId: string,
  data: MovementInput,
): Promise<StockMovementDto> {
  const [row] = await tx
    .insert(stockMovements)
    .values({
      tenantId,
      productId: data.productId,
      type: data.type,
      quantity: data.quantity.toString(),
      reason: data.reason ?? null,
      saleId: data.saleId ?? null,
      userId: data.userId,
    })
    .returning();
  return toMovementDto(row);
}

export async function selectMovements(
  tx: Executor,
  tenantId: string,
  productId: string,
  filters: { type?: MovementType; from?: string; to?: string } = {},
): Promise<StockMovementDto[]> {
  const conds = [
    eq(stockMovements.tenantId, tenantId),
    eq(stockMovements.productId, productId),
  ];
  if (filters.type) conds.push(eq(stockMovements.type, filters.type));
  // Ignora datas inválidas em vez de quebrar a query.
  const fromDate = filters.from ? new Date(filters.from) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    conds.push(gte(stockMovements.createdAt, fromDate));
  }
  const toDate = filters.to ? new Date(filters.to) : null;
  if (toDate && !Number.isNaN(toDate.getTime())) {
    conds.push(lte(stockMovements.createdAt, toDate));
  }

  const rows = await tx
    .select()
    .from(stockMovements)
    .where(and(...conds))
    .orderBy(desc(stockMovements.createdAt));
  return rows.map(toMovementDto);
}

/**
 * Saída gerada por uma venda (RF03/RN08): grava o movimento `saida` (delta −qty,
 * com `sale_id`) e baixa o estoque. Chamado por `finalizeSale` DENTRO da transação
 * da venda — atômico com a venda.
 */
export async function recordSaleExit(
  tx: Executor,
  tenantId: string,
  userId: string,
  productId: string,
  quantity: number,
  saleId: string,
): Promise<void> {
  await insertMovement(tx, tenantId, {
    productId,
    type: "saida",
    quantity: -quantity,
    saleId,
    userId,
  });
  await adjustProductStock(tx, tenantId, productId, -quantity);
}
