import { withUserRls } from "@/db/rls";
import { endOfTodayBrazil, startOfTodayBrazil } from "@/lib/business-day";
import type { ProfitFilterInput } from "@/lib/validation/profit";
import type { AuthContext } from "@/types/product";
import type { ProfitDto } from "@/types/profit";

import * as data from "./profit-data";

/**
 * Serviço de lucro do período (0005F). Leitura sob `withUserRls` (RN01). Lucro =
 * faturamento − custo (PODE ser negativo — RN02, sem clamp). Margem % = 0 quando
 * faturamento = 0 (RNF01, sem divisão por zero).
 */

/**
 * RF02/RF03 — lucro do período. Sem filtro → período = HOJE (fuso do servidor),
 * mesmo recorte de `listTodaySales` (midnight today → +24h). `itemsWithoutCost`
 * sinaliza itens sem custo (lucro superestimado — RN04).
 */
export async function getProfitByPeriod(
  ctx: AuthContext,
  filter: ProfitFilterInput,
): Promise<ProfitDto> {
  const { from, to } = resolvePeriod(filter);

  const agg = await withUserRls(ctx.userId, (tx) =>
    data.selectProfitByPeriod(tx, ctx.tenantId, from, to),
  );

  const profitCents = agg.revenueCents - agg.costCents;
  const marginPercent =
    agg.revenueCents > 0
      ? Math.round((profitCents / agg.revenueCents) * 100)
      : 0;

  return {
    revenueCents: agg.revenueCents,
    costCents: agg.costCents,
    profitCents,
    marginPercent,
    itemsWithoutCost: agg.itemsWithoutCost,
    salesCount: agg.salesCount,
  };
}

/**
 * Resolve o intervalo [from, to). Default = hoje (fuso do Brasil, UTC-3 —
 * hotfix 0027H), espelhando `listTodaySales`. Datas inválidas no filtro caem
 * no default.
 */
function resolvePeriod(filter: ProfitFilterInput): { from: Date; to: Date } {
  const todayStart = startOfTodayBrazil();
  const todayEnd = endOfTodayBrazil();

  const fromDate = filter.from ? new Date(filter.from) : null;
  const toDate = filter.to ? new Date(filter.to) : null;
  const from =
    fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : todayStart;
  const to = toDate && !Number.isNaN(toDate.getTime()) ? toDate : todayEnd;
  return { from, to };
}
