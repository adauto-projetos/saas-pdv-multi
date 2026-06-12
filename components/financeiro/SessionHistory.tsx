"use client";

import * as React from "react";

import { listSessionsAction } from "@/app/(app)/lucro/actions";
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
import { centsToBRL } from "@/lib/format/money";
import type { CashSessionDto } from "@/types/profit";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** RF07 — histórico de turnos filtrável por período (mirror MovementHistory). */
export function SessionHistory() {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [sessions, setSessions] = React.useState<CashSessionDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const res = await listSessionsAction({
        from: from || undefined,
        // inclui o dia inteiro do "até".
        to: to ? `${to}T23:59:59` : undefined,
      });
      if (!active) return;
      if (res.ok) {
        setSessions(res.data);
        setError(null);
      } else {
        setSessions([]);
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
          <Label htmlFor="session-from">De</Label>
          <Input
            id="session-from"
            type="date"
            className="w-40 text-base"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="session-to">Até</Label>
          <Input
            id="session-to"
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
      ) : sessions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum turno no período.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Abertura</TableHead>
              <TableHead>Fechamento</TableHead>
              <TableHead>Esperado</TableHead>
              <TableHead>Contado</TableHead>
              <TableHead>Divergência</TableHead>
              <TableHead>Operador</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => {
              const divergence = s.divergenceCents;
              return (
                <TableRow key={s.id}>
                  <TableCell>{formatDate(s.openedAt)}</TableCell>
                  <TableCell>
                    {s.status === "aberta" ? (
                      <Badge variant="outline">Aberta</Badge>
                    ) : (
                      formatDate(s.closedAt)
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {s.expectedCents != null ? centsToBRL(s.expectedCents) : "—"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {s.countedCents != null ? centsToBRL(s.countedCents) : "—"}
                  </TableCell>
                  <TableCell
                    className={
                      divergence == null
                        ? "font-mono text-muted-foreground"
                        : divergence < 0
                          ? "font-mono text-destructive"
                          : "font-mono text-primary"
                    }
                  >
                    {divergence == null
                      ? "—"
                      : divergence > 0
                        ? `+${centsToBRL(divergence)}`
                        : centsToBRL(divergence)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.closedBy ?? s.openedBy}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
