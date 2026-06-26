import { describe, expect, it } from "vitest";

import { planPriceSchema } from "./platform";

describe("planPriceSchema (preço do plano)", () => {
  it("aceita 0 (não definido) e valor positivo em centavos", () => {
    expect(planPriceSchema.safeParse({ priceCents: 0 }).success).toBe(true);
    expect(planPriceSchema.safeParse({ priceCents: 4990 }).success).toBe(true);
  });

  it("rejeita negativo, não-inteiro, Infinity e acima do teto", () => {
    expect(planPriceSchema.safeParse({ priceCents: -1 }).success).toBe(false);
    expect(planPriceSchema.safeParse({ priceCents: 49.9 }).success).toBe(false);
    expect(planPriceSchema.safeParse({ priceCents: Infinity }).success).toBe(false);
    expect(planPriceSchema.safeParse({ priceCents: 1_000_001 }).success).toBe(false);
  });
});
