import { and, eq, gte, lt, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { saleItems, sales } from "@/db/schema";

/**
 * Data layer do lucro (0005F). Lucro é DERIVADO on-the-fly — agregação direta
 * sobre `sale_items` × `sales` por período, sem tabela de cache (RNF01). Executor
 * = `db` direto OU `RlsTx`; sempre filtra por `tenant_id` (RN01).
 */
type Executor = Pick<Database, "insert" | "select" | "update">;

/** Resultado bruto da agregação (já em inteiros de centavos). */
export type ProfitAggregate = {
  revenueCents: number;
  costCents: number;
  itemsWithoutCost: number;
  salesCount: number;
};

/**
 * Agrega lucro do período: junta `sale_items` a `sales` filtrando por
 * `sales.created_at ∈ [from, to)` e tenant (RN05 — só vendas, nunca sangria/conta).
 * - revenueCents = Σ subtotal_cents (RF02)
 * - costCents = Σ (COALESCE(cost_cents_snapshot, 0) × quantity) (RN04: sem custo → 0)
 * - itemsWithoutCost = COUNT de itens com cost_cents_snapshot NULL (RF03/RN04)
 * - salesCount = COUNT(DISTINCT sales.id)
 *
 * `quantity` é numeric (string no Postgres) — o produto custo×qtd é arredondado
 * para inteiro de centavos no SQL (round); o `Number()` materializa o resultado.
 */
export async function selectProfitByPeriod(
  tx: Executor,
  tenantId: string,
  from: Date,
  to: Date,
): Promise<ProfitAggregate> {
  const rows = await tx
    .select({
      revenue: sql<string>`coalesce(sum(${saleItems.subtotalCents}), 0)`,
      cost: sql<string>`coalesce(sum(round(coalesce(${saleItems.costCentsSnapshot}, 0) * ${saleItems.quantity})), 0)`,
      itemsWithoutCost: sql<string>`count(*) filter (where ${saleItems.costCentsSnapshot} is null)`,
      salesCount: sql<string>`count(distinct ${sales.id})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(
      and(
        eq(sales.tenantId, tenantId),
        gte(sales.createdAt, from),
        lt(sales.createdAt, to),
      ),
    );

  const row = rows[0];
  return {
    revenueCents: Math.round(Number(row?.revenue ?? 0)),
    costCents: Math.round(Number(row?.cost ?? 0)),
    itemsWithoutCost: Number(row?.itemsWithoutCost ?? 0),
    salesCount: Number(row?.salesCount ?? 0),
  };
}
