import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/services/errors";
import type { ProductDto } from "@/types/product";

import { ProductForm } from "./ProductForm";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

function okSubmit() {
  return vi
    .fn<(input: unknown) => Promise<ActionResult<ProductDto>>>()
    .mockResolvedValue({ ok: true, data: {} as ProductDto });
}

describe("ProductForm", () => {
  it("T08 — pré-preenche a margem padrão da loja no modo create (RF05)", () => {
    render(
      <ProductForm mode="create" defaultMarkupPercent={30} onSubmit={okSubmit()} />,
    );
    const markup = screen.getByLabelText("Margem %") as HTMLInputElement;
    expect(markup.value).toContain("30");
  });

  it("T06 — editar o preço diretamente marca priceIsManual (RF03)", async () => {
    const user = userEvent.setup();
    render(
      <ProductForm mode="create" defaultMarkupPercent={30} onSubmit={okSubmit()} />,
    );
    expect(screen.queryByTestId("price-manual")).toBeNull();
    await user.type(screen.getByTestId("sale-price-input"), "20,00");
    expect(screen.getByTestId("price-manual")).toBeInTheDocument();
  });

  it("submete create válido chamando onSubmit com os dados parseados", async () => {
    const user = userEvent.setup();
    const submit = okSubmit();
    render(
      <ProductForm mode="create" defaultMarkupPercent={30} onSubmit={submit} />,
    );
    await user.type(screen.getByLabelText("Nome"), "Água 500ml");
    await user.type(screen.getByLabelText("Custo"), "10,00");
    await user.click(screen.getByRole("button", { name: /salvar produto/i }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const input = submit.mock.calls[0][0] as Record<string, unknown>;
    expect(input.name).toBe("Água 500ml");
    expect(input.costCents).toBe(1000);
    expect(input.markupPercent).toBe(30);
    expect(input.salePriceCents).toBeUndefined(); // não manual -> backend calcula
  });

  it("não submete e mostra erro quando inválido", async () => {
    const user = userEvent.setup();
    const submit = okSubmit();
    render(
      <ProductForm mode="create" defaultMarkupPercent={30} onSubmit={submit} />,
    );
    await user.click(screen.getByRole("button", { name: /salvar produto/i }));
    await waitFor(() =>
      expect(screen.getByText(/nome do produto/i)).toBeInTheDocument(),
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("× volta o preço ao calculado (reset manual)", async () => {
    const user = userEvent.setup();
    render(
      <ProductForm mode="create" defaultMarkupPercent={30} onSubmit={okSubmit()} />,
    );
    await user.type(screen.getByTestId("sale-price-input"), "20,00");
    expect(screen.getByTestId("price-manual")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /voltar ao preço calculado/i }),
    );
    expect(screen.queryByTestId("price-manual")).toBeNull();
  });
});
