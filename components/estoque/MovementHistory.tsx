"use client";

import * as React from "react";

import { listMovementsAction } from "@/app/(app)/estoque/actions";
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
import type { MovementType, StockMovementDto } from "@/types/stock";

const TYPE_LABELS: Record<MovementType, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
};

/** RF05 — histórico de movimentações do produto, filtrável por tipo e período. */
export function MovementHistory({ productId }: { productId: string }) {
  const [type, setType] = React.useState<MovementType | "">("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [movements, setMovements] = React.useState<StockMovementDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const res = await listMovementsAction({
        productId,
        type: type || undefined,
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
  }, [productId, type, from, to]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="filter-type">Tipo</Label>
          <select
            id="filter-type"
            value={type}
            onChange={(e) => setType(e.target.value as MovementType | "")}
            className="h-9 w-40 rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todos os tipos</option>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="filter-from">De</Label>
          <Input
            id="filter-from"
            type="date"
            className="w-40 text-base"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="filter-to">Até</Label>
          <Input
            id="filter-to"
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
              <TableHead>Quantidade</TableHead>
              <TableHead>Motivo</TableHead>
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
                <TableCell>
                  <Badge variant="outline">{TYPE_LABELS[m.type]}</Badge>
                </TableCell>
                <TableCell
                  className={m.quantity < 0 ? "text-destructive" : "text-primary"}
                >
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {m.reason ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
