import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/app/(app)/products/actions", () => ({
  removeProductImageAction: vi.fn(),
}));

import { ProductImageUpload } from "./ProductImageUpload";

const fetchMock = vi.fn();
const createObjectURLMock = vi.fn(() => "blob:preview-123");
const revokeObjectURLMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  // jsdom does not implement these — stub them.
  global.URL.createObjectURL =
    createObjectURLMock as unknown as typeof URL.createObjectURL;
  global.URL.revokeObjectURL =
    revokeObjectURLMock as unknown as typeof URL.revokeObjectURL;
});

function pickFile() {
  return new File(["x"], "foto.png", { type: "image/png" });
}

describe("ProductImageUpload (RF03)", () => {
  it("T03 — modo create stage a foto sem fazer upload", async () => {
    const onStagedChange = vi.fn();
    const user = userEvent.setup();
    // Sem productId => modo create.
    render(<ProductImageUpload onStagedChange={onStagedChange} />);

    const input = screen.getByLabelText("Foto do produto", {
      selector: "input",
    });
    await user.upload(input, pickFile());

    // Preview blob exibido.
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const img = screen.getByRole("img", {
      name: /pré-visualização da foto/i,
    }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("blob:preview-123");
    // Botão de remover presente.
    expect(
      screen.getByRole("button", { name: /remover foto/i }),
    ).toBeInTheDocument();
    // Apenas staged — sem POST.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onStagedChange).toHaveBeenCalledWith(expect.any(File));
  });

  it("T04 — remover limpa o preview staged e revoga o blob", async () => {
    const onStagedChange = vi.fn();
    const user = userEvent.setup();
    render(<ProductImageUpload onStagedChange={onStagedChange} />);

    const input = screen.getByLabelText("Foto do produto", {
      selector: "input",
    });
    await user.upload(input, pickFile());
    expect(screen.getByRole("img")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remover foto/i }));

    // Preview removido (volta ao fallback emoji/ícone, sem <img>).
    expect(screen.queryByRole("img")).toBeNull();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:preview-123");
    expect(onStagedChange).toHaveBeenLastCalledWith(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
