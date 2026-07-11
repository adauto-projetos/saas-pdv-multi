import Link from "next/link";

import { listProductCategoriesAction } from "@/app/(app)/products/categories/actions";
import { CategoryManager } from "@/components/products/CategoryManager";

export const dynamic = "force-dynamic";

/**
 * Gestão de categorias de produto (RF05/RF06) — rota própria, não modal
 * (precedente: /financeiro/clientes). O RSC lista via action; as mutações
 * acontecem no CategoryManager (client) com revalidate/refresh.
 */
export default async function ProductCategoriesPage() {
  const result = await listProductCategoriesAction();

  return (
    <div className="flex flex-col gap-6 px-4 md:px-7 py-6 max-w-[720px]">
      <div className="flex flex-col gap-1">
        <Link
          href="/products"
          className="text-sm text-primary hover:underline"
        >
          ← Voltar para produtos
        </Link>
        <h1 className="text-xl font-semibold">Categorias de produto</h1>
        <p className="text-sm text-muted-foreground">
          Crie, renomeie, recolora e reordene as categorias da loja. A ordem
          daqui vale para o formulário de produto e para os chips do caixa.
        </p>
      </div>

      {!result.ok ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar as categorias.
        </p>
      ) : (
        <CategoryManager categories={result.data} />
      )}
    </div>
  );
}
