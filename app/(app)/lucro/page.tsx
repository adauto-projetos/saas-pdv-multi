import { getProfitAction } from "@/app/(app)/lucro/actions";
import { ProfitFilter } from "@/components/lucro/ProfitFilter";

export const dynamic = "force-dynamic";

export default async function LucroPage() {
  const result = await getProfitAction();

  return (
    <div className="flex flex-col gap-5 px-7 py-6 max-w-[680px]">
      {result.ok ? (
        <ProfitFilter initial={result.data} />
      ) : (
        <p className="text-sm text-destructive">
          Não foi possível carregar o lucro do período.
        </p>
      )}
    </div>
  );
}
