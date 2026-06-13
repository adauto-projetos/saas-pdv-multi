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
            <Label htmlFor="comanda-label">
              Identificação (ex: Mesa 3, João)
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

          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Abrindo..." : "Abrir comanda"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
