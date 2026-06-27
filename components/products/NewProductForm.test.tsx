import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/app/(app)/products/actions", () => ({
  createProductAction: vi.fn(),
}));

import { toast } from "sonner";

import { createProductAction } from "@/app/(app)/products/actions";

import { NewProductForm } from "./NewProductForm";

const mockedCreate = vi.mocked(createProductAction);
const fetchMock = vi.fn();
const createObjectURLMock = vi.fn(() => "blob:preview-1");
const revokeObjectURLMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  global.URL.createObjectURL =
    createObjectURLMock as unknown as typeof URL.createObjectURL;
  global.URL.revokeObjectURL =
    revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
});

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

  it("T10 — foto staged com upload !ok mostra aviso e ainda redireciona (RF08)", async () => {
    mockedCreate.mockResolvedValue({ ok: true, data: { id: "p1" } as ProductDto });
    // Upload da foto falha (R2 indisponível).
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    const user = userEvent.setup();
    render(<NewProductForm defaultMarkupPercent={30} />);

    await user.type(screen.getByLabelText("Nome"), "Pão");
    await user.type(screen.getByLabelText("Custo"), "5,00");

    // Stage uma foto (modo create — sem upload imediato).
    const fileInput = screen.getByLabelText("Foto do produto", {
      selector: "input",
    });
    await user.upload(fileInput, new File(["x"], "f.png", { type: "image/png" }));

    await user.click(screen.getByRole("button", { name: /salvar produto/i }));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    // Upload tentado contra o id retornado.
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/products/p1/upload",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    // Aviso exibido E redirect ainda acontece (RF08).
    expect(toast.warning).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/products");
  });
});
