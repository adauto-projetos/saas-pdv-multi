import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/caixa/actions", () => ({
  finalizeSaleAction: vi.fn(),
  lookupProductByBarcodeAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ usePathname: () => "/caixa" }));

import { CashierScreen } from "./CashierScreen";
import { CATEGORY_PALETTE } from "@/lib/validation/product";
import type { ProductCategoryDto, ProductDto } from "@/types/product";

function product(overrides: Partial<ProductDto>): ProductDto {
  return {
    id: "p1",
    name: "Refri Lata",
    salePriceCents: 500,
    costCents: 300,
    markupPercent: 67,
    priceIsManual: false,
    unit: "un",
    barcode: null,
    emoji: null,
    category: { id: "c1", name: "Bebidas", color: "azul" },
    imageKey: null,
    imageUrl: null,
    stockQuantity: 10,
    minStock: 2,
    tenantId: "t1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function category(overrides: Partial<ProductCategoryDto>): ProductCategoryDto {
  return {
    id: "c1",
    name: "Bebidas",
    color: "azul",
    position: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("CashierScreen foto (RF04/RF05/RNF03)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("T05 — produto com imageUrl renderiza <img>, não emoji", () => {
    const { container } = render(
      <CashierScreen
        products={[product({ imageUrl: "https://r2/foto.webp", emoji: "🥤" })]}
        categories={[]}
      />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("https://r2/foto.webp");
    // Emoji não aparece como texto quando há foto.
    expect(screen.queryByText("🥤")).toBeNull();
  });

  it("T06 — fallback foto → emoji → 📦", () => {
    const { rerender } = render(
      <CashierScreen
        products={[product({ imageUrl: null, emoji: "🍺" })]}
        categories={[]}
      />,
    );
    // Sem foto, com emoji => emoji.
    expect(screen.getByText("🍺")).toBeInTheDocument();

    // Sem foto e sem emoji => ícone genérico 📦.
    rerender(
      <CashierScreen
        products={[product({ imageUrl: null, emoji: null })]}
        categories={[]}
      />,
    );
    expect(screen.getByText("📦")).toBeInTheDocument();
  });

  it("T24 — foto usa lazy-loading", () => {
    const { container } = render(
      <CashierScreen
        products={[product({ imageUrl: "https://r2/foto.webp" })]}
        categories={[]}
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("loading", "lazy");
  });
});

/** Expande a fileira de chips (recolhida por padrão desde o toggle 0025F). */
async function expandChips(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: "Mostrar categorias" }),
  );
}

describe("CashierScreen chips dinâmicos (RF07/RF08 — spec T08/T10)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("T08 — chips = Todos + categorias do tenant por position, sem lista fixa", async () => {
    const user = userEvent.setup();
    // Props fora de ordem de propósito: o componente ordena por `position`.
    const categories = [
      category({ id: "c2", name: "Padaria", color: "roxo", position: 1 }),
      category({ id: "c1", name: "Bebidas", color: "azul", position: 0 }),
      category({ id: "c3", name: "Vinhos", color: "lima", position: 2 }),
    ];
    render(
      <CashierScreen products={[product({})]} categories={categories} />,
    );
    await expandChips(user);

    const chips = within(screen.getByTestId("category-chips")).getAllByRole(
      "button",
    );
    // "Categorias" é o toggle (posição fixa após "Todos"), não um filtro.
    expect(chips.map((c) => c.textContent)).toEqual([
      "Todos",
      "Categorias",
      "Bebidas",
      "Padaria",
      "Vinhos",
    ]);
    // Nada da antiga PRODUCT_CATEGORIES hardcoded vaza para os chips.
    expect(screen.queryByText("Mercearia")).toBeNull();
    expect(screen.queryByText("Hortifruti")).toBeNull();
    expect(screen.queryByText("Outros")).toBeNull();
  });

  it("T08 — chip ativo usa a cor da CATEGORY_PALETTE do slug da categoria", async () => {
    const user = userEvent.setup();
    render(
      <CashierScreen
        products={[product({})]}
        categories={[
          category({ id: "c1", name: "Bebidas", color: "azul", position: 0 }),
        ]}
      />,
    );
    await expandChips(user);

    const chip = within(screen.getByTestId("category-chips")).getByRole(
      "button",
      { name: "Bebidas" },
    );
    await user.click(chip);
    expect(chip).toHaveStyle({
      background: CATEGORY_PALETTE.azul.bg,
      color: CATEGORY_PALETTE.azul.fg,
    });
  });

  it("T08 — filtro ativo é por category.id (null nunca vira 'Outros' — RN04)", async () => {
    const user = userEvent.setup();
    render(
      <CashierScreen
        products={[
          product({
            id: "p1",
            name: "Refri Lata",
            category: { id: "c1", name: "Bebidas", color: "azul" },
          }),
          product({
            id: "p2",
            name: "Pão Francês",
            category: { id: "c2", name: "Padaria", color: "roxo" },
          }),
        ]}
        categories={[
          category({ id: "c1", name: "Bebidas", color: "azul", position: 0 }),
          category({ id: "c2", name: "Padaria", color: "roxo", position: 1 }),
        ]}
      />,
    );
    await expandChips(user);

    await user.click(
      within(screen.getByTestId("category-chips")).getByRole("button", {
        name: "Bebidas",
      }),
    );
    expect(screen.getByText("Refri Lata")).toBeInTheDocument();
    expect(screen.queryByText("Pão Francês")).toBeNull();
  });

  it("T10 — chip 'Sem categoria' no FIM filtra exatamente os produtos com category null", async () => {
    const user = userEvent.setup();
    render(
      <CashierScreen
        products={[
          product({
            id: "p1",
            name: "Refri Lata",
            category: { id: "c1", name: "Bebidas", color: "azul" },
          }),
          product({ id: "p2", name: "Produto Avulso", category: null }),
        ]}
        categories={[
          category({ id: "c1", name: "Bebidas", color: "azul", position: 0 }),
        ]}
      />,
    );
    await expandChips(user);

    const chips = within(screen.getByTestId("category-chips")).getAllByRole(
      "button",
    );
    // Chip presente e no FIM da fileira (RF08).
    expect(chips[chips.length - 1]).toHaveTextContent("Sem categoria");

    await user.click(chips[chips.length - 1]);
    expect(screen.getByText("Produto Avulso")).toBeInTheDocument();
    expect(screen.queryByText("Refri Lata")).toBeNull();
  });

  it("T10 — sem produto de category null, chip 'Sem categoria' ausente", async () => {
    const user = userEvent.setup();
    render(
      <CashierScreen
        products={[
          product({
            category: { id: "c1", name: "Bebidas", color: "azul" },
          }),
        ]}
        categories={[
          category({ id: "c1", name: "Bebidas", color: "azul", position: 0 }),
        ]}
      />,
    );
    await expandChips(user);
    expect(screen.queryByText("Sem categoria")).toBeNull();
  });
});

describe("CashierScreen toggle expandir/ocultar categorias (0025F)", () => {
  beforeEach(() => vi.clearAllMocks());

  const twoCategories = [
    category({ id: "c1", name: "Bebidas", color: "azul", position: 0 }),
    category({ id: "c2", name: "Padaria", color: "roxo", position: 1 }),
  ];

  it("recolhido por padrão: só 'Todos' + botão 'Categorias' visíveis", () => {
    render(
      <CashierScreen products={[product({})]} categories={twoCategories} />,
    );

    const chips = within(screen.getByTestId("category-chips")).getAllByRole(
      "button",
    );
    expect(chips.map((c) => c.textContent)).toEqual(["Todos", "Categorias"]);
    expect(
      screen.getByRole("button", { name: "Mostrar categorias" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("toggle expande e recolhe os chips de categoria", async () => {
    const user = userEvent.setup();
    render(
      <CashierScreen products={[product({})]} categories={twoCategories} />,
    );

    await expandChips(user);
    expect(screen.getByText("Bebidas")).toBeInTheDocument();
    expect(screen.getByText("Padaria")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Ocultar categorias" }),
    );
    expect(screen.queryByText("Bebidas")).toBeNull();
    expect(screen.queryByText("Padaria")).toBeNull();
  });

  it("recolhido com filtro ativo mantém o chip da categoria ativa visível", async () => {
    const user = userEvent.setup();
    render(
      <CashierScreen products={[product({})]} categories={twoCategories} />,
    );

    await expandChips(user);
    await user.click(
      within(screen.getByTestId("category-chips")).getByRole("button", {
        name: "Bebidas",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Ocultar categorias" }),
    );

    // Operador continua vendo (e podendo limpar) o filtro aplicado.
    expect(screen.getByText("Bebidas")).toBeInTheDocument();
    expect(screen.queryByText("Padaria")).toBeNull();
  });
});
