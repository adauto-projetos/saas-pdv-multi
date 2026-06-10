import { describe, expect, it } from "vitest";

import { stockAdjustmentSchema, stockEntrySchema } from "./stock";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000001";

describe("stock validation", () => {
  it("aceita entrada válida", () => {
    expect(
      stockEntrySchema.safeParse({ productId: PRODUCT_ID, quantity: 10 })
        .success,
    ).toBe(true);
  });

  it("T02 — rejeita entrada com quantidade ≤ 0 (RN03)", () => {
    expect(
      stockEntrySchema.safeParse({ productId: PRODUCT_ID, quantity: 0 }).success,
    ).toBe(false);
  });

  it("aceita ajuste com contagem ≥ 0", () => {
    expect(
      stockAdjustmentSchema.safeParse({
        productId: PRODUCT_ID,
        countedQuantity: 0,
      }).success,
    ).toBe(true);
  });

  it("T04 — rejeita ajuste com contagem negativa (RN03)", () => {
    expect(
      stockAdjustmentSchema.safeParse({
        productId: PRODUCT_ID,
        countedQuantity: -1,
      }).success,
    ).toBe(false);
  });
});
