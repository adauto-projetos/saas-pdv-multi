import { getProfitAction } from "@/app/(app)/lucro/actions";
import { ProfitFilter } from "@/components/lucro/ProfitFilter";

export const dynamic = "force-dynamic";

export default async function LucroPage() {
  const result = await getProfitAction();

  return (
    <div className="grid gap-8">
      <h1 className="text-xl font-semibold">Lucro</h1>

      <section className="grid gap-3">
        {result.ok ? (
          <ProfitFilter initial={result.data} />
        ) : (
          <p className="text-destructive">
            Não foi possível carregar o lucro do período.
          </p>
        )}
      </section>
    </div>
  );
}
