import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ProductCategoryDto } from "@/types/product";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/(app)/products/categories/actions", () => ({
  createProductCategoryAction: vi.fn(),
}));

import { createProductCategoryAction } from "@/app/(app)/products/categories/actions";

import { CategorySelect } from "./CategorySelect";

const mockedCreate = vi.mocked(createProductCategoryAction);

const ID_BEBIDAS = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ID_LANCHES = "9b2b1e6e-6f5a-4c2f-8f3a-2b7c9d4e5f6a";
const ID_VINHOS = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

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

const changeSpy = vi.fn();

function Harness() {
  const [value, setValue] = React.useState<string | null>(null);
  return (
    <CategorySelect
      id="category"
      categories={CATEGORIES}
      value={value}
      onChange={(v) => {
        changeSpy(v);
        setValue(v);
      }}
    />
  );
}

describe("CategorySelect", () => {
  it("lista as categorias do tenant por position entre 'Sem categoria' e '+ Nova categoria'", () => {
    render(<Harness />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const labels = within(select)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toEqual([
      "Sem categoria",
      "Bebidas",
      "Lanches",
      "+ Nova categoria",
    ]);
  });

  it("seleciona categoria existente pelo id e 'Sem categoria' como null", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;

    await user.selectOptions(select, ID_LANCHES);
    expect(changeSpy).toHaveBeenLastCalledWith(ID_LANCHES);
    expect(select.value).toBe(ID_LANCHES);

    await user.selectOptions(select, "");
    expect(changeSpy).toHaveBeenLastCalledWith(null);
    expect(select.value).toBe("");
  });

  it("T05 — '+ Nova categoria' abre o dialog, cria e seleciona a nova no fim da lista sem sair do fluxo (RF04)", async () => {
    mockedCreate.mockResolvedValue({
      ok: true,
      data: makeCategory({
        id: ID_VINHOS,
        name: "Vinhos",
        position: 2,
        color: "roxo",
      }),
    });
    const user = userEvent.setup();
    render(<Harness />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;

    await user.selectOptions(
      select,
      screen.getByRole("option", { name: "+ Nova categoria" }),
    );

    // Dialog de criação inline abre no mesmo fluxo.
    const nameInput = await screen.findByLabelText("Nome");
    await user.type(nameInput, "Vinhos");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    // Sem cor escolhida, a action recebe só o nome (RN05: cor fica p/ o service).
    await waitFor(() =>
      expect(mockedCreate).toHaveBeenCalledWith({ name: "Vinhos" }),
    );

    // DTO retornado é appendado ao FIM da lista local e sai selecionado.
    await waitFor(() => expect(select.value).toBe(ID_VINHOS));
    expect(changeSpy).toHaveBeenLastCalledWith(ID_VINHOS);
    const labels = within(select)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toEqual([
      "Sem categoria",
      "Bebidas",
      "Lanches",
      "Vinhos",
      "+ Nova categoria",
    ]);

    // Fluxo preservado: dialog fecha e o select continua na tela.
    await waitFor(() =>
      expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument(),
    );
    expect(select).toBeInTheDocument();
  });

  it("erro da action mantém o dialog aberto e não altera a seleção", async () => {
    mockedCreate.mockResolvedValue({
      ok: false,
      error: "Já existe uma categoria com esse nome",
    });
    const user = userEvent.setup();
    render(<Harness />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;

    await user.selectOptions(
      select,
      screen.getByRole("option", { name: "+ Nova categoria" }),
    );
    await user.type(await screen.findByLabelText("Nome"), "Bebidas");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    // Dialog segue aberto para correção; nada selecionado no select.
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(select.value).toBe("");
  });
});
