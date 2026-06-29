"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface DeleteStoreDialogProps {
  tenant: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (confirmationName: string) => void;
  isPending?: boolean;
}

/**
 * Confirmação de hard-delete (irreversível). O botão só habilita quando o
 * founder digita exatamente o nome da loja — fricção contra exclusão acidental.
 */
export function DeleteStoreDialog({
  tenant,
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: DeleteStoreDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const matches = confirmText.trim() === tenant.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir loja</DialogTitle>
          <DialogDescription>
            Isto apaga <strong>{tenant.name}</strong> e <strong>todos</strong> os
            dados (produtos, vendas, estoque, comandas, caixa e financeiro)
            permanentemente. A conta do dono também é removida se ficar sem
            nenhuma loja. <strong>Esta ação não pode ser desfeita.</strong>
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="confirm-store-name" style={{ fontSize: 13, color: "#475569" }}>
            Para confirmar, digite o nome da loja: <strong>{tenant.name}</strong>
          </label>
          <Input
            id="confirm-store-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={tenant.name}
            autoComplete="off"
            disabled={isPending}
            aria-label={`Digite ${tenant.name} para confirmar a exclusão`}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(confirmText)}
            disabled={isPending || !matches}
            aria-busy={isPending}
          >
            {isPending ? "Excluindo..." : "Excluir loja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
