import { describe, expect, it } from "vitest";

import { createProductSchema } from "./product";

const base = {
  name: "Coca-Cola 350ml",
  unit: "un" as const,
  stockQuantity: 10,
};

describe("createProductSchema", () => {
  it("T02 — rejeita unidade inválida (RF01)", () => {
    const result = createProductSchema.safeParse({
      ...base,
      unit: "lt",
      salePriceCents: 500,
    });
    expect(result.success).toBe(false);
  });

  it("T20 — rejeita custo negativo (RN02)", () => {
    const result = createProductSchema.safeParse({
      ...base,
      costCents: -1,
      salePriceCents: 500,
    });
    expect(result.success).toBe(false);
  });

  it("T21 — aceita custo/preço iguais a zero (RN02)", () => {
    const result = createProductSchema.safeParse({
      ...base,
      costCents: 0,
      salePriceCents: 0,
    });
    expect(result.success).toBe(true);
  });

  it("T23 — markup não é obrigatório para salvar (RN04)", () => {
    const result = createProductSchema.safeParse({
      ...base,
      salePriceCents: 900,
    });
    expect(result.success).toBe(true);
  });

  it("T24 — falha quando não há nem preço nem custo (RN04)", () => {
    const result = createProductSchema.safeParse({ ...base });
    expect(result.success).toBe(false);
  });
});
