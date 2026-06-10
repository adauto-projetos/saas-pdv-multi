import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Cart } from "./Cart";
import type { CartItem } from "./use-cart";

const items: CartItem[] = [
  { productId: "p1", name: "Refri Lata", unit: "un", unitPriceCents: 1000, quantity: 2 },
];

describe("Cart (RF04/RF05)", () => {
  it("T17 — mostra subtotal, edita quantidade e remove item", async () => {
    const onSetQuantity = vi.fn();
    const onRemove = vi.fn();
    render(
      <Cart items={items} onSetQuantity={onSetQuantity} onRemove={onRemove} />,
    );

    // subtotal = 1000 × 2 = R$ 20,00
    expect(screen.getByText(/20,00/)).toBeInTheDocument();

    const qty = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(qty, { target: { value: "3" } });
    expect(onSetQuantity).toHaveBeenLastCalledWith("p1", 3);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /remover refri/i }));
    expect(onRemove).toHaveBeenCalledWith("p1");
  });

  it("mostra estado vazio sem itens", () => {
    render(<Cart items={[]} onSetQuantity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/carrinho vazio/i)).toBeInTheDocument();
  });
});
