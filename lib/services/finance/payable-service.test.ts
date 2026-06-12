// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedPayable,
  seedTenant,
} from "@/db/__tests__/seed";
import { cashMovements, payablePayments } from "@/db/schema";
import { ValidationError } from "@/lib/services/errors";
import type { AuthContext } from "@/types/product";

import { getCashBalance } from "./cash-service";
import {
  createPayable,
  listPayables,
  recordPayablePayment,
} from "./payable-service";

const suite = HAS_DB ? describe : describe.skip;

const YESTERDAY = (() => {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
})();

suite("payable-service (integração)", () => {
  let user = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let tenantId = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja Pagar");
    ctx = { userId: user.userId, tenantId };
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (user.userId) await deleteTestUser(user.userId);
  });

  it("RF11 — cria conta a pagar com categoria (aberto)", async () => {
    const p = await createPayable(ctx, {
      description: "Conta de luz",
      totalCents: 8000,
      category: "Energia",
    });
    expect(p.category).toBe("Energia");
    expect(p.status).toBe("aberto");
    expect(p.remainingCents).toBe(8000);
  });

  it("RN04 — pagamento parcial → parcial", async () => {
    const id = await seedPayable(tenantId, user.userId, {
      description: "Aluguel",
      totalCents: 100000,
      category: "Aluguel",
    });
    const p = await recordPayablePayment(ctx, {
      accountId: id,
      amountCents: 40000,
      method: "pix",
    });
    expect(p.status).toBe("parcial");
    expect(p.remainingCents).toBe(60000);
  });

  it("RN08 — pagamento dinheiro gera SAÍDA negativa no caixa", async () => {
    const id = await seedPayable(tenantId, user.userId, {
      description: "Fornecedor",
      totalCents: 5000,
      category: "Mercadoria",
    });
    const before = (await getCashBalance(ctx)).balanceCents;
    await recordPayablePayment(ctx, {
      accountId: id,
      amountCents: 5000,
      method: "dinheiro",
    });
    const after = (await getCashBalance(ctx)).balanceCents;
    expect(after).toBe(before - 5000);

    const [payment] = await db
      .select()
      .from(payablePayments)
      .where(eq(payablePayments.payableId, id));
    const [movement] = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.id, payment.cashMovementId!));
    expect(movement.amountCents).toBe(-5000);
    expect(movement.origin).toBe("pagamento");
  });

  it("RN08 — pagamento cartão NÃO toca o caixa", async () => {
    const id = await seedPayable(tenantId, user.userId, {
      description: "Internet",
      totalCents: 3000,
      category: "Serviços",
    });
    const before = (await getCashBalance(ctx)).balanceCents;
    await recordPayablePayment(ctx, {
      accountId: id,
      amountCents: 3000,
      method: "cartao",
    });
    const after = (await getCashBalance(ctx)).balanceCents;
    expect(after).toBe(before);

    const [payment] = await db
      .select()
      .from(payablePayments)
      .where(eq(payablePayments.payableId, id));
    expect(payment.cashMovementId).toBeNull();
  });

  it("RN03 — pagamento acima do saldo é rejeitado SEM resíduo", async () => {
    const id = await seedPayable(tenantId, user.userId, {
      description: "Pequena",
      totalCents: 1000,
      category: "Outros",
    });
    const pBefore = await db
      .select()
      .from(payablePayments)
      .where(eq(payablePayments.payableId, id));
    const cBefore = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.tenantId, tenantId));

    await expect(
      recordPayablePayment(ctx, {
        accountId: id,
        amountCents: 1001,
        method: "dinheiro",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const pAfter = await db
      .select()
      .from(payablePayments)
      .where(eq(payablePayments.payableId, id));
    const cAfter = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.tenantId, tenantId));
    expect(pAfter.length).toBe(pBefore.length);
    expect(cAfter.length).toBe(cBefore.length);
  });

  it("RF11 — lista filtra por status e categoria", async () => {
    const energia = await listPayables(ctx, { category: "Energia" });
    expect(energia.every((p) => p.category === "Energia")).toBe(true);
    const abertos = await listPayables(ctx, { status: "aberto" });
    expect(abertos.every((p) => p.status === "aberto")).toBe(true);
  });

  it("RF14 — overdue: vencida e aberta = true", async () => {
    const id = await seedPayable(tenantId, user.userId, {
      description: "Vencida",
      totalCents: 2000,
      category: "Outros",
      dueDate: YESTERDAY,
    });
    const list = await listPayables(ctx, {});
    const overdue = list.find((p) => p.id === id);
    expect(overdue?.overdue).toBe(true);
  });

  it("RNF02 — pagamento dinheiro é atômico (pagamento + caixa juntos)", async () => {
    const id = await seedPayable(tenantId, user.userId, {
      description: "Atômico",
      totalCents: 4000,
      category: "Outros",
    });
    await recordPayablePayment(ctx, {
      accountId: id,
      amountCents: 4000,
      method: "dinheiro",
    });
    const [payment] = await db
      .select()
      .from(payablePayments)
      .where(eq(payablePayments.payableId, id));
    const linked = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.id, payment.cashMovementId!));
    expect(linked.length).toBe(1);
    expect(linked[0].payablePaymentId).toBe(payment.id);
  });
});
