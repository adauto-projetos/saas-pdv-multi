import { PageCard } from "@/components/ui/PageCard";
import { centsToBRL } from "@/lib/format/money";
import type { ProfitDto } from "@/types/profit";

/**
 * RF02/RF03 — resumo do lucro do período: hero value + 2x2 stats grid.
 * Lucro verde se ≥0, vermelho se <0. Avisa itens sem custo (RN04).
 */
export function ProfitSummaryCard({ profit }: { profit: ProfitDto }) {
  const loss = profit.profitCents < 0;

  const stats = [
    { label: "Faturamento", value: centsToBRL(profit.revenueCents), borderRight: true, borderBottom: true },
    { label: "Custo", value: centsToBRL(profit.costCents), borderRight: false, borderBottom: true },
    { label: "Margem", value: `${profit.marginPercent}%`, borderRight: true, borderBottom: false },
    { label: "Vendas", value: profit.salesCount, borderRight: false, borderBottom: false },
  ];

  return (
    <PageCard>
      <div className="px-5 pb-4 pt-5">
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.7px] text-gray-400">
          Lucro do período
        </div>
        <div
          className={[
            "text-[38px] font-bold leading-tight tracking-[-1px]",
            loss ? "text-red-500" : "text-green-600",
          ].join(" ")}
        >
          {centsToBRL(profit.profitCents)}
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-gray-100">
        {stats.map(({ label, value, borderRight, borderBottom }) => (
          <div
            key={label}
            className={[
              "px-5 py-4",
              borderRight ? "border-r border-gray-100" : "",
              borderBottom ? "border-b border-gray-100" : "",
            ].join(" ")}
          >
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.5px] text-gray-400">
              {label}
            </div>
            <div className="text-[20px] font-bold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      {profit.itemsWithoutCost > 0 ? (
        <div className="border-t border-gray-100 px-5 py-3 text-[12px] text-amber-700">
          Lucro superestimado: {profit.itemsWithoutCost}{" "}
          {profit.itemsWithoutCost === 1
            ? "item sem custo cadastrado"
            : "itens sem custo cadastrado"}{" "}
          (contam como custo zero).
        </div>
      ) : null}
    </PageCard>
  );
}
