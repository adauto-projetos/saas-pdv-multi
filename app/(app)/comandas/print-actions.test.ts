// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

/**
 * Testes das server actions de reimpressão (0007F).
 * Serviço e auth totalmente mockados — sem DB, sem hardware.
 * T29: reprintReceiptAction com UUID inválido → ok:false sem chamar serviço
 * T30: reprintKitchenAction com UUID inválido → ok:false sem chamar serviço
 *
 * NOTA: Zod v4 z.string().uuid() valida UUIDs versão 4 (RFC 4122):
 *   - 3º segmento começa com "4" (version)
 *   - 4º segmento começa com [89ab] (variant)
 */

// vi.mock é hoistado — mocks declarados aqui precedem todos os imports.
vi.mock("@/lib/auth", () => ({
  requireAuthContext: vi.fn(async () => ({
    userId: "00000000-0000-4000-8000-000000000001",
    tenantId: "00000000-0000-4000-8000-000000000002",
  })),
}));

vi.mock("@/lib/services/print/print-service", () => ({
  reprintKitchen: vi.fn(async () => ({ success: true })),
  reprintReceipt: vi.fn(async () => ({ success: true })),
}));

// next/cache pode ser importado indiretamente — mock preventivo.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { reprintKitchenAction, reprintReceiptAction } from "./print-actions";
import { reprintKitchen, reprintReceipt } from "@/lib/services/print/print-service";

// UUIDs válidos v4 (version=4, variant=8)
const VALID_ITEM_ID = "00000000-0000-4000-8000-000000000003";
const VALID_SALE_ID = "00000000-0000-4000-8000-000000000004";

describe("reprintKitchenAction", () => {
  // T30: UUID inválido → ok:false sem chamar serviço
  it("T30: rejects invalid UUID — ok:false, serviço não chamado", async () => {
    const result = await reprintKitchenAction({ comandaItemId: "not-a-uuid" });
    expect(result.ok).toBe(false);
    expect(reprintKitchen).not.toHaveBeenCalled();
  });

  it("valid UUID v4 → ok:true, serviço chamado 1×", async () => {
    const result = await reprintKitchenAction({ comandaItemId: VALID_ITEM_ID });
    expect(result.ok).toBe(true);
    expect(reprintKitchen).toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.any(String) }),
      VALID_ITEM_ID,
    );
  });
});

describe("reprintReceiptAction", () => {
  // T29: UUID inválido → ok:false sem chamar serviço
  it("T29: rejects invalid saleId UUID — ok:false, serviço não chamado", async () => {
    const result = await reprintReceiptAction({ saleId: "not-a-uuid" });
    expect(result.ok).toBe(false);
    expect(reprintReceipt).not.toHaveBeenCalled();
  });

  it("valid saleId UUID v4 → ok:true, serviço chamado 1×", async () => {
    const result = await reprintReceiptAction({ saleId: VALID_SALE_ID });
    expect(result.ok).toBe(true);
    expect(reprintReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ userId: expect.any(String) }),
      VALID_SALE_ID,
    );
  });
});
