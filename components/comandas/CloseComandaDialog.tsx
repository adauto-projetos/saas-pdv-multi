"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { closeComandaAction } from "@/app/(app)/comandas/actions";
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
import type { ComandaDto } from "@/types/comanda";
import type { PaymentMethod } from "@/types/sale";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "fiado", label: "Fiado" },
];

/**
 * RF06 — confirma fechamento da comanda: exibe total final (snapshot) +
 * forma de pagamento. Abandonar o dialog NÃO fecha a comanda (RF06/RN06).
 * Fiado exige cliente (RN07). Mirrors PaymentDialog.
 */
export function CloseComandaDialog({
  comanda,
  open,
  onOpenChange,
}: {
  comanda: ComandaDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [customer, setCustomer] = React.useState<CustomerDto | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) setCustomer(null);
    onOpenChange(next);
  }

  async function handleConfirm(method: PaymentMethod) {
    if (method === "fiado" && !customer) return;

    setSubmitting(true);
    const res = await closeComandaAction({
      comandaId: comanda.id,
      paymentMethod: method,
      ...(method === "fiado" ? { customerId: customer?.id } : {}),
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Comanda "${comanda.label}" fechada`);
    if (res.printWarning) toast.warning(res.printWarning);
    setCustomer(null);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Fechar comanda: {comanda.label}</AlertDialogTitle>
          <AlertDialogDescription>
            O valor cobrado é calculado no fechamento com os preços atuais dos
            produtos.{" "}
            <span className="font-mono font-bold text-foreground">
              {centsToBRL(comanda.partialTotalCents)}
            </span>{" "}
            (valor de referência — total final pode diferir). Escolha a forma de
            pagamento.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="close-comanda-customer">
              Cliente (obrigatório para fiado)
            </Label>
            <CustomerPicker
              inputId="close-comanda-customer"
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
                  disabled={submitting || blocked}
                  onClick={() => handleConfirm(m.value)}
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
            disabled={submitting}
          >
            Voltar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
