import { notFound } from "next/navigation";

import { getProductAction } from "@/app/(app)/products/actions";
import { listProductCategoriesAction } from "@/app/(app)/products/categories/actions";
import { EditProductForm } from "@/components/products/EditProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, categoriesResult] = await Promise.all([
    getProductAction({ id }),
    listProductCategoriesAction(),
  ]);
  if (!result.ok) notFound();
  // Falha na listagem não bloqueia a edição — select mostra só "Sem categoria".
  const categories = categoriesResult.ok ? categoriesResult.data : [];

  return (
    <div className="grid gap-6 px-4 md:px-7 py-6">
      <h1 className="text-xl font-semibold">Editar produto</h1>
      <EditProductForm product={result.data} categories={categories} />
    </div>
  );
}
