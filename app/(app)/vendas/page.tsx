import { listTodaySalesAction } from "@/app/(app)/caixa/actions";
import { TodaySalesList } from "@/components/caixa/TodaySalesList";

export const dynamic = "force-dynamic";

export default async function VendasPage() {
  const result = await listTodaySalesAction();

  return (
    <div className="flex flex-col gap-5 px-7 py-6">
      {result.ok ? (
        <TodaySalesList sales={result.data} />
      ) : (
        <p className="text-sm text-destructive">Não foi possível carregar as vendas.</p>
      )}
    </div>
  );
}
