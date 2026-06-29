import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { addCalendarMonths } from "@/lib/format/calendar-month";
import { ReleaseDialog } from "./ReleaseDialog";

const TENANT = {
  id: "t1",
  name: "Loja Teste",
  // validade futura para a base do preview ser determinística
  validUntil: new Date(2026, 6, 1), // 2026-07-01 local
};

function renderDialog(onConfirm = vi.fn()) {
  render(
    <ReleaseDialog
      tenant={TENANT}
      open={true}
      onOpenChange={vi.fn()}
      onConfirm={onConfirm}
    />,
  );
  return onConfirm;
}

describe("ReleaseDialog (0013F, RF01/RF02/RN01)", () => {
  it("T66 — input de meses renderiza pré-preenchido com 1", () => {
    renderDialog();
    const input = screen.getByLabelText(/quantidade de meses/i) as HTMLInputElement;
    expect(input.value).toBe("1");
  });

  it("T67 — preview recalcula ao vivo via addCalendarMonths ao digitar", async () => {
    renderDialog();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/quantidade de meses/i);
    await user.clear(input);
    await user.type(input, "6");

    const expected = addCalendarMonths(TENANT.validUntil, 6).toLocaleDateString("pt-BR");
    expect(screen.getByText(/novo vencimento/i)).toHaveTextContent(expected);
  });

  it("T68 — valor fora do range desabilita Confirmar e mostra msg pt-BR", async () => {
    const onConfirm = renderDialog();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/quantidade de meses/i);
    await user.clear(input);
    await user.type(input, "25");

    const confirm = screen.getByRole("button", { name: /confirmar/i });
    expect(confirm).toBeDisabled();
    expect(screen.getByText(/entre 1 e 24 meses/i)).toBeInTheDocument();

    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
