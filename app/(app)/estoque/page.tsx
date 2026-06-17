import { listLowStockAction } from "@/app/(app)/estoque/actions";
import { LowStockList } from "@/components/estoque/LowStockList";
import { StockMovementDialog } from "@/components/estoque/StockMovementDialog";
import { PageCard, PageCardHeader } from "@/components/ui/PageCard";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const result = await listLowStockAction();

  return (
    <div className="flex flex-col gap-5 px-7 py-6 max-w-[680px]">
      <PageCard>
        <PageCardHeader>Nova movimentação</PageCardHeader>
        <div className="p-5">
          <StockMovementDialog />
        </div>
      </PageCard>

      <PageCard>
        <div className="flex items-center gap-[9px] border-b border-gray-100 px-5 py-[14px]">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-sm font-semibold text-gray-900">Estoque baixo</span>
        </div>
        {result.ok ? (
          <LowStockList products={result.data} />
        ) : (
          <p className="px-5 py-4 text-sm text-destructive">
            Não foi possível carregar o estoque baixo.
          </p>
        )}
      </PageCard>
    </div>
  );
}
