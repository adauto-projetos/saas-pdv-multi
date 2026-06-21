"use client";

import * as React from "react";
import { FileText, ShoppingCart } from "lucide-react";

import type { ProductDto } from "@/types/product";
import { CashierScreen } from "./CashierScreen";
import { ReceivableList } from "@/components/financeiro/ReceivableList";

type Tab = "caixa" | "notas";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "caixa", label: "Caixa", icon: ShoppingCart },
  { id: "notas", label: "Notas a Receber", icon: FileText },
];

export function CaixaShell({ products }: { products: ProductDto[] }) {
  const [tab, setTab] = React.useState<Tab>("caixa");

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          borderBottom: "1px solid #edf0f4",
          background: "#fff",
          paddingLeft: 16,
          gap: 4,
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "14px 18px 12px",
                border: "none",
                borderBottom: active ? "2px solid #4f46e5" : "2px solid transparent",
                background: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 700,
                color: active ? "#4f46e5" : "#94a3b8",
                transition: "color .12s",
              }}
            >
              <Icon size={15} strokeWidth={2} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Caixa tab — always mounted, CSS-hide to preserve cart state */}
      <div
        className={tab === "caixa" ? "flex flex-1 min-w-0 overflow-hidden" : "hidden"}
      >
        <CashierScreen products={products} />
      </div>

      {/* Notas a Receber tab */}
      {tab === "notas" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 16px",
          }}
        >
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <h2
              style={{
                fontWeight: 800,
                fontSize: 18,
                color: "#0f172a",
                marginBottom: 20,
              }}
            >
              Notas a Receber
            </h2>
            <ReceivableList />
          </div>
        </div>
      )}
    </div>
  );
}
