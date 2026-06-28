"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  HelpCircle,
  KeyRound,
  Layers,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  Shield,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { HelpTip } from "@/components/ui/help-tip";
import { useHelp } from "@/lib/help/help-context";
import type { PermissionCode } from "@/lib/validation/usuarios";

const COLLAPSE_KEY = "pdv_sidebar_collapsed";

// Store externo do estado recolhido/expandido, persistido em localStorage. Via
// useSyncExternalStore evita setState-em-effect e mismatch de hidratação (servidor
// sempre expandido; o cliente reconcilia após montar).
let collapsedCache: boolean | null = null;
const collapseListeners = new Set<() => void>();

function collapsedSnapshot(): boolean {
  if (collapsedCache === null) {
    collapsedCache =
      typeof window !== "undefined" &&
      window.localStorage.getItem(COLLAPSE_KEY) === "1";
  }
  return collapsedCache;
}

function collapsedServerSnapshot(): boolean {
  return false;
}

function subscribeCollapsed(cb: () => void): () => void {
  collapseListeners.add(cb);
  return () => collapseListeners.delete(cb);
}

function setCollapsedStore(value: boolean): void {
  collapsedCache = value;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  }
  collapseListeners.forEach((l) => l());
}

// `perm` = código de permissão exigido para ver o item (RF11). `undefined` = sempre visível.
const NAV_PRIMARY = [
  { href: "/caixa",    label: "Caixa",    icon: LayoutDashboard, color: "#4f46e5", tip: "PDV — registre vendas, bipe produtos e feche o caixa", perm: "caixa" },
  { href: "/vendas",   label: "Vendas",   icon: BarChart3,       color: "#2563eb", tip: "Histórico de todas as vendas realizadas", perm: "vendas" },
  { href: "/products", label: "Produtos", icon: Package,         color: "#ea580c", tip: "Cadastre e edite o catálogo de produtos", perm: "produtos" },
  { href: "/estoque",  label: "Estoque",  icon: Layers,          color: "#0d9488", tip: "Movimentações e controle de estoque", perm: "estoque" },
  { href: "/comandas", label: "Comandas", icon: ClipboardList,   color: "#e11d48", tip: "Mesas e pedidos em aberto", perm: "comanda" },
] as const;

const NAV_SECONDARY = [
  { href: "/financeiro/caixa",    label: "Financeiro",    icon: Wallet,     color: "#16a34a", tip: "Fluxo de caixa e resumo financeiro", perm: "financeiro" },
  { href: "/financeiro/clientes", label: "Clientes",      icon: Users,      color: "#7c3aed", tip: "Cadastro de clientes e controle de fiado", perm: "financeiro" },
  { href: "/lucro",               label: "Lucro",         icon: TrendingUp, color: "#d97706", tip: "Análise de lucro e margem por produto", perm: "financeiro" },
  { href: "/usuarios",            label: "Usuários",      icon: UserCog,    color: "#0891b2", tip: "Cadastre operadores e defina permissões", perm: "gerenciar_usuarios" },
  { href: "/auditoria",           label: "Auditoria",     icon: ScrollText, color: "#9333ea", tip: "Quem fez o quê por operador e período", perm: "gerenciar_usuarios" },
  { href: "/settings",            label: "Configurações", icon: Settings,   color: "#64748b", tip: "Configurações da loja e do sistema", perm: "loja" },
  { href: "/perfil",              label: "Meu perfil",    icon: KeyRound,   color: "#475569", tip: "Troque a sua senha", perm: undefined },
  { href: "/manual",              label: "Manual",        icon: BookOpen,   color: "#4f46e5", tip: "Guia completo de todas as áreas do app", perm: undefined },
] as const;

interface AppSidebarProps {
  userEmail: string;
  isFounder?: boolean;
  /** Códigos de permissão do usuário (owner/founder recebem todos). */
  permissions?: PermissionCode[];
  /** Dono da loja ou founder: vê todos os itens (RF11). */
  canSeeAll?: boolean;
}

/** Filtra os itens de menu pelas permissões do usuário (RF11). */
function visibleNav<T extends { perm?: PermissionCode }>(
  items: readonly T[],
  granted: Set<PermissionCode>,
  canSeeAll: boolean,
): T[] {
  return items.filter(
    (item) => !item.perm || canSeeAll || granted.has(item.perm),
  );
}

/** Item de navegação com ícone colorido em chip. Recolhido → só o ícone (rail). */
function NavItem({
  href,
  label,
  Icon,
  color,
  active,
  tip,
  collapsed,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  color: string;
  active: boolean;
  tip: string;
  collapsed: boolean;
}) {
  return (
    <HelpTip text={collapsed ? label : tip} placement="bottom">
      <Link
        href={href}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : 12,
          width: "100%",
          padding: collapsed ? "8px 0" : "8px 12px",
          borderRadius: 12,
          fontSize: 14.5,
          fontWeight: 700,
          letterSpacing: "-0.1px",
          textDecoration: "none",
          background: active ? `${color}14` : "transparent",
          color: active ? color : "#1e293b",
          transition: "background 0.12s",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 9,
            flexShrink: 0,
            background: active ? color : `${color}1f`,
            color: active ? "#ffffff" : color,
            boxShadow: active ? `0 4px 10px ${color}40` : "none",
            transition: "all 0.12s",
          }}
        >
          <Icon size={17} strokeWidth={2} />
        </span>
        {!collapsed && <span>{label}</span>}
      </Link>
    </HelpTip>
  );
}

export function AppSidebar({
  userEmail,
  isFounder = false,
  permissions = [],
  canSeeAll = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { helpActive, toggleHelp } = useHelp();
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    collapsedSnapshot,
    collapsedServerSnapshot,
  );

  function toggleCollapsed() {
    setCollapsedStore(!collapsed);
  }

  const granted = new Set(permissions);
  const seeAll = canSeeAll || isFounder;
  const navPrimary = visibleNav(NAV_PRIMARY, granted, seeAll);
  const navSecondary = visibleNav(NAV_SECONDARY, granted, seeAll);

  function isActive(href: string): boolean {
    if (href === "/financeiro/caixa") return pathname === "/financeiro/caixa";
    if (href === "/financeiro/clientes") return pathname.startsWith("/financeiro/clientes");
    if (href === "/products") return pathname.startsWith("/products");
    if (href === "/estoque") return pathname.startsWith("/estoque");
    if (href === "/settings") return pathname.startsWith("/settings");
    return pathname === href;
  }

  const initial = userEmail.charAt(0).toUpperCase() || "U";

  return (
    <div className="hidden lg:flex">
      <aside
        style={{
          width: collapsed ? 76 : 248,
          flexShrink: 0,
          background: "#ffffff",
          borderRight: "1px solid #edf0f4",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: "sticky",
          top: 0,
          transition: "width 0.16s ease",
        }}
      >
        {/* Logo + botão de recolher/expandir */}
        <div
          style={{
            padding: collapsed ? "18px 0 14px" : "22px 20px 16px",
            display: "flex",
            flexDirection: collapsed ? "column" : "row",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            gap: collapsed ? 12 : 8,
          }}
        >
          {/* Logo completo na sidebar expandida; só o emblema quando recolhida. */}
          <img
            src={collapsed ? "/logo-icon.webp" : "/logo-full.webp"}
            alt="PDV.ART.br"
            loading="lazy"
            style={{ height: collapsed ? 34 : 38, width: "auto" }}
          />
          <HelpTip
            text={collapsed ? "Expandir menu" : "Recolher menu"}
            placement="bottom"
          >
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 10,
                flexShrink: 0,
                border: "1.5px solid #e2e8f0",
                background: "#f8fafc",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              {collapsed ? (
                <PanelLeftOpen size={18} strokeWidth={2} />
              ) : (
                <PanelLeftClose size={18} strokeWidth={2} />
              )}
            </button>
          </HelpTip>
        </div>

        {/* Nav */}
        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: collapsed ? "6px 12px" : "6px 14px",
            flex: 1,
            overflowY: "auto",
          }}
        >
          {navPrimary.map(({ href, label, icon, color, tip }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              Icon={icon}
              color={color}
              active={isActive(href)}
              tip={tip}
              collapsed={collapsed}
            />
          ))}

          <div style={{ height: 1, background: "#eef1f5", margin: "8px 6px" }} />

          {navSecondary.map(({ href, label, icon, color, tip }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              Icon={icon}
              color={color}
              active={isActive(href)}
              tip={tip}
              collapsed={collapsed}
            />
          ))}

          {isFounder && (
            <>
              <div style={{ height: 1, background: "#eef1f5", margin: "8px 6px" }} />
              <NavItem
                href="/superadmin"
                label="Super Admin"
                Icon={Shield}
                color="#dc2626"
                active={pathname === "/superadmin" || pathname.startsWith("/superadmin/")}
                tip="Painel exclusivo do super admin"
                collapsed={collapsed}
              />
            </>
          )}
        </nav>

        {/* Help button */}
        <div style={{ padding: collapsed ? "8px 12px 4px" : "8px 14px 4px" }}>
          <HelpTip
            text={helpActive ? "Modo ajuda ativo — passe o mouse sobre qualquer elemento para ver sua função. Clique para desativar." : "Ativar modo ajuda — passe o mouse sobre os elementos para aprender suas funções"}
            placement="top"
          >
            <button
              onClick={toggleHelp}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : 11,
                padding: collapsed ? "9px 0" : "9px 11px",
                borderRadius: 12,
                border: helpActive ? "1.5px solid #c7d2fe" : "1.5px solid #e2e8f0",
                background: helpActive ? "#eef2ff" : "#f8fafc",
                color: helpActive ? "#4f46e5" : "#334155",
                font: "inherit",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  flexShrink: 0,
                  background: helpActive ? "#4f46e5" : "#eef2ff",
                  color: helpActive ? "#ffffff" : "#4f46e5",
                }}
              >
                <HelpCircle size={17} strokeWidth={2} />
              </span>
              {!collapsed && <span>{helpActive ? "Ajuda ativa" : "Modo Ajuda"}</span>}
            </button>
          </HelpTip>
        </div>

        {/* User footer */}
        <div
          style={{
            padding: 14,
            borderTop: "1px solid #eef1f5",
            display: "flex",
            flexDirection: collapsed ? "column" : "row",
            alignItems: "center",
            gap: collapsed ? 8 : 11,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "#4f46e5",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: "#0f172a",
                }}
              >
                {userEmail}
              </div>
              <div style={{ fontSize: 11, color: "#9aa3b2", fontWeight: 600 }}>
                {isFounder ? "Super Admin" : canSeeAll ? "Dono" : "Operador"}
              </div>
            </div>
          )}
          <div style={{ color: "#9aa3b2" }}>
            <SignOutButton />
          </div>
        </div>
      </aside>
    </div>
  );
}
