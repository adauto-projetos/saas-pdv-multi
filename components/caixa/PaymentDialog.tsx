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
import { CustomerPicker } from "@/components/financeiro/CustomerPicker";
import { centsToBRL } from "@/lib/format/money";
import type { CustomerDto } from "@/types/finance";
import type { PaymentMethod } from "@/types/sale";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "fiado", label: "Fiado" },
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
  onConfirm: (method: PaymentMethod, customerId?: string) => void;
  isSubmitting?: boolean;
}) {
  const [customer, setCustomer] = React.useState<CustomerDto | null>(null);

  // Ao fechar, limpa o cliente da venda anterior (sem efeito — direto no handler).
  function handleOpenChange(next: boolean) {
    if (!next) setCustomer(null);
    onOpenChange(next);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
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

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="checkout-customer">Cliente (obrigatório para fiado)</Label>
            <CustomerPicker
              inputId="checkout-customer"
              value={customer}
              onSelect={setCustomer}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => {
              const blocked = m.value === "fiado" && !customer;
              return (
                <Button
                  key={m.value}
                  variant="outline"
                  disabled={isSubmitting || blocked}
                  onClick={() =>
                    onConfirm(
                      m.value,
                      m.value === "fiado" ? customer?.id : undefined,
                    )
                  }
                >
                  {m.label}
                </Button>
              );
            })}
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Voltar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
