import Link from "next/link";

import { listProductsAction } from "@/app/(app)/products/actions";
import { ProductsTable } from "@/components/products/ProductsTable";
import { PageCard } from "@/components/ui/PageCard";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const result = await listProductsAction();

  return (
    <div className="flex flex-col gap-5 px-7 py-6">
      {!result.ok ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar os produtos.
        </p>
      ) : result.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="font-medium text-gray-900">Nenhum produto ainda</p>
          <p className="mt-1 text-sm text-gray-400">
            Cadastre o primeiro produto para começar a vender.
          </p>
          <Link
            href="/products/new"
            className="mt-4 inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-green-700"
          >
            + Adicionar produto
          </Link>
        </div>
      ) : (
        <PageCard>
          <ProductsTable products={result.data} />
        </PageCard>
      )}
    </div>
  );
}
