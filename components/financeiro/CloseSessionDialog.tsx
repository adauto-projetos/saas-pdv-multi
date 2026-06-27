"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { closeCashSessionAction } from "@/app/(app)/lucro/actions";
import {
  OverrideDialog,
  type OverrideCredentials,
} from "@/components/comandas/OverrideDialog";
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
 * RF06/RF07 — fechamento de caixa "às cegas" (0014F): o operador só PREENCHE a
 * contagem de dinheiro na gaveta + cartão + pix. Ele NÃO vê o esperado nem a
 * divergência — a conciliação fica para o dono (no histórico/Financeiro). Isso
 * evita que o operador saiba o valor que "deveria" estar no caixa.
 */
export function CloseSessionDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [countedCents, setCountedCents] = React.useState<number | null>(null);
  const [countedCardCents, setCountedCardCents] = React.useState<number | null>(null);
  const [countedPixCents, setCountedPixCents] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [overrideOpen, setOverrideOpen] = React.useState(false);

  function payload() {
    return {
      countedCents: countedCents ?? 0,
      countedCardCents: countedCardCents ?? 0,
      countedPixCents: countedPixCents ?? 0,
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (countedCents == null || countedCents < 0) {
      toast.error("Informe a contagem do dinheiro na gaveta.");
      return;
    }

    setSubmitting(true);
    const res = await closeCashSessionAction(payload());
    setSubmitting(false);

    if (!res.ok) {
      // SF02: sem permissão "caixa" → abre o diálogo de override em vez de erro.
      if (res.overrideRequired) {
        setOverrideOpen(true);
        return;
      }
      toast.error(res.error);
      return;
    }
    toast.success("Caixa fechado");
    setDone(true);
    router.refresh();
  }

  /** Reenvia o fechamento com as credenciais do autorizador (SF02). */
  async function handleAuthorize(credentials: OverrideCredentials) {
    if (countedCents == null) return { ok: false, error: "Informe a contagem." };
    const res = await closeCashSessionAction(payload(), credentials);
    if (!res.ok) return { ok: false, error: res.error };
    setOverrideOpen(false);
    toast.success("Caixa fechado");
    setDone(true);
    router.refresh();
    return { ok: true };
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setCountedCents(null);
      setCountedCardCents(null);
      setCountedPixCents(null);
      setDone(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={<Button variant="outline" className="w-fit" />}>
          Fechar caixa
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar caixa</DialogTitle>
            <DialogDescription>
              Conte o dinheiro da gaveta e informe os totais de cartão e pix.
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="grid gap-3">
              <p className="text-sm text-gray-600">
                Caixa fechado com sucesso. Os valores foram registrados.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                onClick={() => handleOpenChange(false)}
              >
                Concluir
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="counted-cash">Dinheiro na gaveta</Label>
                <MoneyInput
                  id="counted-cash"
                  value={countedCents}
                  onChange={setCountedCents}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="counted-card">Cartão (maquininha)</Label>
                <MoneyInput
                  id="counted-card"
                  value={countedCardCents}
                  onChange={setCountedCardCents}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="counted-pix">Pix</Label>
                <MoneyInput
                  id="counted-pix"
                  value={countedPixCents}
                  onChange={setCountedPixCents}
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

      <OverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        actionLabel="fechar o caixa"
        onAuthorize={handleAuthorize}
      />
    </>
  );
}
