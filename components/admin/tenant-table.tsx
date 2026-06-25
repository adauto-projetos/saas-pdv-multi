"use client";

import { useState, useTransition } from "react";

import type { AdminTenantRow } from "@/lib/services/admin/tenant-admin-service";
import {
  releaseFromSuspensionAction,
  releaseSubscriptionAction,
  suspendTenantAction,
} from "@/app/(admin)/superadmin/actions";
import { enterStoreAction } from "@/app/(admin)/superadmin/impersonation-actions";
import { ReleaseDialog } from "./release-dialog";
import { SuspendDialog } from "./suspend-dialog";
import { SubscriptionHistoryModal } from "./subscription-history-modal";
import { TenantStatusBadge } from "./tenant-status-badge";

interface TenantTableProps {
  tenants: AdminTenantRow[];
}

function formatRevenue(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(d: Date | null): string {
  if (!d) return "nunca";
  return new Date(d).toLocaleDateString("pt-BR");
}

function sortTenants(rows: AdminTenantRow[]): AdminTenantRow[] {
  return [...rows].sort((a, b) => {
    if (a.status === "travada" && b.status !== "travada") return -1;
    if (b.status === "travada" && a.status !== "travada") return 1;
    const aDate = a.validUntil ? a.validUntil.getTime() : Infinity;
    const bDate = b.validUntil ? b.validUntil.getTime() : Infinity;
    return aDate - bDate;
  });
}

type DialogState =
  | { type: "release"; tenantId: string }
  | { type: "suspend"; tenantId: string }
  | { type: "history"; tenantId: string }
  | null;

export function TenantTable({ tenants }: TenantTableProps) {
  const sorted = sortTenants(tenants);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [isPending, startTransition] = useTransition();
  // Qual loja está sendo processada — desabilita só os botões daquela linha,
  // permitindo agir em outras lojas enquanto uma ação resolve.
  const [pendingId, setPendingId] = useState<string | null>(null);

  const activeTenant = dialog
    ? tenants.find((t) => t.id === dialog.tenantId)
    : null;

  function handleRelease(tenantId: string) {
    setPendingId(tenantId);
    startTransition(async () => {
      await releaseSubscriptionAction(tenantId);
      setPendingId(null);
      setDialog(null);
    });
  }

  function handleSuspend(tenantId: string) {
    setPendingId(tenantId);
    startTransition(async () => {
      await suspendTenantAction(tenantId);
      setPendingId(null);
      setDialog(null);
    });
  }

  function handleReleaseFromSuspension(tenantId: string) {
    setPendingId(tenantId);
    startTransition(async () => {
      await releaseFromSuspensionAction(tenantId);
      setPendingId(null);
    });
  }

  function handleEnterStore(tenantId: string) {
    setPendingId(tenantId);
    startTransition(async () => {
      await enterStoreAction(tenantId);
    });
  }

  if (sorted.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px 0",
          color: "#94a3b8",
          fontSize: 13.5,
        }}
      >
        Nenhuma loja cadastrada ainda.
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          background: "#fff",
          border: "1px solid #eef1f5",
          borderRadius: 16,
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #eef1f5" }}>
              {["Loja", "Estado", "Vencimento", "Faturamento/mês", "Último acesso", "Ações"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.8px",
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((tenant, idx) => (
              <tr
                key={tenant.id}
                style={{
                  borderBottom: idx < sorted.length - 1 ? "1px solid #f1f5f9" : "none",
                }}
              >
                <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0f172a" }}>
                  {tenant.name}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <TenantStatusBadge status={tenant.status} />
                </td>
                <td style={{ padding: "14px 16px", color: "#475569" }}>
                  {formatDate(tenant.validUntil)}
                </td>
                <td style={{ padding: "14px 16px", color: "#475569" }}>
                  {formatRevenue(tenant.revenueCents)}
                </td>
                <td style={{ padding: "14px 16px", color: "#475569" }}>
                  {formatDate(tenant.lastActivityAt)}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleEnterStore(tenant.id)}
                      disabled={isPending && pendingId === tenant.id}
                      aria-label={`Entrar na loja ${tenant.name}`}
                      style={actionButtonStyle("#fff", "#4f46e5")}
                    >
                      Entrar na loja
                    </button>

                    <button
                      type="button"
                      onClick={() => setDialog({ type: "release", tenantId: tenant.id })}
                      disabled={isPending && pendingId === tenant.id}
                      aria-label={`Liberar 30 dias para ${tenant.name}`}
                      style={actionButtonStyle("#15803d", "#f0fdf4")}
                    >
                      +30 dias
                    </button>

                    {tenant.suspendedAt ? (
                      <button
                        type="button"
                        onClick={() => handleReleaseFromSuspension(tenant.id)}
                        disabled={isPending && pendingId === tenant.id}
                        aria-label={`Liberar suspensão de ${tenant.name}`}
                        style={actionButtonStyle("#6d28d9", "#ede9fe")}
                      >
                        Liberar suspensão
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDialog({ type: "suspend", tenantId: tenant.id })}
                        disabled={isPending && pendingId === tenant.id}
                        aria-label={`Suspender ${tenant.name}`}
                        style={actionButtonStyle("#b91c1c", "#fef2f2")}
                      >
                        Suspender
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDialog({ type: "history", tenantId: tenant.id })}
                      disabled={isPending && pendingId === tenant.id}
                      aria-label={`Histórico de ${tenant.name}`}
                      style={actionButtonStyle("#475569", "#f1f5f9")}
                    >
                      Histórico
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog?.type === "release" && activeTenant && (
        <ReleaseDialog
          tenant={activeTenant}
          open={true}
          onOpenChange={(o) => !o && setDialog(null)}
          onConfirm={() => handleRelease(activeTenant.id)}
          isPending={isPending}
        />
      )}

      {dialog?.type === "suspend" && activeTenant && (
        <SuspendDialog
          tenant={activeTenant}
          open={true}
          onOpenChange={(o) => !o && setDialog(null)}
          onConfirm={() => handleSuspend(activeTenant.id)}
          isPending={isPending}
        />
      )}

      {dialog?.type === "history" && activeTenant && (
        <SubscriptionHistoryModal
          tenantId={activeTenant.id}
          tenantName={activeTenant.name}
          open={true}
          onOpenChange={(o) => !o && setDialog(null)}
        />
      )}
    </>
  );
}

function actionButtonStyle(color: string, bg: string): React.CSSProperties {
  return {
    padding: "5px 11px",
    borderRadius: 8,
    border: "none",
    background: bg,
    color,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
