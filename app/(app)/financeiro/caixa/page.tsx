import { getCashBalanceAction } from "@/app/(app)/financeiro/caixa/actions";
import { getOpenSessionAction } from "@/app/(app)/lucro/actions";
import { CashBalanceCard } from "@/components/financeiro/CashBalanceCard";
import { CashMovementDialog } from "@/components/financeiro/CashMovementDialog";
import { CashSessionPanel } from "@/components/financeiro/CashSessionPanel";
import { CashStatement } from "@/components/financeiro/CashStatement";
import { SessionHistory } from "@/components/financeiro/SessionHistory";
import { PageCard, PageCardHeader } from "@/components/ui/PageCard";

export const dynamic = "force-dynamic";

export default async function CaixaPage() {
  const result = await getCashBalanceAction();
  const sessionResult = await getOpenSessionAction();

  return (
    <div className="flex flex-col gap-5 px-7 py-6 max-w-[820px]">
      <h1 style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: 24, margin: 0, color: "#0f172a" }}>
        Financeiro
      </h1>
      {/* Turno + Saldo em grid 2-col */}
      <div className="grid grid-cols-2 gap-4">
        {sessionResult.ok ? (
          <CashSessionPanel session={sessionResult.data} />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-destructive">
              Não foi possível carregar o turno de caixa.
            </p>
          </div>
        )}
        {result.ok ? (
          <CashBalanceCard balanceCents={result.data.balanceCents} />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-destructive">
              Não foi possível carregar o saldo do caixa.
            </p>
          </div>
        )}
      </div>

      {/* Nova movimentação */}
      <PageCard>
        <PageCardHeader>Nova movimentação</PageCardHeader>
        <div className="p-5">
          <CashMovementDialog />
        </div>
      </PageCard>

      {/* Extrato */}
      <CashStatement />

      {/* Histórico de turnos */}
      <PageCard>
        <PageCardHeader>Histórico de turnos</PageCardHeader>
        <div className="p-5">
          <SessionHistory />
        </div>
      </PageCard>
    </div>
  );
}
