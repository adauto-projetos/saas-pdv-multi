"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  finalizeSaleAction,
  lookupProductByBarcodeAction,
} from "@/app/(app)/caixa/actions";
import { centsToBRL } from "@/lib/format/money";
import type { PaymentMethod } from "@/types/sale";

import { BarcodeInput } from "./BarcodeInput";
import { Cart } from "./Cart";
import { CartSummary } from "./CartSummary";
import { PaymentDialog } from "./PaymentDialog";
import { ProductSearch } from "./ProductSearch";
import { useCart } from "./use-cart";

export function CashierScreen() {
  const cart = useCart();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [lookingUp, setLookingUp] = React.useState(false);

  async function handleBarcode(code: string) {
    setLookingUp(true);
    try {
      const res = await lookupProductByBarcodeAction(code);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (!res.data) {
        toast.error("Produto não encontrado.");
        return;
      }
      cart.addProduct(res.data);
    } catch {
      toast.error("Erro ao buscar o produto.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleConfirm(method: PaymentMethod) {
    setSubmitting(true);
    const res = await finalizeSaleAction({
      items: cart.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
      paymentMethod: method,
    });
    setSubmitting(false);
    setDialogOpen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Venda registrada — ${centsToBRL(res.data.totalCents)}`);
    cart.clear();
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">Caixa</h1>

      <div className="grid gap-6 md:grid-cols-[1fr_340px] md:items-start">
        <div className="grid gap-3">
          <BarcodeInput
            onSubmit={handleBarcode}
            disabled={submitting || lookingUp}
          />
          <ProductSearch onSelect={(p) => cart.addProduct(p)} />
        </div>

        <div className="grid gap-4 md:sticky md:top-20">
          <Cart
            items={cart.items}
            onSetQuantity={cart.setQuantity}
            onRemove={cart.removeItem}
          />
          <CartSummary
            totalCents={cart.totalCents}
            itemCount={cart.items.length}
            onFinalize={() => setDialogOpen(true)}
            onCancel={cart.clear}
            disabled={submitting}
          />
        </div>
      </div>

      <PaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        totalCents={cart.totalCents}
        onConfirm={handleConfirm}
        isSubmitting={submitting}
      />
    </div>
  );
}
