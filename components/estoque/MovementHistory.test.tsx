import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StockMovementDto } from "@/types/stock";

vi.mock("@/app/(app)/estoque/actions", () => ({
  listMovementsAction: vi.fn(),
}));

import { listMovementsAction } from "@/app/(app)/estoque/actions";

import { MovementHistory } from "./MovementHistory";

const movement: StockMovementDto = {
  id: "m1",
  productId: "p1",
  type: "entrada",
  quantity: 10,
  reason: "compra",
  saleId: null,
  userId: "u1",
  createdAt: "2026-06-10T10:00:00.000Z",
};

const mocked = vi.mocked(listMovementsAction);

describe("MovementHistory (RF05)", () => {
  it("renderiza as movimentações e filtra por tipo", async () => {
    mocked.mockResolvedValue({ ok: true, data: [movement] });
    const user = userEvent.setup();
    render(<MovementHistory productId="p1" />);

    await waitFor(() =>
      expect(screen.getByText("compra")).toBeInTheDocument(),
    );
    expect(mocked).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "p1" }),
    );

    mocked.mockClear();
    mocked.mockResolvedValue({ ok: true, data: [] });
    await user.selectOptions(screen.getByLabelText("Tipo"), "saida");

    await waitFor(() =>
      expect(mocked).toHaveBeenCalledWith(
        expect.objectContaining({ type: "saida" }),
      ),
    );
  });
});
