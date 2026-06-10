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
  createProductAction: vi.fn(),
}));

import { createProductAction } from "@/app/(app)/products/actions";

import { NewProductForm } from "./NewProductForm";

const mockedCreate = vi.mocked(createProductAction);

describe("NewProductForm", () => {
  it("cria o produto e redireciona para /products no sucesso", async () => {
    mockedCreate.mockResolvedValue({ ok: true, data: { id: "p1" } as ProductDto });
    const user = userEvent.setup();
    render(<NewProductForm defaultMarkupPercent={30} />);

    await user.type(screen.getByLabelText("Nome"), "Pão");
    await user.type(screen.getByLabelText("Custo"), "5,00");
    await user.click(screen.getByRole("button", { name: /salvar produto/i }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(pushMock).toHaveBeenCalledWith("/products");
  });
});
