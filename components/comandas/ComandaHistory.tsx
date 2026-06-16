"use client";

import * as React from "react";

import { listComandaHistoryAction } from "@/app/(app)/comandas/actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ComandaSummaryDto, ComandaStatus } from "@/types/comanda";

import { ReprintButton } from "./ReprintButton";

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: ComandaStatus }) {
  if (status === "fechada") {
    return <Badge variant="secondary">Fechada</Badge>;
  }
  if (status === "cancelada") {
    return <Badge variant="destructive">Cancelada</Badge>;
  }
  return <Badge variant="default">Aberta</Badge>;
}

/**
 * RF08 — histórico de comandas fechadas/canceladas filtrável por período.
 * Mirrors SessionHistory: useEffect + cleanup active flag.
 */
export function ComandaHistory() {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [history, setHistory] = React.useState<ComandaSummaryDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const res = await listComandaHistoryAction({
        from: from || undefined,
        // inclui o dia inteiro do "até".
        to: to ? `${to}T23:59:59` : undefined,
      });
      if (!active) return;
      if (res.ok) {
        setHistory(res.data);
        setError(null);
      } else {
        setHistory([]);
        setError(res.error);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [from, to]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="history-from">De</Label>
          <Input
            id="history-from"
            type="date"
            className="w-40 text-base"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="history-to">Até</Label>
          <Input
            id="history-to"
            type="date"
            className="w-40 text-base"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Carregando...
        </p>
      ) : error ? (
        <p className="py-6 text-center text-sm text-destructive">{error}</p>
      ) : history.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma comanda no período.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Identificação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aberta em</TableHead>
              <TableHead>Fechada em</TableHead>
              <TableHead>Venda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.label}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
                <TableCell>{formatDate(c.openedAt)}</TableCell>
                <TableCell>{formatDate(c.closedAt)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.saleId ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{c.saleId.slice(0, 8)}…</span>
                      <ReprintButton type="cupom" id={c.saleId} />
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
