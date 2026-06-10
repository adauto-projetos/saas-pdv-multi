import { getDefaultMarkupAction } from "@/app/(app)/settings/actions";
import { NewProductForm } from "@/components/products/NewProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const result = await getDefaultMarkupAction();
  const defaultMarkupPercent = result.ok ? result.data.defaultMarkupPercent : 30;

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">Novo produto</h1>
      <NewProductForm defaultMarkupPercent={defaultMarkupPercent} />
    </div>
  );
}
