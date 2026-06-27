import { describe, expect, it, vi } from "vitest";

import type { AuthContext } from "@/types/product";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireAuthContext: vi.fn(
    async (): Promise<AuthContext> => ({ userId: "u1", tenantId: "t1" }),
  ),
}));

// Guard de permissão (0014F): isolado em permissions.test.ts; aqui é no-op para
// testar a action sem tocar o banco.
vi.mock("@/lib/auth/permissions", () => ({
  requirePermission: vi.fn(async () => {}),
  requireAnyPermission: vi.fn(async () => {}),
}));

vi.mock("@/lib/services/products/product-service", () => ({
  createProduct: vi.fn(async (ctx: AuthContext, input: Record<string, unknown>) => ({
    id: "p1",
    tenantId: ctx.tenantId,
    name: input.name,
    barcode: input.barcode ?? null,
    unit: input.unit,
    costCents: input.costCents ?? null,
    markupPercent: input.markupPercent ?? null,
    salePriceCents: input.salePriceCents ?? 1300,
    priceIsManual: false,
    stockQuantity: input.stockQuantity ?? 0,
    createdAt: "2026-06-09T00:00:00.000Z",
    updatedAt: "2026-06-09T00:00:00.000Z",
  })),
}));

import * as service from "@/lib/services/products/product-service";

import { createProductAction } from "./actions";

describe("createProductAction (RF01)", () => {
  it("T01 — cria produto com todos os campos base e deriva tenantId da sessão", async () => {
    const result = await createProductAction({
      name: "Coca-Cola 350ml",
      barcode: "7894900011517",
      unit: "un",
      stockQuantity: 10,
      costCents: 1000,
      markupPercent: 30,
    });

    expect(result.ok).toBe(true);
    expect(service.createProduct).toHaveBeenCalledOnce();
    if (result.ok) {
      expect(result.data.name).toBe("Coca-Cola 350ml");
      expect(result.data.unit).toBe("un");
      // tenantId vem do contexto de auth (t1), nunca do input (RN05).
      expect(result.data.tenantId).toBe("t1");
    }
  });

  it("retorna fieldErrors quando o input é inválido", async () => {
    const result = await createProductAction({
      name: "",
      unit: "un",
      stockQuantity: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors).toBeDefined();
    }
  });
});
