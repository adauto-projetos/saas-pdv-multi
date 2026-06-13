// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  addComandaItemSchema,
  closeComandaSchema,
  comandaFilterSchema,
  openComandaSchema,
  removeComandaItemSchema,
} from "./comanda";

/**
 * Testes dos schemas zod de comanda. Roda sem banco (zod puro).
 * IDs de teste (UUID v4 válidos).
 */
const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";
const INVALID_UUID = "not-a-uuid";

// ---- val-RN01-label-required ------------------------------------------------

describe("val-RN01-label-required — label não-vazio", () => {
  it('string vazia → false ("" deve falhar)', () => {
    expect(openComandaSchema.safeParse({ label: "" }).success).toBe(false);
  });

  it('só espaços → false ("  " deve falhar por trim().min(1))', () => {
    expect(openComandaSchema.safeParse({ label: "  " }).success).toBe(false);
  });

  it('"Mesa 3" → true', () => {
    expect(openComandaSchema.safeParse({ label: "Mesa 3" }).success).toBe(true);
  });

  it("label sem espaços extras é preservado no trim", () => {
    const result = openComandaSchema.safeParse({ label: "  João  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.label).toBe("João");
  });
});

// ---- val-RN02-quantity-positive ---------------------------------------------

describe("val-RN02-quantity-positive — quantity finito > 0", () => {
  const base = { comandaId: VALID_UUID, productId: VALID_UUID };

  it("0 → false", () => {
    expect(addComandaItemSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
  });

  it("-1 → false", () => {
    expect(addComandaItemSchema.safeParse({ ...base, quantity: -1 }).success).toBe(false);
  });

  it("Infinity → false (.finite())", () => {
    expect(addComandaItemSchema.safeParse({ ...base, quantity: Infinity }).success).toBe(false);
  });

  it("2 → true", () => {
    expect(addComandaItemSchema.safeParse({ ...base, quantity: 2 }).success).toBe(true);
  });

  it("0.75 → true (decimal positivo)", () => {
    expect(addComandaItemSchema.safeParse({ ...base, quantity: 0.75 }).success).toBe(true);
  });
});

// ---- val-RN02-ids-uuid ------------------------------------------------------

describe("val-RN02-ids-uuid — ids devem ser uuid válidos", () => {
  it("comandaId inválido → false", () => {
    expect(
      addComandaItemSchema.safeParse({
        comandaId: INVALID_UUID,
        productId: VALID_UUID,
        quantity: 1,
      }).success,
    ).toBe(false);
  });

  it("productId inválido → false", () => {
    expect(
      addComandaItemSchema.safeParse({
        comandaId: VALID_UUID,
        productId: INVALID_UUID,
        quantity: 1,
      }).success,
    ).toBe(false);
  });

  it("ambos válidos → true", () => {
    expect(
      addComandaItemSchema.safeParse({
        comandaId: VALID_UUID,
        productId: VALID_UUID,
        quantity: 1,
      }).success,
    ).toBe(true);
  });

  it("removeComandaItemSchema — itemId inválido → false", () => {
    expect(
      removeComandaItemSchema.safeParse({
        comandaId: VALID_UUID,
        itemId: INVALID_UUID,
      }).success,
    ).toBe(false);
  });
});

// ---- val-RN11-observation-optional ------------------------------------------

describe("val-RN11-observation-optional — observation opcional/trim/limite", () => {
  const base = { comandaId: VALID_UUID, productId: VALID_UUID, quantity: 1 };

  it("omitir observation → true (opcional)", () => {
    expect(addComandaItemSchema.safeParse({ ...base }).success).toBe(true);
  });

  it('"sem cebola" → true', () => {
    expect(
      addComandaItemSchema.safeParse({ ...base, observation: "sem cebola" }).success,
    ).toBe(true);
  });

  it("observation > 200 chars → false", () => {
    const over = "x".repeat(201);
    expect(
      addComandaItemSchema.safeParse({ ...base, observation: over }).success,
    ).toBe(false);
  });

  it("observation = 200 chars → true (limite exato)", () => {
    const exact = "x".repeat(200);
    expect(
      addComandaItemSchema.safeParse({ ...base, observation: exact }).success,
    ).toBe(true);
  });

  it("observation null → true (nullable)", () => {
    expect(
      addComandaItemSchema.safeParse({ ...base, observation: null }).success,
    ).toBe(true);
  });
});

// ---- val-RN07-fiado-requires-customer ---------------------------------------

describe("val-RN07-fiado-requires-customer — fiado exige customerId", () => {
  const base = { comandaId: VALID_UUID };

  it("fiado sem customer → false", () => {
    expect(
      closeComandaSchema.safeParse({
        ...base,
        paymentMethod: "fiado",
      }).success,
    ).toBe(false);
  });

  it("fiado com customer → true", () => {
    expect(
      closeComandaSchema.safeParse({
        ...base,
        paymentMethod: "fiado",
        customerId: VALID_UUID,
      }).success,
    ).toBe(true);
  });

  it("dinheiro sem customer → true", () => {
    expect(
      closeComandaSchema.safeParse({
        ...base,
        paymentMethod: "dinheiro",
      }).success,
    ).toBe(true);
  });

  it("pix sem customer → true", () => {
    expect(
      closeComandaSchema.safeParse({
        ...base,
        paymentMethod: "pix",
      }).success,
    ).toBe(true);
  });

  it("cartao sem customer → true", () => {
    expect(
      closeComandaSchema.safeParse({
        ...base,
        paymentMethod: "cartao",
      }).success,
    ).toBe(true);
  });
});

// ---- val-RN02-close-payment-enum --------------------------------------------

describe("val-RN02-close-payment-enum — só métodos válidos", () => {
  const base = { comandaId: VALID_UUID };

  it('"boleto" → false (método desconhecido)', () => {
    expect(
      closeComandaSchema.safeParse({ ...base, paymentMethod: "boleto" }).success,
    ).toBe(false);
  });

  it('"dinheiro" → true', () => {
    expect(
      closeComandaSchema.safeParse({ ...base, paymentMethod: "dinheiro" }).success,
    ).toBe(true);
  });

  it('"pix" → true', () => {
    expect(
      closeComandaSchema.safeParse({ ...base, paymentMethod: "pix" }).success,
    ).toBe(true);
  });

  it('"cartao" → true', () => {
    expect(
      closeComandaSchema.safeParse({ ...base, paymentMethod: "cartao" }).success,
    ).toBe(true);
  });

  it('"fiado" com customer → true', () => {
    expect(
      closeComandaSchema.safeParse({
        ...base,
        paymentMethod: "fiado",
        customerId: VALID_UUID,
      }).success,
    ).toBe(true);
  });
});

// ---- val-comanda-filter-optional -------------------------------------------

describe("val-comanda-filter-optional — todos os campos opcionais", () => {
  it("{} → true (todos opcionais)", () => {
    expect(comandaFilterSchema.safeParse({}).success).toBe(true);
  });

  it("{from, to} → true", () => {
    expect(
      comandaFilterSchema.safeParse({
        from: "2026-01-01",
        to: "2026-12-31",
      }).success,
    ).toBe(true);
  });

  it("{status: 'aberta'} → true", () => {
    expect(
      comandaFilterSchema.safeParse({ status: "aberta" }).success,
    ).toBe(true);
  });

  it("{status: 'fechada'} → true", () => {
    expect(
      comandaFilterSchema.safeParse({ status: "fechada" }).success,
    ).toBe(true);
  });

  it("{status: 'cancelada'} → true", () => {
    expect(
      comandaFilterSchema.safeParse({ status: "cancelada" }).success,
    ).toBe(true);
  });

  it("{status: 'invalido'} → false", () => {
    expect(
      comandaFilterSchema.safeParse({ status: "invalido" }).success,
    ).toBe(false);
  });
});
