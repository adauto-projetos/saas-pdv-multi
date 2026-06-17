"use client";

import * as React from "react";

import { listCashMovementsAction } from "@/app/(app)/financeiro/caixa/actions";
import { PageCard } from "@/components/ui/PageCard";
import { PdvTableCell, PdvTableHead } from "@/components/ui/PdvTable";
import {
  Table,
  TableBody,
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
    <PageCard>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-[14px]">
        <span className="text-sm font-semibold text-gray-900">Extrato</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-gray-400"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-[12px] text-gray-400">até</span>
          <input
            type="date"
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-gray-400"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="px-5 py-6 text-center text-sm text-gray-400">
          Carregando...
        </p>
      ) : error ? (
        <p className="px-5 py-6 text-center text-sm text-destructive">{error}</p>
      ) : movements.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-gray-400">
          Nenhuma movimentação no período.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <PdvTableHead>Data</PdvTableHead>
              <PdvTableHead>Tipo</PdvTableHead>
              <PdvTableHead className="text-right">Valor</PdvTableHead>
              <PdvTableHead>Descrição</PdvTableHead>
              <PdvTableHead>Origem</PdvTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id}>
                <PdvTableCell>
                  {new Date(m.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </PdvTableCell>
                <PdvTableCell>
                  {m.type === "entrada" ? "Entrada" : "Saída"}
                </PdvTableCell>
                <PdvTableCell
                  className={[
                    "text-right font-semibold",
                    m.amountCents < 0 ? "text-red-500" : "text-green-600",
                  ].join(" ")}
                >
                  {m.amountCents > 0
                    ? `+${centsToBRL(m.amountCents)}`
                    : centsToBRL(m.amountCents)}
                </PdvTableCell>
                <PdvTableCell className="text-gray-500">
                  {m.description ?? "—"}
                </PdvTableCell>
                <PdvTableCell className="text-gray-500">
                  {ORIGIN_LABELS[m.origin]}
                </PdvTableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageCard>
  );
}
