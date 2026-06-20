import Link from "next/link";

import { listProductsAction } from "@/app/(app)/products/actions";
import { ProductsTable } from "@/components/products/ProductsTable";
import { PageCard } from "@/components/ui/PageCard";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const result = await listProductsAction();

  return (
    <div className="flex flex-col gap-5 px-7 py-6">
      <div className="flex items-center justify-between">
        <h1
          style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 800,
            fontSize: 24,
            margin: 0,
            color: "#0f172a",
          }}
        >
          Produtos
        </h1>
        <Link
          href="/products/new"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 46,
            padding: "0 20px",
            border: "none",
            borderRadius: 13,
            background: "#4f46e5",
            color: "#fff",
            fontSize: 14.5,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 6px 16px rgba(79,70,229,.28)",
          }}
        >
          + Novo produto
        </Link>
      </div>

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
            className="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700"
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
