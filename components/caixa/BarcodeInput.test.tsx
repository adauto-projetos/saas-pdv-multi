import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BarcodeInput } from "./BarcodeInput";

describe("BarcodeInput (RF10)", () => {
  it("T18 — Enter adiciona o código, limpa e mantém o foco", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<BarcodeInput onSubmit={onSubmit} />);

    const input = screen.getByTestId("barcode-input") as HTMLInputElement;
    await user.type(input, "ABC123{Enter}");

    expect(onSubmit).toHaveBeenCalledWith("ABC123");
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
  });
});
