import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PriceSuggestionDto } from "@/types/product";

import { PriceSuggestionDialog } from "./PriceSuggestionDialog";

const suggestion: PriceSuggestionDto = {
  currentSalePriceCents: 1500,
  suggestedSalePriceCents: 2600,
  newCostCents: 2000,
  markupPercent: 30,
  priceIsManual: true,
  warnManualOverride: true,
};

describe("PriceSuggestionDialog (RF06)", () => {
  it("T14 — exibe aviso de override manual + confirmar/cancelar e dispara onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <PriceSuggestionDialog
        open
        onOpenChange={() => {}}
        suggestion={suggestion}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByTestId("manual-warning")).toBeInTheDocument();

    const apply = screen.getByRole("button", { name: /aplicar novo preço/i });
    const keep = screen.getByRole("button", { name: /manter preço atual/i });
    expect(apply).toBeInTheDocument();
    expect(keep).toBeInTheDocument();

    await user.click(apply);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
