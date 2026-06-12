"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { openCashSessionAction } from "@/app/(app)/lucro/actions";
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

/**
 * RF04 — abre o caixa informando o saldo inicial (fundo de troco).
 * ConflictError ("já existe um caixa aberto") vira toast.error (RN09).
 */
export function OpenSessionDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [openingBalanceCents, setOpeningBalanceCents] = React.useState<
    number | null
  >(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (openingBalanceCents == null || openingBalanceCents < 0) {
      toast.error("Informe um saldo inicial válido.");
      return;
    }

    setSubmitting(true);
    const res = await openCashSessionAction({ openingBalanceCents });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Caixa aberto");
    setOpeningBalanceCents(null);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-fit" />}>
        Abrir caixa
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir caixa</DialogTitle>
          <DialogDescription>
            Informe o saldo inicial (fundo de troco) da gaveta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="opening-balance">Saldo inicial</Label>
            <MoneyInput
              id="opening-balance"
              value={openingBalanceCents}
              onChange={setOpeningBalanceCents}
              placeholder="R$ 0,00"
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Abrindo..." : "Abrir caixa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
