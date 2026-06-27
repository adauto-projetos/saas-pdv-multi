import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProductDto } from "@/types/product";

import { LowStockList } from "./LowStockList";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const product: ProductDto = {
  id: "p1",
  tenantId: "t1",
  name: "Arroz 5kg",
  barcode: null,
  unit: "un",
  costCents: 2000,
  markupPercent: 30,
  salePriceCents: 2600,
  priceIsManual: false,
  stockQuantity: 2,
  minStock: 5,
  emoji: null,
  category: null,
  imageKey: null,
  imageUrl: null,
  createdAt: "",
  updatedAt: "",
};

describe("LowStockList (RF07)", () => {
  it("T18 — renderiza produtos com estoque baixo", () => {
    render(<LowStockList products={[product]} />);
    expect(screen.getByTestId("low-row")).toBeInTheDocument();
    expect(screen.getByText("Arroz 5kg")).toBeInTheDocument();
  });

  it("mostra estado vazio sem produtos", () => {
    render(<LowStockList products={[]} />);
    expect(screen.getByText(/nenhum produto com estoque baixo/i)).toBeInTheDocument();
  });
});
