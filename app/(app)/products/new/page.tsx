import { listProductCategoriesAction } from "@/app/(app)/products/categories/actions";
import { getDefaultMarkupAction } from "@/app/(app)/settings/actions";
import { NewProductForm } from "@/components/products/NewProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const [markupResult, categoriesResult] = await Promise.all([
    getDefaultMarkupAction(),
    listProductCategoriesAction(),
  ]);
  const defaultMarkupPercent = markupResult.ok
    ? markupResult.data.defaultMarkupPercent
    : 30;
  // Falha na listagem não bloqueia o cadastro — o select fica só com
  // "Sem categoria" e a criação inline (RF04) segue disponível.
  const categories = categoriesResult.ok ? categoriesResult.data : [];

  return (
    <div className="grid gap-6 px-4 md:px-7 py-6">
      <h1 className="text-xl font-semibold">Novo produto</h1>
      <NewProductForm
        defaultMarkupPercent={defaultMarkupPercent}
        categories={categories}
      />
    </div>
  );
}
