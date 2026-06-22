"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Package,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { HelpTip } from "@/components/ui/help-tip";
import { useHelp } from "@/lib/help/help-context";

const NAV_PRIMARY = [
  { href: "/caixa",    label: "Caixa",         icon: LayoutDashboard, tip: "PDV — registre vendas, bipe produtos e feche o caixa" },
  { href: "/vendas",   label: "Vendas",         icon: BarChart3,       tip: "Histórico de todas as vendas realizadas" },
  { href: "/products", label: "Produtos",       icon: Package,         tip: "Cadastre e edite o catálogo de produtos" },
  { href: "/estoque",  label: "Estoque",        icon: Layers,          tip: "Movimentações e controle de estoque" },
  { href: "/comandas", label: "Comandas",       icon: ClipboardList,   tip: "Mesas e pedidos em aberto" },
] as const;

const NAV_SECONDARY = [
  { href: "/financeiro/caixa",    label: "Financeiro",   icon: Wallet,     tip: "Fluxo de caixa e resumo financeiro" },
  { href: "/financeiro/clientes", label: "Clientes",     icon: Users,      tip: "Cadastro de clientes e controle de fiado" },
  { href: "/lucro",               label: "Lucro",        icon: TrendingUp, tip: "Análise de lucro e margem por produto" },
  { href: "/settings",            label: "Configurações",icon: Settings,   tip: "Configurações da loja e do sistema" },
] as const;

interface AppSidebarProps {
  userEmail: string;
}

export function AppSidebar({ userEmail }: AppSidebarProps) {
  const pathname = usePathname();
  const { helpActive, toggleHelp } = useHelp();

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
        width: 248,
        flexShrink: 0,
        background: "#ffffff",
        borderRight: "1px solid #edf0f4",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: "24px 22px 18px" }}>
        <div
          style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 800,
            fontSize: 21,
            letterSpacing: "-0.5px",
            color: "#0f172a",
          }}
        >
          PDV<span style={{ color: "#4f46e5" }}>.multi</span>
        </div>
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: "2px",
            color: "#aab2c0",
            fontWeight: 700,
            marginTop: 3,
          }}
        >
          PONTO DE VENDA
        </div>
      </div>

      {/* Nav */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "6px 14px",
          flex: 1,
          overflowY: "auto",
        }}
      >
        {NAV_PRIMARY.map(({ href, label, icon: Icon, tip }) => {
          const active = isActive(href);
          return (
            <HelpTip key={href} text={tip} placement="bottom">
              <Link
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  width: "100%",
                  padding: "11px 13px",
                  borderRadius: 12,
                  fontSize: 14.5,
                  fontWeight: 700,
                  textDecoration: "none",
                  background: active ? "#eef2ff" : "transparent",
                  color: active ? "#4f46e5" : "#475569",
                  transition: "background 0.1s",
                }}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            </HelpTip>
          );
        })}

        <div
          style={{
            height: 1,
            background: "#eef1f5",
            margin: "8px 6px",
          }}
        />

        {NAV_SECONDARY.map(({ href, label, icon: Icon, tip }) => {
          const active = isActive(href);
          return (
            <HelpTip key={href} text={tip} placement="bottom">
              <Link
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  width: "100%",
                  padding: "11px 13px",
                  borderRadius: 12,
                  fontSize: 14.5,
                  fontWeight: 700,
                  textDecoration: "none",
                  background: active ? "#eef2ff" : "transparent",
                  color: active ? "#4f46e5" : "#475569",
                  transition: "background 0.1s",
                }}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            </HelpTip>
          );
        })}
      </nav>

      {/* Help button */}
      <div style={{ padding: "8px 14px 4px" }}>
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
              gap: 10,
              padding: "10px 13px",
              borderRadius: 12,
              border: helpActive ? "1.5px solid #c7d2fe" : "1.5px solid #eef1f5",
              background: helpActive ? "#eef2ff" : "transparent",
              color: helpActive ? "#4f46e5" : "#94a3b8",
              font: "inherit",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <HelpCircle size={17} strokeWidth={1.8} />
            <span>{helpActive ? "Ajuda ativa" : "Manual / Ajuda"}</span>
          </button>
        </HelpTip>
      </div>

      {/* User footer */}
      <div
        style={{
          padding: "14px",
          borderTop: "1px solid #eef1f5",
          display: "flex",
          alignItems: "center",
          gap: 11,
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
            Admin
          </div>
        </div>
        <div style={{ color: "#9aa3b2" }}>
          <SignOutButton />
        </div>
      </div>
    </aside>
    </div>
  );
}
