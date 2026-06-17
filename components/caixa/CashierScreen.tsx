"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  finalizeSaleAction,
  lookupProductByBarcodeAction,
} from "@/app/(app)/caixa/actions";
import { centsToBRL } from "@/lib/format/money";
import type { PaymentMethod } from "@/types/sale";

import { Cart } from "./Cart";
import { CombinedSearch } from "./CombinedSearch";
import { type ConfirmResult, PaymentDialog } from "./PaymentDialog";
import { useCart } from "./use-cart";

const PAYMENT_PILLS: { value: PaymentMethod; label: string; colors: [string, string] }[] = [
  { value: "dinheiro", label: "Dinheiro", colors: ["#16a34a", "#15803d"] },
  { value: "cartao", label: "Cartão", colors: ["#4f46e5", "#4338ca"] },
  { value: "pix", label: "Pix", colors: ["#0891b2", "#0e7490"] },
];

export function CashierScreen() {
  const cart = useCart();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [lookingUp, setLookingUp] = React.useState(false);
  const [payMethod, setPayMethod] = React.useState<PaymentMethod>("dinheiro");

  async function handleBarcode(code: string, qty: number) {
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
      cart.addProductWithQty(res.data, qty);
    } catch {
      toast.error("Erro ao buscar o produto.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleConfirm(
    method: PaymentMethod,
    customerId?: string,
  ): Promise<ConfirmResult> {
    setSubmitting(true);
    const res = await finalizeSaleAction({
      items: cart.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
      paymentMethod: method,
      ...(method === "fiado" ? { customerId } : {}),
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return { ok: false, error: res.error };
    }
    if (method !== "dinheiro") {
      toast.success(`Venda registrada — ${centsToBRL(res.data.totalCents)}`);
    }
    cart.clear();
    setPayMethod("dinheiro");
    return { ok: true, saleId: res.data.id, printWarning: res.printWarning };
  }

  const empty = cart.items.length === 0;

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ padding: "16px 20px", gap: 12 }}
    >
      {/* Search row */}
      <div className="shrink-0">
        <CombinedSearch
          onSelect={(p, qty) => cart.addProductWithQty(p, qty)}
          onBarcode={handleBarcode}
          disabled={submitting || lookingUp}
        />
      </div>

      {/* Cart card */}
      <div
        className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      >
        {/* Cart header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16a34a"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6" />
            </svg>
            <span className="text-sm font-semibold text-gray-900">
              Carrinho
            </span>
            <span className="text-[12px] text-gray-400">
              {cart.items.length}{" "}
              {cart.items.length === 1 ? "item" : "itens"}
            </span>
          </div>
          <button
            onClick={cart.clear}
            disabled={empty}
            className="rounded-md px-2 py-1 text-[12px] text-gray-400 hover:text-gray-600 disabled:opacity-40"
          >
            Limpar tudo
          </button>
        </div>

        {/* Items area */}
        <div className="flex-1 overflow-y-auto">
          {empty ? (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3.5 px-10 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6" />
                </svg>
              </div>
              <div className="text-[14px] font-medium text-gray-700">
                Carrinho vazio
              </div>
              <div className="text-[13px] leading-relaxed text-gray-400">
                Bipe um código ou busque pelo nome acima
              </div>
            </div>
          ) : (
            <Cart
              items={cart.items}
              onSetQuantity={cart.setQuantity}
              onRemove={cart.removeItem}
            />
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex shrink-0 items-center gap-4 border-t border-gray-200 bg-slate-50 px-5 py-3.5">
          {/* Payment pills */}
          <div className="flex shrink-0 gap-1.5">
            {PAYMENT_PILLS.map(({ value, label, colors }) => {
              const active = payMethod === value;
              return (
                <button
                  key={value}
                  onClick={() => setPayMethod(value)}
                  style={{
                    background: active ? colors[1] : colors[0],
                    border: active
                      ? "2px solid rgba(255,255,255,0.35)"
                      : "2px solid transparent",
                    boxShadow: active ? "0 2px 8px rgba(0,0,0,0.22)" : "none",
                    opacity: active ? 1 : 0.78,
                  }}
                  className="rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white transition-all"
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          {/* Total */}
          <div className="flex shrink-0 items-baseline gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-500">
              Total
            </span>
            <span className="text-[28px] font-bold leading-none tracking-tight text-gray-900">
              {centsToBRL(cart.totalCents)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-2">
            <button
              onClick={cart.clear}
              disabled={empty || submitting}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!empty) setDialogOpen(true);
              }}
              disabled={empty || submitting}
              className="rounded-lg bg-green-600 px-5 py-2 text-[13px] font-semibold text-white hover:bg-green-700 disabled:opacity-40"
            >
              Finalizar venda
            </button>
          </div>
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
