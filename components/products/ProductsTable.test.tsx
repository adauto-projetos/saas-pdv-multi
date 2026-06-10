import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProductDto } from "@/types/product";

import { ProductsTable } from "./ProductsTable";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const product: ProductDto = {
  id: "p1",
  tenantId: "t1",
  name: "Coca-Cola 350ml",
  barcode: null,
  unit: "un",
  costCents: 1000,
  markupPercent: 30,
  salePriceCents: 1300,
  priceIsManual: false,
  stockQuantity: 5,
  createdAt: "2026-06-09T00:00:00.000Z",
  updatedAt: "2026-06-09T00:00:00.000Z",
};

describe("ProductsTable (RF08)", () => {
  it("T17 — mostra estoque somente leitura, sem controle editável", () => {
    render(<ProductsTable products={[product]} />);

    expect(screen.getByTestId("stock-cell")).toHaveTextContent("5");
    // nenhum input de estoque (spinbutton/textbox) na tabela
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
