import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProductDto } from "@/types/product";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/(app)/products/actions", () => ({
  updateProductAction: vi.fn(),
  previewPriceOnCostChangeAction: vi.fn(),
  applyCostChangeAction: vi.fn(),
}));

import {
  applyCostChangeAction,
  previewPriceOnCostChangeAction,
  updateProductAction,
} from "@/app/(app)/products/actions";

import { EditProductForm } from "./EditProductForm";

const product: ProductDto = {
  id: "p1",
  tenantId: "t1",
  name: "Produto X",
  barcode: null,
  unit: "un",
  costCents: 1000,
  markupPercent: 30,
  salePriceCents: 1300,
  priceIsManual: false,
  stockQuantity: 0,
  createdAt: "2026-06-09T00:00:00.000Z",
  updatedAt: "2026-06-09T00:00:00.000Z",
};

const mockedUpdate = vi.mocked(updateProductAction);
const mockedPreview = vi.mocked(previewPriceOnCostChangeAction);
const mockedApply = vi.mocked(applyCostChangeAction);

describe("EditProductForm (RF07/RF06)", () => {
  it("edição sem mudar custo chama updateProduct e redireciona", async () => {
    mockedUpdate.mockResolvedValue({ ok: true, data: product });
    const user = userEvent.setup();
    render(<EditProductForm product={product} />);

    const nome = screen.getByLabelText("Nome");
    await user.clear(nome);
    await user.type(nome, "Produto Novo");
    await user.click(screen.getByRole("button", { name: /salvar alterações/i }));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    const arg = mockedUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.id).toBe("p1");
    expect(arg.name).toBe("Produto Novo");
    expect(pushMock).toHaveBeenCalledWith("/products");
  });

  it("mudar o custo abre o diálogo RF06 e aplica o novo preço", async () => {
    mockedPreview.mockResolvedValue({
      ok: true,
      data: {
        currentSalePriceCents: 1300,
        suggestedSalePriceCents: 2600,
        newCostCents: 2000,
        markupPercent: 30,
        priceIsManual: false,
        warnManualOverride: false,
      },
    });
    mockedApply.mockResolvedValue({ ok: true, data: product });
    const user = userEvent.setup();
    render(<EditProductForm product={product} />);

    const custo = screen.getByLabelText("Custo");
    await user.clear(custo);
    await user.type(custo, "20,00");
    await user.click(screen.getByRole("button", { name: /salvar alterações/i }));

    await waitFor(() =>
      expect(mockedPreview).toHaveBeenCalledWith({
        id: "p1",
        newCostCents: 2000,
      }),
    );

    const apply = await screen.findByRole("button", {
      name: /aplicar novo preço/i,
    });
    await user.click(apply);

    await waitFor(() =>
      expect(mockedApply).toHaveBeenCalledWith({
        id: "p1",
        newCostCents: 2000,
        acceptSuggestion: true,
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/products");
  });
});
