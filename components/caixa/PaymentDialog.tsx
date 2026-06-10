"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { centsToBRL } from "@/lib/format/money";
import type { PaymentMethod } from "@/types/sale";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
];

export function PaymentDialog({
  open,
  onOpenChange,
  totalCents,
  onConfirm,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalCents: number;
  onConfirm: (method: PaymentMethod) => void;
  isSubmitting?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalizar venda</AlertDialogTitle>
          <AlertDialogDescription>
            Total{" "}
            <span className="font-mono font-bold text-foreground">
              {centsToBRL(totalCents)}
            </span>
            . Escolha a forma de pagamento.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {METHODS.map((m) => (
            <Button
              key={m.value}
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onConfirm(m.value)}
            >
              {m.label}
            </Button>
          ))}
        </div>

        <AlertDialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Voltar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
