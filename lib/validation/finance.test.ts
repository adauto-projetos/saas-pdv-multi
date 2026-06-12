import { describe, expect, it } from "vitest";

import {
  cashMovementSchema,
  createCustomerSchema,
  createPayableSchema,
  createReceivableSchema,
  recordPaymentSchema,
} from "./finance";

const UUID = "00000000-0000-4000-8000-000000000001";

describe("finance validation", () => {
  it("cliente: nome é obrigatório", () => {
    expect(createCustomerSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createCustomerSchema.safeParse({ name: "Maria" }).success).toBe(true);
  });

  it("conta a pagar: categoria é obrigatória", () => {
    const base = { description: "Energia", totalCents: 5000 };
    expect(createPayableSchema.safeParse(base).success).toBe(false);
    expect(
      createPayableSchema.safeParse({ ...base, category: "Contas" }).success,
    ).toBe(true);
  });

  it("movimentação de caixa: rejeita 0 e negativo (RN02)", () => {
    const base = { description: "Sangria" };
    expect(
      cashMovementSchema.safeParse({ ...base, amountCents: 0 }).success,
    ).toBe(false);
    expect(
      cashMovementSchema.safeParse({ ...base, amountCents: -100 }).success,
    ).toBe(false);
    expect(
      cashMovementSchema.safeParse({ ...base, amountCents: 100 }).success,
    ).toBe(true);
  });

  it("conta a receber: rejeita valor negativo", () => {
    expect(
      createReceivableSchema.safeParse({
        customerId: UUID,
        totalCents: -1,
      }).success,
    ).toBe(false);
    expect(
      createReceivableSchema.safeParse({
        customerId: UUID,
        totalCents: 1000,
      }).success,
    ).toBe(true);
  });

  it("pagamento: amount > 0 (RN02)", () => {
    expect(
      recordPaymentSchema.safeParse({
        accountId: UUID,
        amountCents: 0,
        method: "dinheiro",
      }).success,
    ).toBe(false);
  });

  it("pagamento: rejeita método 'boleto' (só dinheiro/pix/cartao)", () => {
    expect(
      recordPaymentSchema.safeParse({
        accountId: UUID,
        amountCents: 100,
        method: "boleto",
      }).success,
    ).toBe(false);
    expect(
      recordPaymentSchema.safeParse({
        accountId: UUID,
        amountCents: 100,
        method: "pix",
      }).success,
    ).toBe(true);
  });
});
