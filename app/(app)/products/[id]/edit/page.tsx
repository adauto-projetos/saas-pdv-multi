import { notFound } from "next/navigation";

import { getProductAction } from "@/app/(app)/products/actions";
import { EditProductForm } from "@/components/products/EditProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProductAction({ id });
  if (!result.ok) notFound();

  return (
    <div className="grid gap-6 px-4 md:px-7 py-6">
      <h1 className="text-xl font-semibold">Editar produto</h1>
      <EditProductForm product={result.data} />
    </div>
  );
}
