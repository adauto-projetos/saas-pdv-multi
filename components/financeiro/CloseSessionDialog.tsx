"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { closeCashSessionAction } from "@/app/(app)/lucro/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { centsToBRL } from "@/lib/format/money";
import type { CashSessionDto } from "@/types/profit";

/**
 * RF06/RF07 — fecha o caixa informando a contagem real da gaveta. Após fechar,
 * mostra esperado/contado/divergência (RN07: <0 = falta em vermelho, >0 = sobra).
 */
export function CloseSessionDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [countedCents, setCountedCents] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [closed, setClosed] = React.useState<CashSessionDto | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (countedCents == null || countedCents < 0) {
      toast.error("Informe a contagem da gaveta.");
      return;
    }

    setSubmitting(true);
    const res = await closeCashSessionAction({ countedCents });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Caixa fechado");
    setClosed(res.data);
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reseta ao fechar o modal.
      setCountedCents(null);
      setClosed(null);
    }
  }

  const divergence = closed?.divergenceCents ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" className="w-fit" />}>
        Fechar caixa
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar caixa</DialogTitle>
          <DialogDescription>
            Informe a contagem real do dinheiro na gaveta.
          </DialogDescription>
        </DialogHeader>

        {closed ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Esperado</span>
              <span className="font-mono">
                {centsToBRL(closed.expectedCents ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Contado</span>
              <span className="font-mono">
                {centsToBRL(closed.countedCents ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Divergência {divergence < 0 ? "(falta)" : divergence > 0 ? "(sobra)" : ""}
              </span>
              <span
                className={
                  divergence < 0
                    ? "font-mono text-destructive"
                    : "font-mono text-primary"
                }
              >
                {divergence > 0
                  ? `+${centsToBRL(divergence)}`
                  : centsToBRL(divergence)}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-2 w-fit"
              onClick={() => handleOpenChange(false)}
            >
              Concluir
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="counted-balance">Contagem da gaveta</Label>
              <MoneyInput
                id="counted-balance"
                value={countedCents}
                onChange={setCountedCents}
                placeholder="R$ 0,00"
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? "Fechando..." : "Fechar caixa"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
