"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  ClipboardList,
  Layers,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Package,
  Settings,
  Shield,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { logoutAction } from "@/app/(auth)/actions";

const NAV_PRIMARY = [
  { href: "/caixa", label: "Caixa", icon: LayoutDashboard },
  { href: "/comandas", label: "Comandas", icon: ClipboardList },
  { href: "/products", label: "Produtos", icon: Package },
  { href: "/financeiro/caixa", label: "Financeiro", icon: Wallet },
] as const;

const NAV_DRAWER = [
  { href: "/vendas", label: "Vendas", icon: BarChart3 },
  { href: "/estoque", label: "Estoque", icon: Layers },
  { href: "/lucro", label: "Lucro", icon: TrendingUp },
  { href: "/settings", label: "Configurações", icon: Settings },
] as const;

interface BottomNavProps {
  className?: string;
  isFounder?: boolean;
}

export function BottomNav({ className, isFounder = false }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleSignOut() {
    setDrawerOpen(false);
    await logoutAction();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string): boolean {
    if (href === "/financeiro/caixa") return pathname.startsWith("/financeiro");
    if (href === "/products") return pathname.startsWith("/products");
    if (href === "/estoque") return pathname.startsWith("/estoque");
    return pathname === href;
  }

  return (
    <>
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40"
          role="button"
          tabIndex={-1}
          aria-label="Fechar menu"
          onClick={() => setDrawerOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setDrawerOpen(false)}
        />
      )}

      {drawerOpen && (
        <div
          role="menu"
          className="fixed bottom-16 left-4 right-4 z-50 rounded-2xl border border-gray-100 bg-white shadow-lg"
        >
          {NAV_DRAWER.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setDrawerOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 20px",
                  textDecoration: "none",
                  color: active ? "#4f46e5" : "#475569",
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                <Icon size={18} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}

          {isFounder && (
            <Link
              href="/superadmin"
              role="menuitem"
              onClick={() => setDrawerOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 20px",
                textDecoration: "none",
                color: "#4f46e5",
                fontWeight: 600,
                fontSize: 15,
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <Shield size={18} strokeWidth={1.8} />
              Super Admin
            </Link>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: "14px 20px",
              background: "none",
              border: "none",
              borderTop: "1px solid #f1f5f9",
              color: "#dc2626",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
              font: "inherit",
            }}
          >
            <LogOut size={18} strokeWidth={1.8} />
            Sair
          </button>
        </div>
      )}

      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white${className ? ` ${className}` : ""}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-around">
          {NAV_PRIMARY.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-[3px] px-3 py-2"
                style={{
                  textDecoration: "none",
                  color: active ? "#4f46e5" : "#94a3b8",
                }}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: active ? "#4f46e5" : "#94a3b8" }}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-[3px] px-3 py-2"
            aria-label="Mais opções"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              font: "inherit",
            }}
          >
            <MoreHorizontal size={20} strokeWidth={1.8} />
            <span className="text-[10px] font-semibold">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
