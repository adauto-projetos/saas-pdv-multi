import { getProfitAction } from "@/app/(app)/lucro/actions";
import { ProfitFilter } from "@/components/lucro/ProfitFilter";

export const dynamic = "force-dynamic";

export default async function LucroPage() {
  const result = await getProfitAction();

  return (
    <div className="flex flex-col gap-5 px-7 py-6 max-w-[680px]">
      <h1 style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: 24, margin: 0, color: "#0f172a" }}>
        Lucro
      </h1>
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
