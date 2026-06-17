import { PageCard } from "@/components/ui/PageCard";
import { centsToBRL } from "@/lib/format/money";

/** Card do saldo corrente do caixa (RF03). */
export function CashBalanceCard({ balanceCents }: { balanceCents: number }) {
  const negative = balanceCents < 0;

  return (
    <PageCard className="p-5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.7px] text-gray-400">
        Saldo do caixa
      </div>
      <div
        className={[
          "text-[32px] font-bold leading-tight tracking-tight",
          negative ? "text-red-500" : "text-green-600",
        ].join(" ")}
      >
        {centsToBRL(balanceCents)}
      </div>
      <div className="mt-1.5 text-[12px] text-gray-400">Saldo atual acumulado</div>
    </PageCard>
  );
}
