"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { centsToBRL } from "@/lib/format/money";
import type { AccountPaymentMethod } from "@/lib/validation/finance";

const METHODS: { value: AccountPaymentMethod; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
];

/**
 * Dialog de recebimento/pagamento compartilhado por contas a receber e a pagar
 * (RF09/RF12). O valor inicia no saldo restante; o método move (ou não) o caixa.
 * O chamador passa `onConfirm`, que dispara a action correta.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  label,
  remainingCents,
  onConfirm,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  remainingCents: number;
  onConfirm: (amountCents: number, method: AccountPaymentMethod) => void;
  isSubmitting?: boolean;
}) {
  // Cada conta selecionada monta uma nova instância deste diálogo (a lista o
  // renderiza condicionalmente), então o valor inicial = saldo restante basta.
  const [amountCents, setAmountCents] = React.useState<number | null>(
    remainingCents,
  );

  const invalid =
    amountCents == null || amountCents <= 0 || amountCents > remainingCents;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>
            Saldo devedor{" "}
            <span className="font-mono font-bold text-foreground">
              {centsToBRL(remainingCents)}
            </span>
            . Informe o valor e a forma.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="payment-amount">Valor</Label>
            <MoneyInput
              id="payment-amount"
              value={amountCents}
              onChange={setAmountCents}
              placeholder="R$ 0,00"
            />
            {amountCents != null && amountCents > remainingCents ? (
              <p className="text-xs text-destructive">
                O valor não pode exceder o saldo devedor.
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>Forma de pagamento</Label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => (
                <Button
                  key={m.value}
                  variant="outline"
                  disabled={isSubmitting || invalid}
                  onClick={() => {
                    if (amountCents != null) onConfirm(amountCents, m.value);
                  }}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>
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
