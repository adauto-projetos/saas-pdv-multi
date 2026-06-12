import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PaymentDialog } from "./PaymentDialog";

describe("PaymentDialog (checkout — RF07)", () => {
  it("T19 — escolher a forma de pagamento dispara onConfirm", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <PaymentDialog
        open
        onOpenChange={() => {}}
        totalCents={2443}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText(/24,43/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dinheiro" }));
    expect(onConfirm).toHaveBeenCalledWith("dinheiro", undefined);
  });
});
