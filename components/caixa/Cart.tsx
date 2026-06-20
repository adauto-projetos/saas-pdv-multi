"use client";

import { centsToBRL } from "@/lib/format/money";

import { itemSubtotal, type CartItem } from "./use-cart";

const CATEGORY_BG: Record<string, string> = {
  Bebidas:    "#e0f2fe",
  Hortifruti: "#dcfce7",
  Mercearia:  "#fef3c7",
  Lanches:    "#ffedd5",
  Doces:      "#fce7f3",
  Limpeza:    "#cffafe",
  Outros:     "#f1f5f9",
};

function tileBg(category: string | null): string {
  if (!category) return CATEGORY_BG["Outros"];
  return CATEGORY_BG[category] ?? CATEGORY_BG["Outros"];
}

export function Cart({
  items,
  onSetQuantity,
  onRemove,
}: {
  items: CartItem[];
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {items.map((item) => (
        <div
          key={item.productId}
          data-testid="cart-row"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: 10,
            borderRadius: 14,
            border: "1px solid #f1f3f7",
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              flexShrink: 0,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              background: tileBg(item.category),
            }}
          >
            {item.emoji ?? "📦"}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 13.5,
                color: "#0f172a",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.name}
            </div>
            <div style={{ fontSize: 12, color: "#9aa3b2", fontWeight: 600 }}>
              {centsToBRL(item.unitPriceCents)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              background: "#f4f5f8",
              borderRadius: 10,
              padding: 3,
            }}
          >
            <button
              aria-label={`Diminuir quantidade de ${item.name}`}
              onClick={() =>
                item.quantity <= 1
                  ? onRemove(item.productId)
                  : onSetQuantity(item.productId, item.quantity - 1)
              }
              style={{
                width: 26,
                height: 26,
                border: "none",
                borderRadius: 8,
                background: "#fff",
                color: "#475569",
                fontSize: 17,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 2px rgba(0,0,0,.06)",
              }}
            >
              −
            </button>
            <span
              style={{
                minWidth: 24,
                textAlign: "center",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              {item.quantity % 1 === 0
                ? item.quantity
                : item.quantity.toFixed(3)}
            </span>
            <button
              aria-label={`Aumentar quantidade de ${item.name}`}
              onClick={() => onSetQuantity(item.productId, item.quantity + 1)}
              style={{
                width: 26,
                height: 26,
                border: "none",
                borderRadius: 8,
                background: "#fff",
                color: "#4f46e5",
                fontSize: 17,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 1px 2px rgba(0,0,0,.06)",
              }}
            >
              +
            </button>
          </div>

          <div
            style={{
              width: 72,
              textAlign: "right",
              fontWeight: 800,
              fontSize: 14,
              color: "#0f172a",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {centsToBRL(itemSubtotal(item))}
          </div>
        </div>
      ))}
    </div>
  );
}
