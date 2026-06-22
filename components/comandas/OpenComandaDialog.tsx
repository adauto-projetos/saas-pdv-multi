"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { openComandaAction } from "@/app/(app)/comandas/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InfoButton, HelpTip } from "@/components/ui/help-tip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * RF01 — abre comanda com rótulo livre (ex: "Mesa 3", "João").
 * RN04: sem conflito com outras abertas.
 */
export function OpenComandaDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error("Informe uma identificação para a comanda.");
      return;
    }

    setSubmitting(true);
    const res = await openComandaAction({ label: trimmed });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Comanda "${res.data.label}" aberta`);
    setLabel("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-fit" />}>
        Abrir comanda
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir comanda</DialogTitle>
          <DialogDescription>
            Informe a identificação da comanda (ex: Mesa 3, João).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="comanda-label" className="flex items-center">
              Identificação (ex: Mesa 3, João)
              <InfoButton
                title="Nome ou número da comanda"
                detail="Identifica a mesa ou o cliente. Pode ser o número da mesa (ex: Mesa 3), o nome do cliente (ex: João) ou qualquer código que faça sentido para você (ex: Balcão, Viagem)."
              />
            </Label>
            <Input
              id="comanda-label"
              className="text-base"
              placeholder="Mesa 3, João..."
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </div>

          <HelpTip
            text="Abre uma nova comanda para registrar pedidos"
            detail={"Uma comanda funciona como uma 'conta aberta'. Você vai adicionando os produtos conforme o cliente pede, e fecha a comanda quando ele for pagar.\n\nVocê pode ter várias comandas abertas ao mesmo tempo (uma por mesa, por exemplo)."}
            dialogTitle="Abrir comanda"
            style={{ width: "fit-content" }}
          >
            <Button type="submit" disabled={submitting} className="w-fit">
              {submitting ? "Abrindo..." : "Abrir comanda"}
            </Button>
          </HelpTip>
        </form>
      </DialogContent>
    </Dialog>
  );
}
