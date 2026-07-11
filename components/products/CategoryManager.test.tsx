import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CATEGORY_PALETTE } from "@/lib/validation/product";
import type { ProductCategoryDto } from "@/types/product";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/(app)/products/categories/actions", () => ({
  countProductsInCategoryAction: vi.fn(),
  createProductCategoryAction: vi.fn(),
  deleteProductCategoryAction: vi.fn(),
  reorderProductCategoriesAction: vi.fn(),
  updateProductCategoryAction: vi.fn(),
}));

import {
  countProductsInCategoryAction,
  deleteProductCategoryAction,
  reorderProductCategoriesAction,
  updateProductCategoryAction,
} from "@/app/(app)/products/categories/actions";

import { CategoryManager } from "./CategoryManager";

const mockedCount = vi.mocked(countProductsInCategoryAction);
const mockedDelete = vi.mocked(deleteProductCategoryAction);
const mockedReorder = vi.mocked(reorderProductCategoriesAction);
const mockedUpdate = vi.mocked(updateProductCategoryAction);

const ID_BEBIDAS = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ID_LANCHES = "9b2b1e6e-6f5a-4c2f-8f3a-2b7c9d4e5f6a";

function makeCategory(
  overrides: Partial<ProductCategoryDto> &
    Pick<ProductCategoryDto, "id" | "name" | "position">,
): ProductCategoryDto {
  return {
    color: "azul",
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

const CATEGORIES: ProductCategoryDto[] = [
  makeCategory({ id: ID_BEBIDAS, name: "Bebidas", position: 0, color: "azul" }),
  makeCategory({
    id: ID_LANCHES,
    name: "Lanches",
    position: 1,
    color: "laranja",
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CategoryManager", () => {
  it("T06 — lista com chip colorido da paleta e controles por item (RF05/RF06)", () => {
    render(<CategoryManager categories={CATEGORIES} />);

    // Chip com a cor da paleta (slug -> hex resolvido no client).
    const chip = screen.getByText("Bebidas");
    expect(chip).toHaveStyle({
      backgroundColor: CATEGORY_PALETTE.azul.bg,
      color: CATEGORY_PALETTE.azul.fg,
    });
    expect(screen.getByText("Lanches")).toHaveStyle({
      backgroundColor: CATEGORY_PALETTE.laranja.bg,
    });

    // Controles por item: reordenar ▲▼, editar (renomear/recolorir) e excluir.
    for (const name of ["Bebidas", "Lanches"]) {
      expect(
        screen.getByRole("button", { name: `Mover ${name} para cima` }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: `Mover ${name} para baixo` }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: `Editar ${name}` }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: `Excluir ${name}` }),
      ).toBeInTheDocument();
    }

    // Extremos: primeira não sobe, última não desce.
    expect(
      screen.getByRole("button", { name: "Mover Bebidas para cima" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Mover Lanches para baixo" }),
    ).toBeDisabled();
  });

  it("T04 — excluir categoria em uso mostra a contagem e só chama a action após confirmar (RF03)", async () => {
    mockedCount.mockResolvedValue({ ok: true, data: { count: 2 } });
    mockedDelete.mockResolvedValue({
      ok: true,
      data: { id: ID_BEBIDAS, movedCount: 2 },
    });
    const user = userEvent.setup();
    render(<CategoryManager categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: "Excluir Bebidas" }));

    // AlertDialog com o aviso de contagem (RF03).
    const warning = await screen.findByText(
      /2 produtos serão movidos para Sem categoria/,
    );
    expect(warning).toBeInTheDocument();
    expect(mockedCount).toHaveBeenCalledWith({ id: ID_BEBIDAS });
    // A exclusão NÃO acontece antes da confirmação.
    expect(mockedDelete).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Excluir categoria" }),
    );
    expect(mockedDelete).toHaveBeenCalledWith({ id: ID_BEBIDAS });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("cancelar o aviso de exclusão não chama a action (RF03)", async () => {
    mockedCount.mockResolvedValue({ ok: true, data: { count: 2 } });
    const user = userEvent.setup();
    render(<CategoryManager categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: "Excluir Bebidas" }));
    await screen.findByText(/2 produtos serão movidos para Sem categoria/);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it("reorder ▲▼ faz swap otimista e envia a lista COMPLETA de ids (RF06)", async () => {
    mockedReorder.mockResolvedValue({ ok: true, data: [] });
    const user = userEvent.setup();
    render(<CategoryManager categories={CATEGORIES} />);

    await user.click(
      screen.getByRole("button", { name: "Mover Lanches para cima" }),
    );

    expect(mockedReorder).toHaveBeenCalledWith({
      orderedIds: [ID_LANCHES, ID_BEBIDAS],
    });
    // Swap otimista refletido na ordem da lista.
    const chips = screen
      .getAllByRole("listitem")
      .map((li) => within(li).getByText(/Bebidas|Lanches/).textContent);
    expect(chips).toEqual(["Lanches", "Bebidas"]);
    expect(refreshMock).toHaveBeenCalled();
  });

  it("reorder com falha reverte a ordem otimista (RF06)", async () => {
    mockedReorder.mockResolvedValue({
      ok: false,
      error: "Lista de categorias inválida",
    });
    const user = userEvent.setup();
    render(<CategoryManager categories={CATEGORIES} />);

    await user.click(
      screen.getByRole("button", { name: "Mover Lanches para cima" }),
    );

    const chips = screen
      .getAllByRole("listitem")
      .map((li) => within(li).getByText(/Bebidas|Lanches/).textContent);
    expect(chips).toEqual(["Bebidas", "Lanches"]);
  });

  it("editar abre o CategoryFormDialog preenchido e chama update com o id (RF02)", async () => {
    mockedUpdate.mockResolvedValue({
      ok: true,
      data: makeCategory({ id: ID_BEBIDAS, name: "Cervejas", position: 0 }),
    });
    const user = userEvent.setup();
    render(<CategoryManager categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: "Editar Bebidas" }));
    const nameInput = (await screen.findByLabelText(
      "Nome",
    )) as HTMLInputElement;
    expect(nameInput.value).toBe("Bebidas");

    await user.clear(nameInput);
    await user.type(nameInput, "Cervejas");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(mockedUpdate).toHaveBeenCalledWith({
      id: ID_BEBIDAS,
      name: "Cervejas",
      color: "azul",
    });
    expect(refreshMock).toHaveBeenCalled();
  });
});
