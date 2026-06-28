import { describe, expect, it } from "vitest";

import type { ReceiptDto } from "@/app/(app)/caixa/receipt-actions";

import { buildReceiptHtml } from "./PaymentDialog";

function makeReceipt(overrides: Partial<ReceiptDto> = {}): ReceiptDto {
  return {
    saleId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    storeName: "Loja do Zé",
    totalCents: 1500,
    paymentMethod: "dinheiro",
    createdAt: "2026-06-27T12:00:00.000Z",
    items: [
      { name: "Café", quantity: 1, unit: "un", unitPriceCents: 1500, subtotalCents: 1500 },
    ],
    ...overrides,
  };
}

describe("buildReceiptHtml (RF05/RN02)", () => {
  it("usa o nome da loja no cabeçalho quando presente", () => {
    const html = buildReceiptHtml(makeReceipt({ storeName: "Loja do Zé" }));
    expect(html).toContain("<h1>Loja do Zé</h1>");
  });

  it("T05 — storeName vazio cai para a marca PDV.ART.br", () => {
    const html = buildReceiptHtml(makeReceipt({ storeName: "" }));
    expect(html).toContain("<h1>PDV.ART.br</h1>");
  });

  it("T06 — rodapé do recibo mostra 'via PDV.ART.br'", () => {
    const html = buildReceiptHtml(makeReceipt());
    expect(html).toContain("via PDV.ART.br");
  });
});
