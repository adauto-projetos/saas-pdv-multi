import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/caixa/actions", () => ({
  finalizeSaleAction: vi.fn(),
  lookupProductByBarcodeAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/caixa" }));

import { CashierScreen } from "./CashierScreen";
import type { ProductDto } from "@/types/product";

function product(overrides: Partial<ProductDto>): ProductDto {
  return {
    id: "p1",
    name: "Refri Lata",
    salePriceCents: 500,
    costCents: 300,
    markupPercent: 67,
    priceIsManual: false,
    unit: "un",
    barcode: null,
    emoji: null,
    category: "Bebidas",
    imageKey: null,
    imageUrl: null,
    stockQuantity: 10,
    minStock: 2,
    tenantId: "t1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("CashierScreen foto (RF04/RF05/RNF03)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("T05 — produto com imageUrl renderiza <img>, não emoji", () => {
    const { container } = render(
      <CashierScreen
        products={[product({ imageUrl: "https://r2/foto.webp", emoji: "🥤" })]}
      />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("https://r2/foto.webp");
    // Emoji não aparece como texto quando há foto.
    expect(screen.queryByText("🥤")).toBeNull();
  });

  it("T06 — fallback foto → emoji → 📦", () => {
    const { rerender } = render(
      <CashierScreen products={[product({ imageUrl: null, emoji: "🍺" })]} />,
    );
    // Sem foto, com emoji => emoji.
    expect(screen.getByText("🍺")).toBeInTheDocument();

    // Sem foto e sem emoji => ícone genérico 📦.
    rerender(
      <CashierScreen products={[product({ imageUrl: null, emoji: null })]} />,
    );
    expect(screen.getByText("📦")).toBeInTheDocument();
  });

  it("T24 — foto usa lazy-loading", () => {
    const { container } = render(
      <CashierScreen
        products={[product({ imageUrl: "https://r2/foto.webp" })]}
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("loading", "lazy");
  });
});
