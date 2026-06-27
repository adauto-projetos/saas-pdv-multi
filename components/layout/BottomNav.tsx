"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import {
  BarChart3,
  ClipboardList,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Package,
  ScrollText,
  Settings,
  Shield,
  TrendingUp,
  UserCog,
  Wallet,
} from "lucide-react";

import { logoutAction } from "@/app/(auth)/actions";
import type { PermissionCode } from "@/lib/validation/usuarios";

const NAV_PRIMARY = [
  { href: "/caixa", label: "Caixa", icon: LayoutDashboard, color: "#4f46e5", perm: "caixa" },
  { href: "/comandas", label: "Comandas", icon: ClipboardList, color: "#e11d48", perm: "comanda" },
  { href: "/products", label: "Produtos", icon: Package, color: "#ea580c", perm: "produtos" },
  { href: "/financeiro/caixa", label: "Financeiro", icon: Wallet, color: "#16a34a", perm: "financeiro" },
] as const;

const NAV_DRAWER = [
  { href: "/vendas", label: "Vendas", icon: BarChart3, color: "#2563eb", perm: "vendas" },
  { href: "/estoque", label: "Estoque", icon: Layers, color: "#0d9488", perm: "estoque" },
  { href: "/lucro", label: "Lucro", icon: TrendingUp, color: "#d97706", perm: "financeiro" },
  { href: "/usuarios", label: "Usuários", icon: UserCog, color: "#0891b2", perm: "gerenciar_usuarios" },
  { href: "/auditoria", label: "Auditoria", icon: ScrollText, color: "#9333ea", perm: "gerenciar_usuarios" },
  { href: "/settings", label: "Configurações", icon: Settings, color: "#64748b", perm: "loja" },
  { href: "/perfil", label: "Meu perfil", icon: KeyRound, color: "#475569", perm: undefined },
] as const;

/** Chip arredondado com ícone colorido. Ativo → preenchido na cor. */
function chipStyle(color: string, active: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: 9,
    flexShrink: 0,
    background: active ? color : `${color}1f`,
    color: active ? "#ffffff" : color,
  };
}

interface BottomNavProps {
  className?: string;
  isFounder?: boolean;
  permissions?: PermissionCode[];
  canSeeAll?: boolean;
}

export function BottomNav({
  className,
  isFounder = false,
  permissions = [],
  canSeeAll = false,
}: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const granted = new Set(permissions);
  const seeAll = canSeeAll || isFounder;
  const navPrimary = NAV_PRIMARY.filter(
    (i) => !i.perm || seeAll || granted.has(i.perm),
  );
  const navDrawer = NAV_DRAWER.filter(
    (i) => !i.perm || seeAll || granted.has(i.perm),
  );

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
          className="fixed bottom-16 left-4 right-4 z-50 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg"
        >
          {navDrawer.map(({ href, label, icon: Icon, color }) => {
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
                  padding: "12px 16px",
                  textDecoration: "none",
                  color: active ? color : "#1e293b",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                <span style={chipStyle(color, active)}>
                  <Icon size={17} strokeWidth={2} />
                </span>
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
                padding: "12px 16px",
                textDecoration: "none",
                color: "#1e293b",
                fontWeight: 700,
                fontSize: 15,
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <span style={chipStyle("#dc2626", pathname.startsWith("/superadmin"))}>
                <Shield size={17} strokeWidth={2} />
              </span>
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
              padding: "12px 16px",
              background: "none",
              border: "none",
              borderTop: "1px solid #f1f5f9",
              color: "#dc2626",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              font: "inherit",
            }}
          >
            <span style={chipStyle("#dc2626", false)}>
              <LogOut size={17} strokeWidth={2} />
            </span>
            Sair
          </button>
        </div>
      )}

      <nav
        className={`fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white${className ? ` ${className}` : ""}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-around">
          {navPrimary.map(({ href, label, icon: Icon, color }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-[3px] px-3 py-1.5"
                style={{
                  textDecoration: "none",
                  color: active ? "#4f46e5" : "#64748b",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 26,
                    borderRadius: 9,
                    background: active ? "#eef2ff" : "transparent",
                    color: color,
                    transition: "background 0.12s",
                  }}
                >
                  <Icon size={20} strokeWidth={2} />
                </span>
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-[3px] px-3 py-1.5"
            aria-label="Mais opções"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#64748b",
              font: "inherit",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 26,
              }}
            >
              <MoreHorizontal size={20} strokeWidth={2} />
            </span>
            <span className="text-[10px] font-semibold">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
