"use client";

import * as React from "react";
import { FileText, ShoppingCart, Wallet } from "lucide-react";

import type { ProductDto } from "@/types/product";
import type { CashSessionDto } from "@/types/profit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HelpTip } from "@/components/ui/help-tip";
import { CashMovementDialog } from "@/components/financeiro/CashMovementDialog";
import { CashSessionPanel } from "@/components/financeiro/CashSessionPanel";
import { CashierScreen } from "./CashierScreen";
import { ReceivableList } from "@/components/financeiro/ReceivableList";

type Tab = "caixa" | "notas";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "caixa", label: "Caixa", icon: ShoppingCart },
  { id: "notas", label: "Notas a Receber", icon: FileText },
];

export function CaixaShell({
  products,
  session,
}: {
  products: ProductDto[];
  session?: CashSessionDto | null;
}) {
  const [tab, setTab] = React.useState<Tab>("caixa");
  const [turnoOpen, setTurnoOpen] = React.useState(false);
  const [showMovement, setShowMovement] = React.useState(false);
  const hasOpenSession = !!session;
  // session === undefined → sem permissão "caixa"/dado ausente: não mostra o botão.
  const showTurnoButton = session !== undefined;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          flexShrink: 0,
          alignItems: "center",
          borderBottom: "1px solid #edf0f4",
          background: "#fff",
          paddingLeft: 16,
          paddingRight: 12,
          gap: 4,
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          const tip =
            id === "caixa"
              ? "Tela principal de vendas — bipe produtos e finalize vendas"
              : "Vendas no fiado aguardando recebimento";
          return (
            <HelpTip key={id} text={tip} placement="bottom">
              <button
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
            </HelpTip>
          );
        })}

        {/* Botão do turno (abrir/fechar caixa + movimentações) — abre num modal. */}
        {showTurnoButton && (
          <HelpTip
            text="Abrir/fechar o caixa e registrar suprimento/sangria"
            placement="bottom"
          >
            <button
              onClick={() => setTurnoOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginLeft: "auto",
                padding: "8px 14px",
                borderRadius: 10,
                border: "1.5px solid",
                borderColor: hasOpenSession ? "#bbf7d0" : "#e2e8f0",
                background: hasOpenSession ? "#f0fdf4" : "#fff",
                color: hasOpenSession ? "#16a34a" : "#475569",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <Wallet size={16} strokeWidth={2} />
              {hasOpenSession ? "Caixa aberto" : "Abrir caixa"}
            </button>
          </HelpTip>
        )}
      </div>

      {/* Caixa tab — always mounted, CSS-hide to preserve cart state */}
      <div className={tab === "caixa" ? "flex flex-1 min-w-0 overflow-hidden" : "hidden"}>
        <CashierScreen products={products} />
      </div>

      {/* Notas a Receber tab */}
      {tab === "notas" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
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

      {/* Modal do turno: abrir/fechar caixa + suprimento/sangria (perm "Caixa"). */}
      <Dialog open={turnoOpen} onOpenChange={setTurnoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Caixa / Turno</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <CashSessionPanel session={session ?? null} />

            {hasOpenSession && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowMovement((v) => !v)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-bold text-gray-700"
                >
                  {showMovement
                    ? "Fechar movimentação"
                    : "+ Nova movimentação (suprimento / sangria)"}
                </button>
                {showMovement && (
                  <div className="mt-3">
                    <CashMovementDialog />
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
