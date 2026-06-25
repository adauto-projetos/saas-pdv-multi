"use client";

import { useEffect, useState } from "react";

import { getTenantHistoryAction } from "@/app/(admin)/superadmin/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SubscriptionLogEntry } from "@/lib/services/admin/tenant-admin-service";

interface SubscriptionHistoryModalProps {
  tenantId: string;
  tenantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_LABELS: Record<SubscriptionLogEntry["action"], string> = {
  trial_started: "Início de trial",
  renewed: "Renovado",
  suspended: "Suspenso",
  released: "Liberado",
};

const ACTION_COLORS: Record<SubscriptionLogEntry["action"], { color: string; bg: string }> = {
  trial_started: { color: "#1d4ed8", bg: "#dbeafe" },
  renewed: { color: "#15803d", bg: "#dcfce7" },
  suspended: { color: "#b91c1c", bg: "#fee2e2" },
  released: { color: "#6d28d9", bg: "#ede9fe" },
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export function SubscriptionHistoryModal({
  tenantId,
  tenantName,
  open,
  onOpenChange,
}: SubscriptionHistoryModalProps) {
  const [entries, setEntries] = useState<SubscriptionLogEntry[] | null>(null);

  useEffect(() => {
    if (!open) return;

    let active = true;
    getTenantHistoryAction(tenantId).then((result) => {
      if (active) setEntries(result.ok ? result.data : []);
    });

    return () => {
      active = false;
    };
  }, [open, tenantId]);

  const loading = open && entries === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico — {tenantName}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13.5 }}>
            Carregando...
          </div>
        )}

        {!loading && entries !== null && entries.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13.5 }}>
            Nenhum registro encontrado.
          </div>
        )}

        {!loading && entries !== null && entries.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
            {entries.map((entry) => {
              const { color, bg } = ACTION_COLORS[entry.action];
              return (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 12px",
                    background: "#f8fafc",
                    borderRadius: 10,
                    border: "1px solid #eef1f5",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: bg,
                      color,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {ACTION_LABELS[entry.action]}
                  </span>
                  <div style={{ flex: 1, fontSize: 12.5, color: "#475569" }}>
                    {entry.validUntilBefore !== null && (
                      <span>
                        {formatDate(entry.validUntilBefore)}
                        {" → "}
                        {formatDate(entry.validUntilAfter)}
                        {"  "}
                      </span>
                    )}
                    <span style={{ color: "#94a3b8", fontSize: 11.5 }}>
                      {new Date(entry.at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
