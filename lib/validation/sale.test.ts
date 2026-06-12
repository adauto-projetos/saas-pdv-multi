import { describe, expect, it } from "vitest";

import { finalizeSaleSchema } from "./sale";

// UUID v4 válido (o z.uuid() do Zod v4 valida a versão).
const PRODUCT_ID = "00000000-0000-4000-8000-000000000001";

describe("finalizeSaleSchema", () => {
  it("aceita venda válida", () => {
    const result = finalizeSaleSchema.safeParse({
      items: [{ productId: PRODUCT_ID, quantity: 2 }],
      paymentMethod: "dinheiro",
    });
    expect(result.success).toBe(true);
  });

  it("T09 — rejeita carrinho vazio (RN03)", () => {
    const result = finalizeSaleSchema.safeParse({
      items: [],
      paymentMethod: "dinheiro",
    });
    expect(result.success).toBe(false);
  });

  it("T10 — rejeita quantidade ≤ 0 (RN04)", () => {
    const result = finalizeSaleSchema.safeParse({
      items: [{ productId: PRODUCT_ID, quantity: 0 }],
      paymentMethod: "dinheiro",
    });
    expect(result.success).toBe(false);
  });

  it("T12 — rejeita forma de pagamento inválida (RN07)", () => {
    const result = finalizeSaleSchema.safeParse({
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      paymentMethod: "boleto",
    });
    expect(result.success).toBe(false);
  });

  it("0004F — fiado sem cliente é rejeitado (RN07)", () => {
    const result = finalizeSaleSchema.safeParse({
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      paymentMethod: "fiado",
    });
    expect(result.success).toBe(false);
  });

  it("0004F — fiado com cliente é aceito", () => {
    const result = finalizeSaleSchema.safeParse({
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      paymentMethod: "fiado",
      customerId: PRODUCT_ID,
    });
    expect(result.success).toBe(true);
  });

  it("0004F — dinheiro sem cliente continua válido", () => {
    const result = finalizeSaleSchema.safeParse({
      items: [{ productId: PRODUCT_ID, quantity: 1 }],
      paymentMethod: "dinheiro",
    });
    expect(result.success).toBe(true);
  });
});
