import { listOpenComandasAction } from "@/app/(app)/comandas/actions";
import { ComandasScreen } from "@/components/comandas/ComandasScreen";

export const dynamic = "force-dynamic";

export default async function ComandasPage() {
  const result = await listOpenComandasAction();

  if (!result.ok) {
    return (
      <div className="grid gap-8">
        <h1 className="text-xl font-semibold">Comandas</h1>
        <p className="text-destructive">
          Não foi possível carregar as comandas.
        </p>
      </div>
    );
  }

  return <ComandasScreen openComandas={result.data} />;
}
