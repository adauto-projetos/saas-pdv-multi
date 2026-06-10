import Link from "next/link";

import { listProductsAction } from "@/app/(app)/products/actions";
import { ProductsTable } from "@/components/products/ProductsTable";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const result = await listProductsAction();

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Produtos</h1>
        <Link
          href="/products/new"
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Novo produto
        </Link>
      </div>

      {!result.ok ? (
        <p className="text-destructive">
          Não foi possível carregar os produtos.
        </p>
      ) : result.data.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Nenhum produto ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre o primeiro produto para começar a vender.
          </p>
          <Link
            href="/products/new"
            className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Adicionar produto
          </Link>
        </div>
      ) : (
        <ProductsTable products={result.data} />
      )}
    </div>
  );
}
