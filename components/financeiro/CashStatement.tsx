"use client";

import * as React from "react";

import { listCashMovementsAction } from "@/app/(app)/financeiro/caixa/actions";
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
import type { CashMovementDto, CashOrigin } from "@/types/finance";

const ORIGIN_LABELS: Record<CashOrigin, string> = {
  venda: "Venda",
  recebimento: "Recebimento",
  pagamento: "Pagamento",
  manual: "Manual",
};

/** Extrato filtrável do caixa por período (RF04). */
export function CashStatement() {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [movements, setMovements] = React.useState<CashMovementDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const res = await listCashMovementsAction({
        from: from || undefined,
        // inclui o dia inteiro do "até".
        to: to ? `${to}T23:59:59` : undefined,
      });
      if (!active) return;
      if (res.ok) {
        setMovements(res.data);
        setError(null);
      } else {
        setMovements([]);
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
          <Label htmlFor="statement-from">De</Label>
          <Input
            id="statement-from"
            type="date"
            className="w-40 text-base"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="statement-to">Até</Label>
          <Input
            id="statement-to"
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
      ) : movements.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma movimentação no período.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  {new Date(m.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell>{m.type === "entrada" ? "Entrada" : "Saída"}</TableCell>
                <TableCell
                  className={
                    m.amountCents < 0
                      ? "font-mono text-destructive"
                      : "font-mono text-primary"
                  }
                >
                  {m.amountCents > 0
                    ? `+${centsToBRL(m.amountCents)}`
                    : centsToBRL(m.amountCents)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {m.description ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {ORIGIN_LABELS[m.origin]}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
