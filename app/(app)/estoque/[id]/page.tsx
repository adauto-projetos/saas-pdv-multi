import { notFound } from "next/navigation";

import { getProductAction } from "@/app/(app)/products/actions";
import { MovementHistory } from "@/components/estoque/MovementHistory";

export const dynamic = "force-dynamic";

export default async function MovimentacoesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProductAction({ id });
  if (!result.ok) notFound();

  return (
    <div className="grid gap-6 px-4 md:px-7 py-6">
      <div>
        <h1 className="text-xl font-semibold">Movimentações</h1>
        <p className="text-sm text-muted-foreground">
          {result.data.name} · estoque atual {result.data.stockQuantity}
        </p>
      </div>
      <MovementHistory productId={id} />
    </div>
  );
}
