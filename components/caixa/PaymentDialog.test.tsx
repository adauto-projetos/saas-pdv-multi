import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PaymentDialog } from "./PaymentDialog";

describe("PaymentDialog (checkout — RF07)", () => {
  it("T19 — dinheiro: preencher valor e confirmar dispara onConfirm", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValue({ ok: true, saleId: "sale-id-1" });
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
    // Dinheiro now opens the cash step (valor recebido + troco)
    await user.click(screen.getByRole("button", { name: "Dinheiro" }));
    const input = screen.getByLabelText("Valor recebido");
    await user.clear(input);
    await user.type(input, "30");
    await user.click(screen.getByRole("button", { name: "Confirmar venda" }));
    expect(onConfirm).toHaveBeenCalledWith("dinheiro", undefined);
  });
});
