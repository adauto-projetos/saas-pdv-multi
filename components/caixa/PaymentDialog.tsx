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
import { CustomerPicker } from "@/components/financeiro/CustomerPicker";
import { centsToBRL } from "@/lib/format/money";
import type { CustomerDto } from "@/types/finance";
import type { PaymentMethod } from "@/types/sale";

type Step = "select" | "cash" | "success";

export interface ConfirmResult {
  ok: boolean;
  error?: string;
  saleId?: string;
  printWarning?: string;
}

const METHOD_CARDS: { value: PaymentMethod; emoji: string; label: string }[] = [
  { value: "dinheiro", emoji: "💵", label: "Dinheiro" },
  { value: "cartao",   emoji: "💳", label: "Cartão" },
  { value: "pix",      emoji: "⚡", label: "Pix" },
];

function quickAmounts(totalCents: number): number[] {
  const totalBRL = totalCents / 100;
  const roundUp = Math.ceil(totalBRL / 5) * 5;
  const bills = [5, 10, 20, 50, 100].filter((v) => v > roundUp);
  return [roundUp, ...bills].slice(0, 4);
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

  const amounts = quickAmounts(totalCents);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        {/* ── STEP: select ── */}
        {step === "select" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalizar venda</AlertDialogTitle>
              <AlertDialogDescription>
                <span
                  style={{
                    fontFamily: "var(--font-jakarta)",
                    fontWeight: 800,
                    fontSize: 28,
                    color: "#0f172a",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: -1,
                    display: "block",
                  }}
                >
                  {centsToBRL(totalCents)}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* 3 main method cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                marginBottom: 12,
              }}
            >
              {METHOD_CARDS.map((m) => (
                <button
                  key={m.value}
                  aria-label={m.label}
                  disabled={isSubmitting}
                  onClick={() => handleMethod(m.value)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "18px 8px",
                    border: "1px solid #eef1f5",
                    borderRadius: 16,
                    background: "#fff",
                    cursor: isSubmitting ? "default" : "pointer",
                    transition: "border-color .12s, box-shadow .12s",
                    boxShadow: "0 1px 2px rgba(16,24,40,.04)",
                  }}
                >
                  <span style={{ fontSize: 32 }}>{m.emoji}</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#0f172a",
                    }}
                  >
                    {m.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Fiado section */}
            <div
              style={{
                borderTop: "1px solid #f1f3f7",
                paddingTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <CustomerPicker
                inputId="checkout-customer"
                value={customer}
                onSelect={setCustomer}
              />
              <button
                disabled={!customer || isSubmitting}
                onClick={() => handleMethod("fiado")}
                style={{
                  width: "100%",
                  height: 44,
                  border: "none",
                  borderRadius: 12,
                  background: customer ? "#0f172a" : "#f1f5f9",
                  color: customer ? "#fff" : "#94a3b8",
                  font: "inherit",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: customer && !isSubmitting ? "pointer" : "default",
                }}
              >
                💰 Fiado (selecione o cliente acima)
              </button>
            </div>

            <AlertDialogFooter>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            </AlertDialogFooter>
          </>
        )}

        {/* ── STEP: cash ── */}
        {step === "cash" && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>💵 Pagamento em dinheiro</AlertDialogTitle>
              <AlertDialogDescription>
                Total:{" "}
                <span
                  style={{
                    fontFamily: "var(--font-jakarta)",
                    fontWeight: 800,
                    fontSize: 20,
                    color: "#0f172a",
                  }}
                >
                  {centsToBRL(totalCents)}
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Valor recebido input */}
              <div>
                <label
                  htmlFor="valor-recebido"
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#475569",
                    marginBottom: 7,
                  }}
                >
                  Valor recebido
                </label>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#94a3b8",
                      pointerEvents: "none",
                    }}
                  >
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
                    style={{
                      width: "100%",
                      height: 52,
                      border: "1px solid #e8ebf1",
                      borderRadius: 12,
                      paddingLeft: 40,
                      paddingRight: 14,
                      fontSize: 20,
                      fontWeight: 700,
                      outline: "none",
                      color: "#0f172a",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              {/* Quick amounts */}
              {amounts.length > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  {amounts.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setValorInput(String(amt))}
                      style={{
                        flex: 1,
                        height: 40,
                        border: "1px solid #e8ebf1",
                        borderRadius: 10,
                        background: "#f8fafc",
                        color: "#475569",
                        font: "inherit",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      R${amt}
                    </button>
                  ))}
                </div>
              )}

              {/* Troco */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: trocoCents > 0 ? "#f0fdf4" : "#f8fafc",
                  borderRadius: 12,
                  padding: "14px 16px",
                  border: `1px solid ${trocoCents > 0 ? "#bbf7d0" : "#f1f5f9"}`,
                }}
              >
                <span
                  style={{ fontSize: 14, fontWeight: 700, color: "#475569" }}
                >
                  Troco
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-jakarta)",
                    fontWeight: 800,
                    fontSize: 22,
                    color: trocoCents > 0 ? "#16a34a" : "#cbd5e1",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
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

        {/* ── STEP: success ── */}
        {step === "success" && successData && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>✅ Venda registrada!</AlertDialogTitle>
              <AlertDialogDescription>
                {successData.trocoCents > 0 ? (
                  <>
                    Troco:{" "}
                    <span
                      style={{
                        fontFamily: "var(--font-jakarta)",
                        fontWeight: 800,
                        fontSize: 22,
                        color: "#16a34a",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {centsToBRL(successData.trocoCents)}
                    </span>
                  </>
                ) : (
                  "Pagamento exato — sem troco."
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {successData.printWarning && (
                <p
                  style={{
                    fontSize: 13,
                    color: "#b45309",
                    background: "#fef3c7",
                    padding: "10px 14px",
                    borderRadius: 10,
                    margin: 0,
                  }}
                >
                  {successData.printWarning}
                </p>
              )}
              {reprintMsg && (
                <p
                  style={{
                    fontSize: 13,
                    color: reprintMsg === "Cupom impresso!" ? "#16a34a" : "#dc2626",
                    margin: 0,
                  }}
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
