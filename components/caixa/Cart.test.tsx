import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Cart } from "./Cart";
import type { CartItem } from "./use-cart";

const items: CartItem[] = [
  {
    productId: "p1",
    name: "Refri Lata",
    unit: "un",
    unitPriceCents: 1000,
    quantity: 2,
    emoji: "🥤",
    category: "Bebidas",
    imageUrl: null,
  },
];

describe("Cart (RF04/RF05)", () => {
  it("T17 — mostra subtotal e controles +/−", async () => {
    const onSetQuantity = vi.fn();
    const onRemove = vi.fn();
    render(
      <Cart items={items} onSetQuantity={onSetQuantity} onRemove={onRemove} />,
    );

    // subtotal = 1000 × 2 = R$ 20,00
    expect(screen.getByText(/20,00/)).toBeInTheDocument();

    // increase quantity via + button
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /aumentar quantidade de refri lata/i }),
    );
    expect(onSetQuantity).toHaveBeenLastCalledWith("p1", 3);
  });

  it("chama onSetQuantity ao diminuir quantidade > 1", async () => {
    const onSetQuantity = vi.fn();
    const onRemove = vi.fn();
    render(
      <Cart items={items} onSetQuantity={onSetQuantity} onRemove={onRemove} />,
    );

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /diminuir quantidade de refri lata/i }),
    );
    expect(onSetQuantity).toHaveBeenCalledWith("p1", 1);
  });

  it("chama onRemove ao diminuir com quantidade = 1", async () => {
    const singleItem: CartItem[] = [
      {
        productId: "p1",
        name: "Refri Lata",
        unit: "un",
        unitPriceCents: 1000,
        quantity: 1,
        emoji: null,
        category: null,
        imageUrl: null,
      },
    ];
    const onSetQuantity = vi.fn();
    const onRemove = vi.fn();
    render(
      <Cart
        items={singleItem}
        onSetQuantity={onSetQuantity}
        onRemove={onRemove}
      />,
    );

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /diminuir quantidade de refri lata/i }),
    );
    expect(onRemove).toHaveBeenCalledWith("p1");
  });

  it("retorna null para carrinho vazio", () => {
    const { container } = render(
      <Cart items={[]} onSetQuantity={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
