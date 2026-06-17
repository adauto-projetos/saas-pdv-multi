"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Layers,
  LayoutDashboard,
  Package,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { SignOutButton } from "@/components/auth/SignOutButton";

const NAV_PRIMARY = [
  { href: "/caixa", label: "Caixa", icon: LayoutDashboard },
  { href: "/vendas", label: "Vendas", icon: BarChart3 },
  { href: "/products", label: "Produtos", icon: Package },
  { href: "/estoque", label: "Estoque", icon: Layers },
  { href: "/comandas", label: "Comandas", icon: ClipboardList },
] as const;

const NAV_SECONDARY = [
  { href: "/financeiro/caixa", label: "Financeiro", icon: Wallet },
  { href: "/lucro", label: "Lucro", icon: TrendingUp },
  { href: "/settings", label: "Configurações", icon: Settings },
] as const;

interface AppSidebarProps {
  userEmail: string;
}

export function AppSidebar({ userEmail }: AppSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/financeiro/caixa") return pathname.startsWith("/financeiro");
    if (href === "/products") return pathname.startsWith("/products");
    if (href === "/estoque") return pathname.startsWith("/estoque");
    if (href === "/settings") return pathname.startsWith("/settings");
    return pathname === href;
  }

  const initial = userEmail.charAt(0).toUpperCase() || "U";

  return (
    <aside
      className="flex h-screen w-[220px] flex-shrink-0 flex-col overflow-hidden"
      style={{ background: "var(--pdv-sidebar)" }}
    >
      {/* Logo */}
      <div
        className="px-[18px] pb-4 pt-[22px]"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="text-[19px] font-bold leading-none tracking-tight text-white">
          PDV<span className="font-light text-blue-400">.multi</span>
        </div>
        <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.9px] text-slate-400 opacity-70">
          Ponto de Venda
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-px overflow-y-auto px-2 py-[10px]">
        {NAV_PRIMARY.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={[
              "flex items-center gap-[10px] rounded-[7px] px-3 py-[9px] text-[13px] transition-colors",
              isActive(href)
                ? "bg-indigo-600/[.18] font-semibold text-indigo-200"
                : "font-normal text-slate-400/70 hover:text-slate-300",
            ].join(" ")}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        ))}

        <div
          className="mx-1 my-2 h-px"
          style={{ background: "rgba(255,255,255,0.05)" }}
        />

        {NAV_SECONDARY.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={[
              "flex items-center gap-[10px] rounded-[7px] px-3 py-[9px] text-[13px] transition-colors",
              isActive(href)
                ? "bg-indigo-600/[.18] font-semibold text-indigo-200"
                : "font-normal text-slate-400/70 hover:text-slate-300",
            ].join(" ")}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* User footer */}
      <div
        className="flex items-center gap-[10px] px-[14px] py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-400 text-[13px] font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-slate-200">
            {userEmail}
          </div>
          <div className="text-[10px] text-slate-400">Admin</div>
        </div>
        <div className="text-slate-400">
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
