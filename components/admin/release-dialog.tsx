"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReleaseDialogProps {
  tenant: { id: string; name: string; validUntil: Date | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

function calcNewValidUntil(validUntil: Date | null): Date {
  const now = new Date();
  const base = validUntil && validUntil > now ? validUntil : now;
  return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

export function ReleaseDialog({
  tenant,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: ReleaseDialogProps) {
  const newValidUntil = calcNewValidUntil(tenant.validUntil);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberar +30 dias</DialogTitle>
          <DialogDescription>
            Confirma a liberação de acesso para <strong>{tenant.name}</strong>?
          </DialogDescription>
        </DialogHeader>
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13.5,
            color: "#15803d",
          }}
        >
          Novo vencimento: <strong>{formatDate(newValidUntil)}</strong>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? "Liberando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
