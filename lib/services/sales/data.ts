import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";

import type { Database } from "@/db";
import { saleItems, sales } from "@/db/schema";
import type { PaymentMethod } from "@/lib/validation/sale";
import type { ProductUnit } from "@/types/product";
import type { SaleDto, SaleItemDto } from "@/types/sale";

type Executor = Pick<Database, "insert" | "select" | "update">;

/** Linha de item a inserir (já com snapshot resolvido pelo serviço). */
export type SaleItemRow = {
  productId: string | null;
  nameSnapshot: string;
  unit: ProductUnit;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
};

function toSaleItemDto(row: typeof saleItems.$inferSelect): SaleItemDto {
  return {
    id: row.id,
    productId: row.productId,
    name: row.nameSnapshot,
    unit: row.unit as ProductUnit,
    unitPriceCents: row.unitPriceCents,
    quantity: Number(row.quantity),
    subtotalCents: row.subtotalCents,
  };
}

function toSaleDto(
  row: typeof sales.$inferSelect,
  items: SaleItemDto[],
): SaleDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    totalCents: row.totalCents,
    paymentMethod: row.paymentMethod as PaymentMethod,
    customerId: row.customerId,
    createdAt: row.createdAt.toISOString(),
    items,
  };
}

export async function insertSale(
  tx: Executor,
  tenantId: string,
  userId: string,
  paymentMethod: PaymentMethod,
  totalCents: number,
  customerId: string | null,
): Promise<{ id: string; createdAt: Date }> {
  const [row] = await tx
    .insert(sales)
    .values({ tenantId, userId, paymentMethod, totalCents, customerId })
    .returning({ id: sales.id, createdAt: sales.createdAt });
  return { id: row.id, createdAt: row.createdAt };
}

export async function insertSaleItems(
  tx: Executor,
  tenantId: string,
  saleId: string,
  items: SaleItemRow[],
): Promise<SaleItemDto[]> {
  const rows = await tx
    .insert(saleItems)
    .values(
      items.map((i) => ({
        saleId,
        tenantId,
        productId: i.productId,
        nameSnapshot: i.nameSnapshot,
        unit: i.unit,
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity.toString(),
        subtotalCents: i.subtotalCents,
      })),
    )
    .returning();
  return rows.map(toSaleItemDto);
}

/** Vendas no intervalo [from, to) do tenant, mais recentes primeiro (RF09). */
export async function selectSalesOfDay(
  tx: Executor,
  tenantId: string,
  from: Date,
  to: Date,
): Promise<SaleDto[]> {
  const saleRows = await tx
    .select()
    .from(sales)
    .where(
      and(
        eq(sales.tenantId, tenantId),
        gte(sales.createdAt, from),
        lt(sales.createdAt, to),
      ),
    )
    .orderBy(desc(sales.createdAt));
  if (saleRows.length === 0) return [];

  const ids = saleRows.map((s) => s.id);
  const itemRows = await tx
    .select()
    .from(saleItems)
    .where(and(eq(saleItems.tenantId, tenantId), inArray(saleItems.saleId, ids)));

  const bySale = new Map<string, SaleItemDto[]>();
  for (const it of itemRows) {
    const list = bySale.get(it.saleId) ?? [];
    list.push(toSaleItemDto(it));
    bySale.set(it.saleId, list);
  }

  return saleRows.map((s) => toSaleDto(s, bySale.get(s.id) ?? []));
}
