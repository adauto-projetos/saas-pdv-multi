import { listLowStockAction } from "@/app/(app)/estoque/actions";
import { LowStockList } from "@/components/estoque/LowStockList";
import { StockMovementDialog } from "@/components/estoque/StockMovementDialog";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const result = await listLowStockAction();

  return (
    <div className="grid gap-8">
      <h1 className="text-xl font-semibold">Estoque</h1>

      <section className="grid gap-3">
        <h2 className="font-medium">Nova movimentação</h2>
        <StockMovementDialog />
      </section>

      <section className="grid gap-3">
        <h2 className="font-medium">Estoque baixo</h2>
        {result.ok ? (
          <LowStockList products={result.data} />
        ) : (
          <p className="text-destructive">
            Não foi possível carregar o estoque baixo.
          </p>
        )}
      </section>
    </div>
  );
}
