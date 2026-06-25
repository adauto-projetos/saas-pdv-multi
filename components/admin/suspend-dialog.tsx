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

interface SuspendDialogProps {
  tenant: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}

export function SuspendDialog({
  tenant,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: SuspendDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspender loja</DialogTitle>
          <DialogDescription>
            Deseja suspender <strong>{tenant.name}</strong>? A loja será bloqueada imediatamente, independente do vencimento.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Suspendendo..." : "Suspender"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
