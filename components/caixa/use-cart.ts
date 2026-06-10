"use client";

import * as React from "react";

import type { ProductDto, ProductUnit } from "@/types/product";

export type CartItem = {
  productId: string;
  name: string;
  unit: ProductUnit;
  unitPriceCents: number;
  quantity: number;
};

/** Subtotal em centavos = round(preço × quantidade) — espelha o servidor (RN06). */
export function itemSubtotal(item: CartItem): number {
  return Math.round(item.unitPriceCents * item.quantity);
}

type State = { items: CartItem[] };
type Action =
  | { type: "add"; product: ProductDto }
  | { type: "setQuantity"; productId: string; quantity: number }
  | { type: "remove"; productId: string }
  | { type: "clear" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "add": {
      const exists = state.items.some(
        (i) => i.productId === action.product.id,
      );
      if (exists) {
        // Produto por peso: re-bipar NÃO soma — o peso é digitado pelo operador
        // (RF03). Já está no carrinho, então é no-op.
        if (action.product.unit === "kg") return state;
        // Produto por unidade: cada bipagem soma 1 (RF01).
        return {
          items: state.items.map((i) =>
            i.productId === action.product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            productId: action.product.id,
            name: action.product.name,
            unit: action.product.unit,
            unitPriceCents: action.product.salePriceCents,
            quantity: 1,
          },
        ],
      };
    }
    case "setQuantity":
      return {
        items: state.items.map((i) =>
          i.productId === action.productId
            ? { ...i, quantity: action.quantity }
            : i,
        ),
      };
    case "remove":
      return {
        items: state.items.filter((i) => i.productId !== action.productId),
      };
    case "clear":
      return { items: [] };
  }
}

/** Estado do carrinho da venda em andamento (volátil — não persiste). */
export function useCart() {
  const [state, dispatch] = React.useReducer(reducer, { items: [] });
  const totalCents = state.items.reduce((sum, i) => sum + itemSubtotal(i), 0);

  return {
    items: state.items,
    totalCents,
    addProduct: (product: ProductDto) => dispatch({ type: "add", product }),
    setQuantity: (productId: string, quantity: number) =>
      dispatch({ type: "setQuantity", productId, quantity }),
    removeItem: (productId: string) => dispatch({ type: "remove", productId }),
    clear: () => dispatch({ type: "clear" }),
  };
}
