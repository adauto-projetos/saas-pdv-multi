import { getCashBalanceAction } from "@/app/(app)/financeiro/caixa/actions";
import { CashBalanceCard } from "@/components/financeiro/CashBalanceCard";
import { CashMovementDialog } from "@/components/financeiro/CashMovementDialog";
import { CashStatement } from "@/components/financeiro/CashStatement";

export const dynamic = "force-dynamic";

export default async function CaixaPage() {
  const result = await getCashBalanceAction();

  return (
    <div className="grid gap-8">
      <h1 className="text-xl font-semibold">Caixa</h1>

      <section className="grid gap-3">
        {result.ok ? (
          <CashBalanceCard balanceCents={result.data.balanceCents} />
        ) : (
          <p className="text-destructive">
            Não foi possível carregar o saldo do caixa.
          </p>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-medium">Nova movimentação</h2>
        <CashMovementDialog />
      </section>

      <section className="grid gap-3">
        <h2 className="font-medium">Extrato</h2>
        <CashStatement />
      </section>
    </div>
  );
}
