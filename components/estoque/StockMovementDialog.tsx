"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
  recordAdjustmentAction,
  recordEntryAction,
} from "@/app/(app)/estoque/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductDto } from "@/types/product";

import { ProductPicker } from "./ProductPicker";

type Mode = "entrada" | "ajuste";

/** Registra entrada (RF01) ou ajuste por contagem (RF02). */
export function StockMovementDialog({
  defaultProduct = null,
  onRecorded,
}: {
  defaultProduct?: ProductDto | null;
  onRecorded?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("entrada");
  const [product, setProduct] = React.useState<ProductDto | null>(defaultProduct);
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!product) {
      toast.error("Selecione um produto.");
      return;
    }
    const value = Number(amount);
    if (amount === "" || Number.isNaN(value)) {
      toast.error("Informe a quantidade.");
      return;
    }
    if (mode === "entrada" && value <= 0) {
      toast.error("A quantidade deve ser maior que zero.");
      return;
    }

    setSubmitting(true);
    const res =
      mode === "entrada"
        ? await recordEntryAction({
            productId: product.id,
            quantity: value,
            reason: reason || undefined,
          })
        : await recordAdjustmentAction({
            productId: product.id,
            countedQuantity: value,
            reason: reason || undefined,
          });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      mode === "entrada" ? "Entrada registrada" : "Estoque ajustado",
    );
    setAmount("");
    setReason("");
    setProduct(defaultProduct); // limpa a seleção (ou volta ao produto fixo)
    onRecorded?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border p-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "entrada" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setMode("entrada");
            setAmount("");
          }}
        >
          Entrada
        </Button>
        <Button
          type="button"
          variant={mode === "ajuste" ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setMode("ajuste");
            setAmount("");
          }}
        >
          Ajuste (inventário)
        </Button>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="product-search">Produto</Label>
        <ProductPicker value={product} onSelect={setProduct} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="amount">
          {mode === "entrada" ? "Quantidade a adicionar" : "Contagem real"}
        </Label>
        <Input
          id="amount"
          type="number"
          inputMode="decimal"
          min={mode === "entrada" ? 0.001 : 0}
          step="0.001"
          className="text-base"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="reason">Motivo (opcional)</Label>
        <Input
          id="reason"
          className="text-base"
          placeholder={mode === "entrada" ? "Ex.: compra fornecedor" : "Ex.: correção de inventário"}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <Button type="submit" disabled={submitting} className="w-fit">
        {submitting ? "Salvando..." : "Registrar movimentação"}
      </Button>
    </form>
  );
}
