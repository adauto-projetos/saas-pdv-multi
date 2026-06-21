"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { OpenComandaDialog } from "@/components/comandas/OpenComandaDialog";

const TITLE_MAP: Record<string, string> = {
  "/caixa": "Caixa",
  "/vendas": "Vendas de hoje",
  "/products": "Produtos",
  "/estoque": "Estoque",
  "/comandas": "Comandas",
  "/financeiro": "Financeiro",
  "/lucro": "Lucro",
  "/settings": "Configurações",
};

function getTitle(pathname: string): string {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  const prefix = Object.keys(TITLE_MAP).find((k) =>
    pathname.startsWith(k + "/"),
  );
  return prefix ? TITLE_MAP[prefix] : "";
}

export function AppTopBar() {
  const pathname = usePathname();

  return (
    <div
      className="sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6"
      style={{
        height: "calc(52px + env(safe-area-inset-top))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <span className="text-[15px] font-semibold tracking-tight text-gray-900">
        {getTitle(pathname)}
      </span>
      <div>
        {pathname === "/products" && (
          <Link
            href="/products/new"
            className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-green-700"
          >
            + Novo produto
          </Link>
        )}
        {pathname === "/comandas" && <OpenComandaDialog />}
      </div>
    </div>
  );
}
