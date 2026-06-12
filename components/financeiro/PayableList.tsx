"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  listPayablesAction,
  recordPayablePaymentAction,
} from "@/app/(app)/financeiro/pagar/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { AccountPaymentMethod } from "@/lib/validation/finance";
import type { AccountStatus, PayableDto } from "@/types/finance";

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

/** Lista filtrável de contas a pagar; vencidas destacadas; pagamento (RF13/RF14). */
export function PayableList({ reloadKey: externalReloadKey = 0 }: { reloadKey?: number }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<AccountStatus | "">("");
  const [category, setCategory] = React.useState("");
  const [payables, setPayables] = React.useState<PayableDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const [selected, setSelected] = React.useState<PayableDto | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const res = await listPayablesAction({
        status: status || undefined,
        category: category.trim() || undefined,
      });
      if (!active) return;
      if (res.ok) {
        setPayables(res.data);
        setError(null);
      } else {
        setPayables([]);
        setError(res.error);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [status, category, reloadKey, externalReloadKey]);

  async function handleConfirm(
    amountCents: number,
    method: AccountPaymentMethod,
  ) {
    if (!selected) return;
    setSubmitting(true);
    const res = await recordPayablePaymentAction({
      accountId: selected.id,
      amountCents,
      method,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Pagamento registrado");
    setSelected(null);
    setReloadKey((k) => k + 1);
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="payable-status">Status</Label>
          <select
            id="payable-status"
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
        <div className="grid gap-1">
          <Label htmlFor="payable-category">Categoria</Label>
          <Input
            id="payable-category"
            className="w-44 text-base"
            placeholder="Ex.: luz"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Carregando...
        </p>
      ) : error ? (
        <p className="py-6 text-center text-sm text-destructive">{error}</p>
      ) : payables.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma conta a pagar.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payables.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.description}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.category}
                </TableCell>
                <TableCell className="font-mono">
                  {centsToBRL(p.totalCents)}
                </TableCell>
                <TableCell className="font-mono">
                  {centsToBRL(p.remainingCents)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(p.status)}>
                    {STATUS_LABELS[p.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {p.dueDate ? (
                    p.overdue ? (
                      <Badge variant="destructive">
                        Venceu{" "}
                        {new Date(p.dueDate).toLocaleDateString("pt-BR", {
                          timeZone: "UTC",
                        })}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {new Date(p.dueDate).toLocaleDateString("pt-BR", {
                          timeZone: "UTC",
                        })}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {p.status !== "quitado" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(p)}
                    >
                      Pagar
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
          label={`Pagar ${selected.description}`}
          remainingCents={selected.remainingCents}
          onConfirm={handleConfirm}
          isSubmitting={submitting}
        />
      ) : null}
    </div>
  );
}
