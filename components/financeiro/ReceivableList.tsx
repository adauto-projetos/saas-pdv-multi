"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  listReceivablesAction,
  recordReceivablePaymentAction,
} from "@/app/(app)/financeiro/receber/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { AccountPaymentMethod } from "@/lib/validation/finance";
import type { AccountStatus, ReceivableDto } from "@/types/finance";

import { PaymentDialog } from "./PaymentDialog";

const STATUS_LABELS: Record<AccountStatus, string> = {
  aberto: "Aberto",
  parcial: "Parcial",
  quitado: "Quitado",
};

function statusVariant(status: AccountStatus): "outline" | "secondary" | "default" {
  if (status === "quitado") return "default";
  if (status === "parcial") return "secondary";
  return "outline";
}

/** Lista filtrável de contas a receber; vencidas destacadas; recebimento (RF10/RF14). */
export function ReceivableList({ reloadKey: externalReloadKey = 0 }: { reloadKey?: number }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<AccountStatus | "">("");
  const [receivables, setReceivables] = React.useState<ReceivableDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [selected, setSelected] = React.useState<ReceivableDto | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const res = await listReceivablesAction({
        status: status || undefined,
      });
      if (!active) return;
      if (res.ok) {
        setReceivables(res.data);
        setError(null);
      } else {
        setReceivables([]);
        setError(res.error);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [status, reloadKey, externalReloadKey]);

  async function handleConfirm(
    amountCents: number,
    method: AccountPaymentMethod,
  ) {
    if (!selected) return;
    setSubmitting(true);
    const res = await recordReceivablePaymentAction({
      accountId: selected.id,
      amountCents,
      method,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Recebimento registrado");
    setSelected(null);
    setReloadKey((k) => k + 1);
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="receivable-status">Status</Label>
          <select
            id="receivable-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AccountStatus | "")}
            className="h-9 w-40 rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Todos os status</option>
            <option value="aberto">Aberto</option>
            <option value="parcial">Parcial</option>
            <option value="quitado">Quitado</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Carregando...
        </p>
      ) : error ? (
        <p className="py-6 text-center text-sm text-destructive">{error}</p>
      ) : receivables.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma conta a receber.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receivables.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.customerName}</TableCell>
                <TableCell className="font-mono">
                  {centsToBRL(r.totalCents)}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {centsToBRL(r.paidCents)}
                </TableCell>
                <TableCell className="font-mono">
                  {centsToBRL(r.remainingCents)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status)}>
                    {STATUS_LABELS[r.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.dueDate ? (
                    r.overdue ? (
                      <Badge variant="destructive">
                        Venceu{" "}
                        {new Date(r.dueDate).toLocaleDateString("pt-BR", {
                          timeZone: "UTC",
                        })}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {new Date(r.dueDate).toLocaleDateString("pt-BR", {
                          timeZone: "UTC",
                        })}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {r.status !== "quitado" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(r)}
                    >
                      Receber
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {selected ? (
        <PaymentDialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          label={`Receber de ${selected.customerName}`}
          remainingCents={selected.remainingCents}
          onConfirm={handleConfirm}
          isSubmitting={submitting}
        />
      ) : null}
    </div>
  );
}
