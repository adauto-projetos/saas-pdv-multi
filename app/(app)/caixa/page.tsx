import { listProductsAction } from "@/app/(app)/products/actions";
import { CaixaShell } from "@/components/caixa/CaixaShell";

export const dynamic = "force-dynamic";

export default async function CaixaPage() {
  const result = await listProductsAction();
  const products = result.ok ? result.data : [];
  return <CaixaShell products={products} />;
}
