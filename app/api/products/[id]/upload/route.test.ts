// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/services/errors";
import type { AuthContext } from "@/types/product";

const requireAuthContext = vi.fn(
  async (): Promise<AuthContext> => ({ userId: "u1", tenantId: "t1" }),
);
const requirePermission = vi.fn(async (): Promise<void> => {});
const uploadProductImage = vi.fn(
  async (): Promise<{ imageUrl: string }> => ({ imageUrl: "https://cdn/x.webp" }),
);

vi.mock("@/lib/auth", () => ({
  requireAuthContext: () => requireAuthContext(),
}));
vi.mock("@/lib/auth/permissions", () => ({
  requirePermission: () => requirePermission(),
}));
vi.mock("@/lib/services/products/product-service", () => ({
  uploadProductImage: () => uploadProductImage(),
}));

import { POST } from "./route";

const PRODUCT_ID = "123e4567-e89b-12d3-a456-426614174000";

function makeRequest(file: File | null): Request {
  const form = new FormData();
  if (file) form.set("file", file);
  return new Request("http://localhost/api/products/x/upload", {
    method: "POST",
    body: form,
  });
}

function imageFile(bytes: number, type = "image/jpeg"): File {
  return new File([new Uint8Array(bytes)], "x.jpg", { type });
}

const params = (id = PRODUCT_ID) => Promise.resolve({ id });

beforeEach(() => {
  requireAuthContext.mockResolvedValue({ userId: "u1", tenantId: "t1" });
  requirePermission.mockResolvedValue(undefined);
  uploadProductImage.mockResolvedValue({ imageUrl: "https://cdn/x.webp" });
  vi.clearAllMocks();
});

describe("POST /api/products/[id]/upload", () => {
  it("T01 — sucesso retorna 200 e { imageUrl }", async () => {
    const res = await POST(makeRequest(imageFile(1024)), { params: params() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imageUrl).toBe("https://cdn/x.webp");
  });

  it("T25 — sem sessão retorna 401", async () => {
    requireAuthContext.mockRejectedValueOnce(new UnauthorizedError());
    const res = await POST(makeRequest(imageFile(1024)), { params: params() });
    expect(res.status).toBe(401);
  });

  it("T26 — sem permissão retorna 403", async () => {
    requirePermission.mockRejectedValueOnce(new UnauthorizedError());
    const res = await POST(makeRequest(imageFile(1024)), { params: params() });
    expect(res.status).toBe(403);
  });

  it("T20 — arquivo acima de 5MB retorna 400", async () => {
    const res = await POST(makeRequest(imageFile(5 * 1024 * 1024 + 1)), {
      params: params(),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Máximo 5 MB");
    expect(uploadProductImage).not.toHaveBeenCalled();
  });

  it("T21 — arquivo vazio retorna 400", async () => {
    const res = await POST(makeRequest(imageFile(0)), { params: params() });
    expect(res.status).toBe(400);
    expect(uploadProductImage).not.toHaveBeenCalled();
  });

  it("sem campo file retorna 400", async () => {
    const res = await POST(makeRequest(null), { params: params() });
    expect(res.status).toBe(400);
  });

  it("T19 — imagem falsa (ValidationError no service) retorna 400", async () => {
    uploadProductImage.mockRejectedValueOnce(
      new ValidationError("Arquivo não é uma imagem válida"),
    );
    const res = await POST(makeRequest(imageFile(1024)), { params: params() });
    expect(res.status).toBe(400);
  });

  it("produto inexistente retorna 404", async () => {
    uploadProductImage.mockRejectedValueOnce(new NotFoundError());
    const res = await POST(makeRequest(imageFile(1024)), { params: params() });
    expect(res.status).toBe(404);
  });

  it("id inválido na rota retorna 400", async () => {
    const res = await POST(makeRequest(imageFile(1024)), {
      params: params("not-a-uuid"),
    });
    expect(res.status).toBe(400);
  });
});
