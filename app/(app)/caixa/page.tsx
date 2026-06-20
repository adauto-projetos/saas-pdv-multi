import { listProductsAction } from "@/app/(app)/products/actions";
import { CashierScreen } from "@/components/caixa/CashierScreen";

export const dynamic = "force-dynamic";

export default async function CaixaPage() {
  const result = await listProductsAction();
  const products = result.ok ? result.data : [];
  return <CashierScreen products={products} />;
}
