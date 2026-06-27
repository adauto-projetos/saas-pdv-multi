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
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {items.map((item) => (
        <div
          key={item.productId}
          data-testid="cart-row"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            borderRadius: 10,
            border: "1px solid #f1f3f7",
          }}
        >
          {/* Foto / emoji tile (fallback foto → emoji → 📦) */}
          <div
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              overflow: "hidden",
              background: tileBg(item.category),
            }}
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt=""
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              item.emoji || "📦"
            )}
          </div>

          {/* Name + unit price */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 12.5,
                color: "#0f172a",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.name}
            </div>
            <div style={{ fontSize: 11, color: "#9aa3b2", fontWeight: 600 }}>
              {centsToBRL(item.unitPriceCents)}
            </div>
          </div>

          {/* Qty controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              background: "#f4f5f8",
              borderRadius: 8,
              padding: 2,
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
                width: 22,
                height: 22,
                border: "none",
                borderRadius: 6,
                background: "#fff",
                color: "#475569",
                fontSize: 15,
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
                minWidth: 20,
                textAlign: "center",
                fontWeight: 800,
                fontSize: 13,
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
                width: 22,
                height: 22,
                border: "none",
                borderRadius: 6,
                background: "#fff",
                color: "#4f46e5",
                fontSize: 15,
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

          {/* Subtotal */}
          <div
            style={{
              width: 60,
              textAlign: "right",
              fontWeight: 800,
              fontSize: 13,
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
