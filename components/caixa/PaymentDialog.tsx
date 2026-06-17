"use client";

import * as React from "react";

import { reprintReceiptAction } from "@/app/(app)/comandas/print-actions";
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

type Step = "select" | "cash" | "success";

export interface ConfirmResult {
  ok: boolean;
  error?: string;
  saleId?: string;
  printWarning?: string;
}

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
  onConfirm: (method: PaymentMethod, customerId?: string) => Promise<ConfirmResult>;
  isSubmitting?: boolean;
}) {
  const [customer, setCustomer] = React.useState<CustomerDto | null>(null);
  const [step, setStep] = React.useState<Step>("select");
  const [valorInput, setValorInput] = React.useState("");
  const [successData, setSuccessData] = React.useState<{
    saleId: string;
    trocoCents: number;
    printWarning?: string;
  } | null>(null);
  const [reprinting, setReprinting] = React.useState(false);
  const [reprintMsg, setReprintMsg] = React.useState<string | null>(null);

  const parsedCents =
    Math.round(parseFloat(valorInput.replace(",", ".")) * 100) || 0;
  const trocoCents = Math.max(0, parsedCents - totalCents);
  const canConfirm = parsedCents >= totalCents;

  function reset() {
    setCustomer(null);
    setStep("select");
    setValorInput("");
    setSuccessData(null);
    setReprinting(false);
    setReprintMsg(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleMethod(method: PaymentMethod) {
    if (method === "dinheiro") {
      setStep("cash");
      return;
    }
    const customerId = method === "fiado" ? customer?.id : undefined;
    const res = await onConfirm(method, customerId);
    if (!res.ok) return;
    handleOpenChange(false);
  }

  async function handleCashConfirm() {
    const res = await onConfirm("dinheiro", undefined);
    if (!res.ok) return;
    setSuccessData({
      saleId: res.saleId ?? "",
      trocoCents,
      printWarning: res.printWarning,
    });
    setStep("success");
  }

  async function handleReprint() {
    if (!successData?.saleId) return;
    setReprinting(true);
    setReprintMsg(null);
    const res = await reprintReceiptAction({ saleId: successData.saleId });
    setReprinting(false);
    setReprintMsg(
      res.ok ? "Cupom impresso!" : (res.error ?? "Falha ao imprimir"),
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        {step === "select" && (
          <>
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
                <Label htmlFor="checkout-customer">
                  Cliente (obrigatório para fiado)
                </Label>
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
                      onClick={() => handleMethod(m.value)}
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
          </>
        )}

        {step === "cash" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Pagamento em dinheiro</AlertDialogTitle>
              <AlertDialogDescription>
                Total a pagar:{" "}
                <span className="font-mono font-bold text-foreground">
                  {centsToBRL(totalCents)}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="valor-recebido">Valor recebido</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    R$
                  </span>
                  <input
                    id="valor-recebido"
                    autoFocus
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valorInput}
                    onChange={(e) => setValorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canConfirm) handleCashConfirm();
                    }}
                    className="w-full rounded-md border border-input bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-ring"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-700">Troco</span>
                <span className="text-lg font-bold text-green-700">
                  {centsToBRL(trocoCents)}
                </span>
              </div>
            </div>

            <AlertDialogFooter>
              <Button
                variant="ghost"
                onClick={() => setStep("select")}
                disabled={isSubmitting}
              >
                Voltar
              </Button>
              <Button
                onClick={handleCashConfirm}
                disabled={isSubmitting || !canConfirm}
              >
                {isSubmitting ? "Confirmando..." : "Confirmar venda"}
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {step === "success" && successData && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Venda registrada!</AlertDialogTitle>
              <AlertDialogDescription>
                {successData.trocoCents > 0 ? (
                  <>
                    Troco:{" "}
                    <span className="font-mono font-bold text-foreground">
                      {centsToBRL(successData.trocoCents)}
                    </span>
                  </>
                ) : (
                  "Pagamento exato."
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="grid gap-2">
              {successData.printWarning && (
                <p className="text-sm text-amber-600">
                  {successData.printWarning}
                </p>
              )}
              {reprintMsg && (
                <p
                  className={[
                    "text-sm",
                    reprintMsg === "Cupom impresso!"
                      ? "text-green-600"
                      : "text-destructive",
                  ].join(" ")}
                >
                  {reprintMsg}
                </p>
              )}
            </div>

            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={handleReprint}
                disabled={reprinting || !successData.saleId}
              >
                {reprinting ? "Imprimindo..." : "Reimprimir cupom"}
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
