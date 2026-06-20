"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  finalizeSaleAction,
  lookupProductByBarcodeAction,
} from "@/app/(app)/caixa/actions";
import { centsToBRL } from "@/lib/format/money";
import { PRODUCT_CATEGORIES } from "@/lib/validation/product";
import type { ProductDto } from "@/types/product";
import type { PaymentMethod } from "@/types/sale";

import { Cart } from "./Cart";
import { type ConfirmResult, PaymentDialog } from "./PaymentDialog";
import { useCart } from "./use-cart";

const CATEGORY_COLORS: Record<string, { bg: string; fg: string; bd: string }> = {
  Bebidas:    { bg: "#e0f2fe", fg: "#0369a1", bd: "#bae6fd" },
  Hortifruti: { bg: "#dcfce7", fg: "#15803d", bd: "#bbf7d0" },
  Mercearia:  { bg: "#fef3c7", fg: "#b45309", bd: "#fde68a" },
  Lanches:    { bg: "#ffedd5", fg: "#c2410c", bd: "#fed7aa" },
  Doces:      { bg: "#fce7f3", fg: "#be185d", bd: "#fbcfe8" },
  Limpeza:    { bg: "#cffafe", fg: "#0e7490", bd: "#a5f3fc" },
  Outros:     { bg: "#f1f5f9", fg: "#475569", bd: "#e2e8f0" },
};

function getCategoryStyle(category: string | null) {
  if (!category) return CATEGORY_COLORS["Outros"];
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS["Outros"];
}

function getStockBadge(p: ProductDto): { label: string; bg: string; color: string } {
  if (p.stockQuantity === 0)
    return { label: "Sem est.", bg: "#fee2e2", color: "#dc2626" };
  if (p.minStock !== null && p.stockQuantity <= p.minStock)
    return { label: "Baixo", bg: "#fef3c7", color: "#b45309" };
  return { label: String(p.stockQuantity), bg: "#dcfce7", color: "#15803d" };
}

const ALL_CATEGORIES = ["Todos", ...PRODUCT_CATEGORIES] as const;

export function CashierScreen({ products }: { products: ProductDto[] }) {
  const cart = useCart();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState("Todos");
  const searchRef = React.useRef<HTMLInputElement>(null);

  const availableCategories = React.useMemo(() => {
    const cats = new Set(products.map((p) => p.category ?? "Outros"));
    return ALL_CATEGORIES.filter((c) => c === "Todos" || cats.has(c));
  }, [products]);

  const filteredProducts = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    return products.filter((p) => {
      const matchesCat =
        activeCategory === "Todos" ||
        (p.category ?? "Outros") === activeCategory;
      const matchesQ = !q || p.name.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [products, query, activeCategory]);

  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = query.trim();
    if (!code) return;

    if (filteredProducts.length > 0) {
      cart.addProduct(filteredProducts[0]);
      setQuery("");
      searchRef.current?.focus();
      return;
    }

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
    setQuery("");
    searchRef.current?.focus();
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
    return { ok: true, saleId: res.data.id, printWarning: res.printWarning };
  }

  const empty = cart.items.length === 0;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* LEFT: product grid */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          padding: "22px 24px 0",
        }}
      >
        {/* Search row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 16,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 11,
              background: "#fff",
              border: "1px solid #e8ebf1",
              borderRadius: 14,
              padding: "0 16px",
              height: 52,
              boxShadow: "0 1px 2px rgba(16,24,40,.04)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9aa3b2"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              autoFocus
              aria-label="Código de barras ou nome do produto"
              data-testid="barcode-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Bipe o código ou busque pelo nome — Enter adiciona"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: 15,
                fontWeight: 600,
                background: "transparent",
                color: "#0f172a",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              background: "#fff",
              border: "1px solid #e8ebf1",
              borderRadius: 14,
              height: 52,
              padding: "0 18px",
              boxShadow: "0 1px 2px rgba(16,24,40,.04)",
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                letterSpacing: "1.5px",
                fontWeight: 800,
                color: "#aab2c0",
              }}
            >
              ITENS
            </span>
            <span
              style={{
                fontFamily: "var(--font-jakarta)",
                fontSize: 20,
                fontWeight: 800,
                color: "#4f46e5",
                minWidth: 18,
                textAlign: "center",
              }}
            >
              {cart.items.length}
            </span>
          </div>
        </div>

        {/* Category pills */}
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 14,
            flexShrink: 0,
          }}
        >
          {availableCategories.map((cat) => {
            const active = cat === activeCategory;
            const catColor =
              cat === "Todos"
                ? { bg: "#eef2ff", fg: "#4f46e5", bd: "#c7d2fe" }
                : CATEGORY_COLORS[cat] ?? { bg: "#f1f5f9", fg: "#475569", bd: "#e2e8f0" };
            const style = active
              ? catColor
              : { bg: "#fff", fg: "#64748b", bd: "#e8ebf1" };
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "9px 16px",
                  border: `1px solid ${style.bd}`,
                  borderRadius: 11,
                  background: style.bg,
                  color: style.fg,
                  font: "inherit",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Product grid */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            paddingRight: 4,
            paddingBottom: 24,
          }}
        >
          {filteredProducts.length === 0 ? (
            <div
              style={{
                paddingTop: 60,
                textAlign: "center",
                color: "#aab2c0",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Nenhum produto encontrado
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 14,
              }}
            >
              {filteredProducts.map((p) => {
                const catStyle = getCategoryStyle(p.category);
                const stock = getStockBadge(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => cart.addProduct(p)}
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      gap: 9,
                      padding: 13,
                      border: "1px solid #eef1f5",
                      borderRadius: 18,
                      background: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      boxShadow: "0 1px 2px rgba(16,24,40,.04)",
                      transition: "transform .08s, box-shadow .15s",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1.5",
                        borderRadius: 13,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 42,
                        background: catStyle.bg,
                      }}
                    >
                      {p.emoji ?? "📦"}
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13.5,
                        color: "#0f172a",
                        lineHeight: 1.25,
                        minHeight: 34,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 800,
                          color: "#4f46e5",
                          fontSize: 15.5,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {centsToBRL(p.salePriceCents)}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: stock.color,
                          background: stock.bg,
                          padding: "3px 7px",
                          borderRadius: 7,
                        }}
                      >
                        {stock.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: cart panel */}
      <div
        style={{
          width: 392,
          flexShrink: 0,
          background: "#fff",
          borderLeft: "1px solid #edf0f4",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
        }}
      >
        {/* Cart header */}
        <div
          style={{
            padding: "22px 22px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f1f3f7",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: "#eef2ff",
                color: "#4f46e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-jakarta)",
                  fontWeight: 800,
                  fontSize: 17,
                }}
              >
                Carrinho
              </div>
              <div style={{ fontSize: 12, color: "#9aa3b2", fontWeight: 600 }}>
                {cart.items.length}{" "}
                {cart.items.length === 1 ? "item" : "itens"}
              </div>
            </div>
          </div>
          <button
            onClick={cart.clear}
            disabled={empty}
            style={{
              background: "none",
              border: "none",
              color: "#b6bdc9",
              font: "inherit",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: empty ? "default" : "pointer",
              opacity: empty ? 0.5 : 1,
            }}
          >
            Limpar
          </button>
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {empty ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: 14,
                padding: 30,
              }}
            >
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: "50%",
                  background: "#f4f5f8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c3cad6"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                </svg>
              </div>
              <div
                style={{ fontWeight: 800, fontSize: 16, color: "#475569" }}
              >
                Carrinho vazio
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#aab2c0",
                  fontWeight: 600,
                  maxWidth: 220,
                  lineHeight: 1.5,
                }}
              >
                Bipe um código ou toque num produto ao lado para começar
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

        {/* Cart footer */}
        <div
          style={{
            borderTop: "1px solid #f1f3f7",
            padding: "16px 18px 18px",
            background: "#fcfcfd",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: "#94a3b8",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            <span>Subtotal</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {centsToBRL(cart.totalCents)}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 16,
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 15 }}>Total</span>
            <span
              style={{
                fontFamily: "var(--font-jakarta)",
                fontWeight: 800,
                fontSize: 30,
                color: "#0f172a",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: -1,
              }}
            >
              {centsToBRL(cart.totalCents)}
            </span>
          </div>
          <button
            onClick={() => {
              if (!empty) setDialogOpen(true);
            }}
            disabled={empty || submitting}
            style={{
              width: "100%",
              height: 56,
              border: "none",
              borderRadius: 15,
              background: empty ? "#cbd5e1" : "#4f46e5",
              color: "#fff",
              font: "inherit",
              fontSize: 16.5,
              fontWeight: 800,
              cursor: empty ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: empty ? "none" : "0 8px 24px rgba(79,70,229,.28)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Finalizar venda
          </button>
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
