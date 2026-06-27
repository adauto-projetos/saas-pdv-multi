import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProductDto } from "@/types/product";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/(app)/estoque/actions", () => ({
  recordEntryAction: vi.fn(),
  recordAdjustmentAction: vi.fn(),
}));
vi.mock("@/app/(app)/caixa/actions", () => ({ searchProductsAction: vi.fn() }));

import {
  recordAdjustmentAction,
  recordEntryAction,
} from "@/app/(app)/estoque/actions";

import { StockMovementDialog } from "./StockMovementDialog";

const mockedEntry = vi.mocked(recordEntryAction);
const mockedAdjust = vi.mocked(recordAdjustmentAction);

const product: ProductDto = {
  id: "p1",
  tenantId: "t1",
  name: "Refri Lata",
  barcode: null,
  unit: "un",
  costCents: 1000,
  markupPercent: 30,
  salePriceCents: 1300,
  priceIsManual: false,
  stockQuantity: 5,
  minStock: null,
  emoji: null,
  category: null,
  imageKey: null,
  imageUrl: null,
  createdAt: "",
  updatedAt: "",
};

describe("StockMovementDialog (RF01/RF02)", () => {
  it("T17 — registra entrada chamando a action", async () => {
    mockedEntry.mockResolvedValue({ ok: true, data: {} as never });
    const user = userEvent.setup();
    render(<StockMovementDialog defaultProduct={product} />);

    await user.type(screen.getByLabelText("Quantidade a adicionar"), "10");
    await user.click(
      screen.getByRole("button", { name: /registrar movimentação/i }),
    );

    await waitFor(() =>
      expect(mockedEntry).toHaveBeenCalledWith({
        productId: "p1",
        quantity: 10,
        reason: undefined,
      }),
    );
  });

  it("ajuste envia countedQuantity (RF02)", async () => {
    mockedAdjust.mockResolvedValue({ ok: true, data: {} as never });
    const user = userEvent.setup();
    render(<StockMovementDialog defaultProduct={product} />);

    await user.click(screen.getByRole("button", { name: /ajuste/i }));
    await user.type(screen.getByLabelText("Contagem real"), "7");
    await user.click(
      screen.getByRole("button", { name: /registrar movimentação/i }),
    );

    await waitFor(() =>
      expect(mockedAdjust).toHaveBeenCalledWith({
        productId: "p1",
        countedQuantity: 7,
        reason: undefined,
      }),
    );
  });
});
