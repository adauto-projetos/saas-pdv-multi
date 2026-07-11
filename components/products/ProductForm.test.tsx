import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ActionResult } from "@/lib/services/errors";
import type { ProductCategoryDto, ProductDto } from "@/types/product";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
// O CategorySelect (embutido no form, 0025F) importa a action de criação inline.
vi.mock("@/app/(app)/products/categories/actions", () => ({
  createProductCategoryAction: vi.fn(),
}));

import { ProductForm } from "./ProductForm";

function okSubmit() {
  return vi
    .fn<(input: unknown) => Promise<ActionResult<ProductDto>>>()
    .mockResolvedValue({ ok: true, data: {} as ProductDto });
}

const ID_BEBIDAS = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ID_SALGADOS = "9b2b1e6e-6f5a-4c2f-8f3a-2b7c9d4e5f6a";

// Categorias do TENANT (0025F/RF07) — nada de lista fixa hardcoded.
const CATEGORIES: ProductCategoryDto[] = [
  {
    id: ID_BEBIDAS,
    name: "Bebidas Geladas",
    color: "azul",
    position: 0,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  },
  {
    id: ID_SALGADOS,
    name: "Salgados",
    color: "laranja",
    position: 1,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  },
];

describe("ProductForm", () => {
  it("T08 — pré-preenche a margem padrão da loja no modo create (RF05)", () => {
    render(
      <ProductForm
        mode="create"
        defaultMarkupPercent={30}
        categories={CATEGORIES}
        onSubmit={okSubmit()}
      />,
    );
    const markup = screen.getByLabelText("Margem %") as HTMLInputElement;
    expect(markup.value).toContain("30");
  });

  it("T06 — editar o preço diretamente marca priceIsManual (RF03)", async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        mode="create"
        defaultMarkupPercent={30}
        categories={CATEGORIES}
        onSubmit={okSubmit()}
      />,
    );
    expect(screen.queryByTestId("price-manual")).toBeNull();
    await user.type(screen.getByTestId("sale-price-input"), "20,00");
    expect(screen.getByTestId("price-manual")).toBeInTheDocument();
  });

  it("submete create válido chamando onSubmit com os dados parseados", async () => {
    const user = userEvent.setup();
    const submit = okSubmit();
    render(
      <ProductForm
        mode="create"
        defaultMarkupPercent={30}
        categories={CATEGORIES}
        onSubmit={submit}
      />,
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
      <ProductForm
        mode="create"
        defaultMarkupPercent={30}
        categories={CATEGORIES}
        onSubmit={submit}
      />,
    );
    await user.click(screen.getByRole("button", { name: /salvar produto/i }));
    await waitFor(() =>
      expect(screen.getByText(/nome do produto/i)).toBeInTheDocument(),
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("T19 — campo de estoque mínimo é enviado (RF06)", async () => {
    const user = userEvent.setup();
    const submit = okSubmit();
    render(
      <ProductForm
        mode="create"
        defaultMarkupPercent={30}
        categories={CATEGORIES}
        onSubmit={submit}
      />,
    );
    await user.type(screen.getByLabelText("Nome"), "Item");
    await user.type(screen.getByLabelText("Custo"), "10,00");
    await user.type(screen.getByLabelText("Estoque mínimo (alerta)"), "5");
    await user.click(screen.getByRole("button", { name: /salvar produto/i }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    const input = submit.mock.calls[0][0] as Record<string, unknown>;
    expect(input.minStock).toBe(5);
  });

  it("T09 — select de categoria lista as categorias do tenant, sem lista fixa (RF07)", () => {
    render(
      <ProductForm
        mode="create"
        defaultMarkupPercent={30}
        categories={CATEGORIES}
        onSubmit={okSubmit()}
      />,
    );
    const select = screen.getByLabelText("Categoria") as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual([
      "Sem categoria",
      "Bebidas Geladas",
      "Salgados",
      "+ Nova categoria",
    ]);
    // Lista fixa PRODUCT_CATEGORIES extinta do form.
    expect(labels).not.toContain("Hortifruti");
    expect(labels).not.toContain("Mercearia");
  });

  it("T09 — select preserva o contrato visual 0023H (bg-background, h-9, focus ring)", () => {
    render(
      <ProductForm
        mode="create"
        defaultMarkupPercent={30}
        categories={CATEGORIES}
        onSubmit={okSubmit()}
      />,
    );
    const select = screen.getByLabelText("Categoria") as HTMLSelectElement;
    expect(select.className).toContain("bg-background");
    expect(select.className).toContain("h-9");
    expect(select.className).toContain("focus-visible:ring-3");
    expect(select.className).toContain("focus-visible:border-ring");
  });

  it("T09 — categoria selecionada vai no submit como categoryId; sem seleção envia null (RN04)", async () => {
    const user = userEvent.setup();
    const submit = okSubmit();
    render(
      <ProductForm
        mode="create"
        defaultMarkupPercent={30}
        categories={CATEGORIES}
        onSubmit={submit}
      />,
    );
    await user.type(screen.getByLabelText("Nome"), "Coxinha");
    await user.type(screen.getByLabelText("Custo"), "5,00");
    await user.selectOptions(screen.getByLabelText("Categoria"), ID_SALGADOS);
    await user.click(screen.getByRole("button", { name: /salvar produto/i }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    const input = submit.mock.calls[0][0] as Record<string, unknown>;
    expect(input.categoryId).toBe(ID_SALGADOS);

    // "Sem categoria" volta a null explícito (limpa no update, RN04).
    await user.selectOptions(screen.getByLabelText("Categoria"), "");
    await user.click(screen.getByRole("button", { name: /salvar produto/i }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    const second = submit.mock.calls[1][0] as Record<string, unknown>;
    expect(second.categoryId).toBeNull();
  });

  it("T09 — modo edit inicializa o select a partir de product.category.id", () => {
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
      category: { id: ID_BEBIDAS, name: "Bebidas Geladas", color: "azul" },
      imageKey: null,
      imageUrl: null,
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z",
    };
    render(
      <ProductForm
        mode="edit"
        defaultMarkupPercent={30}
        categories={CATEGORIES}
        defaultValues={product}
        onSubmit={okSubmit()}
      />,
    );
    const select = screen.getByLabelText("Categoria") as HTMLSelectElement;
    expect(select.value).toBe(ID_BEBIDAS);
  });

  it("× volta o preço ao calculado (reset manual)", async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        mode="create"
        defaultMarkupPercent={30}
        categories={CATEGORIES}
        onSubmit={okSubmit()}
      />,
    );
    await user.type(screen.getByTestId("sale-price-input"), "20,00");
    expect(screen.getByTestId("price-manual")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /voltar ao preço calculado/i }),
    );
    expect(screen.queryByTestId("price-manual")).toBeNull();
  });
});
