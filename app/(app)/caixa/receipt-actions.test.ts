// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocka apenas auth e a fronteira RLS; os erros (ValidationError/toActionError)
// permanecem reais para validar o contrato de retorno da action.
vi.mock("@/lib/auth", () => ({ requireAuthContext: vi.fn() }));
vi.mock("@/db/rls", () => ({ withUserRls: vi.fn() }));

import { withUserRls } from "@/db/rls";
import { requireAuthContext } from "@/lib/auth";

import { getSaleReceiptAction } from "./receipt-actions";

const SALE_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const CTX = { userId: "user-1", tenantId: "tenant-1" };

const requireAuthContextMock = vi.mocked(requireAuthContext);
const withUserRlsMock = vi.mocked(withUserRls);

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthContextMock.mockResolvedValue(CTX as never);
});

describe("getSaleReceiptAction storeName (RF05/RN02)", () => {
  it("T02 — ReceiptDto expõe storeName = nome do tenant", async () => {
    withUserRlsMock.mockResolvedValue({
      sale: {
        id: SALE_ID,
        totalCents: 1500,
        paymentMethod: "dinheiro",
        createdAt: new Date("2026-06-27T12:00:00.000Z"),
      },
      lines: [],
      storeName: "Loja do Zé",
    } as never);

    const res = await getSaleReceiptAction(SALE_ID);

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("esperava ok:true");
    expect(res.data.storeName).toBe("Loja do Zé");
  });

  it("T04 — venda inexistente/de outro tenant é rejeitada sem vazar storeName", async () => {
    // withUserRls retorna null quando a venda não pertence ao tenant da sessão.
    withUserRlsMock.mockResolvedValue(null as never);

    const res = await getSaleReceiptAction(SALE_ID);

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("esperava ok:false");
    expect(res.error).toBe("Venda não encontrada");
    expect(res).not.toHaveProperty("data");
  });
});
