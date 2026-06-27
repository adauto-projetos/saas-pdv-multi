import { getOpenSessionAction } from "@/app/(app)/lucro/actions";
import { listProductsAction } from "@/app/(app)/products/actions";
import { CaixaShell } from "@/components/caixa/CaixaShell";

export const dynamic = "force-dynamic";

export default async function CaixaPage() {
  const [productsResult, sessionResult] = await Promise.all([
    listProductsAction(),
    getOpenSessionAction(),
  ]);
  const products = productsResult.ok ? productsResult.data : [];
  // session=undefined → sem permissão "caixa" (action falhou); CaixaShell esconde o
  // botão do turno. session=null → permissão ok mas sem turno aberto.
  const session = sessionResult.ok ? sessionResult.data : undefined;
  return <CaixaShell products={products} session={session} />;
}
