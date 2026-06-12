import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { getAuthUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/products" className="font-semibold">
            SAAS PDV<span className="text-primary">.multi</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/caixa" className="font-medium hover:text-primary">
              Caixa
            </Link>
            <Link href="/vendas" className="hover:text-primary">
              Vendas
            </Link>
            <Link href="/products" className="hover:text-primary">
              Produtos
            </Link>
            <Link href="/estoque" className="hover:text-primary">
              Estoque
            </Link>
            <Link href="/financeiro/caixa" className="hover:text-primary">
              Financeiro
            </Link>
            <Link href="/settings" className="hover:text-primary">
              Configurações
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
