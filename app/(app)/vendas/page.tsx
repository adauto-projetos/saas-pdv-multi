import { listTodaySalesAction } from "@/app/(app)/caixa/actions";
import { TodaySalesList } from "@/components/caixa/TodaySalesList";

export const dynamic = "force-dynamic";

export default async function VendasPage() {
  const result = await listTodaySalesAction();

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">Vendas de hoje</h1>
      {result.ok ? (
        <TodaySalesList sales={result.data} />
      ) : (
        <p className="text-destructive">Não foi possível carregar as vendas.</p>
      )}
    </div>
  );
}
