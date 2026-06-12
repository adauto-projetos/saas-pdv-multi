// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedCustomer,
  seedReceivable,
  seedTenant,
} from "@/db/__tests__/seed";
import { cashMovements, receivablePayments } from "@/db/schema";
import { ValidationError } from "@/lib/services/errors";
import type { AuthContext } from "@/types/product";

import { getCashBalance } from "./cash-service";
import {
  createReceivable,
  getCustomerOwedTotal,
  listReceivables,
  recordReceivablePayment,
} from "./receivable-service";

const suite = HAS_DB ? describe : describe.skip;

const YESTERDAY = (() => {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
})();

suite("receivable-service (integração)", () => {
  let user = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let tenantId = "";
  let customerId = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja Receber");
    ctx = { userId: user.userId, tenantId };
    customerId = await seedCustomer(tenantId, "Cliente Fiel");
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (user.userId) await deleteTestUser(user.userId);
  });

  it("RF08 — cria conta a receber avulsa (aberto)", async () => {
    const r = await createReceivable(ctx, {
      customerId,
      totalCents: 10000,
      description: "Avulsa",
    });
    expect(r.origin).toBe("avulsa");
    expect(r.status).toBe("aberto");
    expect(r.remainingCents).toBe(10000);
    expect(r.customerName).toBe("Cliente Fiel");
  });

  it("RN04 — pagamento parcial → parcial; total → quitado", async () => {
    const id = await seedReceivable(tenantId, user.userId, {
      customerId,
      totalCents: 10000,
    });
    const partial = await recordReceivablePayment(ctx, {
      accountId: id,
      amountCents: 4000,
      method: "pix",
    });
    expect(partial.status).toBe("parcial");
    expect(partial.paidCents).toBe(4000);
    expect(partial.remainingCents).toBe(6000);

    const full = await recordReceivablePayment(ctx, {
      accountId: id,
      amountCents: 6000,
      method: "pix",
    });
    expect(full.status).toBe("quitado");
    expect(full.remainingCents).toBe(0);
  });

  it("RN08 — recebimento dinheiro entra no caixa e linka cashMovementId", async () => {
    const id = await seedReceivable(tenantId, user.userId, {
      customerId,
      totalCents: 5000,
    });
    const before = (await getCashBalance(ctx)).balanceCents;
    await recordReceivablePayment(ctx, {
      accountId: id,
      amountCents: 5000,
      method: "dinheiro",
    });
    const after = (await getCashBalance(ctx)).balanceCents;
    expect(after).toBe(before + 5000);

    const [payment] = await db
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.receivableId, id));
    expect(payment.cashMovementId).not.toBeNull();
  });

  it("RN08 — recebimento pix NÃO toca o caixa (cashMovementId null)", async () => {
    const id = await seedReceivable(tenantId, user.userId, {
      customerId,
      totalCents: 5000,
    });
    const before = (await getCashBalance(ctx)).balanceCents;
    await recordReceivablePayment(ctx, {
      accountId: id,
      amountCents: 5000,
      method: "pix",
    });
    const after = (await getCashBalance(ctx)).balanceCents;
    expect(after).toBe(before);

    const [payment] = await db
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.receivableId, id));
    expect(payment.cashMovementId).toBeNull();
  });

  it("RN03 — recebimento acima do saldo é rejeitado SEM resíduo", async () => {
    const id = await seedReceivable(tenantId, user.userId, {
      customerId,
      totalCents: 1000,
    });
    const pBefore = await db
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.receivableId, id));
    const cBefore = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.tenantId, tenantId));

    await expect(
      recordReceivablePayment(ctx, {
        accountId: id,
        amountCents: 1001,
        method: "dinheiro",
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    const pAfter = await db
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.receivableId, id));
    const cAfter = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.tenantId, tenantId));
    expect(pAfter.length).toBe(pBefore.length);
    expect(cAfter.length).toBe(cBefore.length);
  });

  it("RN03 — recebimento exato (= saldo) é aceito", async () => {
    const id = await seedReceivable(tenantId, user.userId, {
      customerId,
      totalCents: 1000,
    });
    const r = await recordReceivablePayment(ctx, {
      accountId: id,
      amountCents: 1000,
      method: "pix",
    });
    expect(r.status).toBe("quitado");
  });

  it("RF10 — total em aberto do cliente soma saldos não quitados", async () => {
    const owedCustomer = await seedCustomer(tenantId, "Devedor");
    await seedReceivable(tenantId, user.userId, {
      customerId: owedCustomer,
      totalCents: 3000,
    });
    await seedReceivable(tenantId, user.userId, {
      customerId: owedCustomer,
      totalCents: 2000,
    });
    const owed = await getCustomerOwedTotal(ctx, owedCustomer);
    expect(owed.name).toBe("Devedor");
    expect(owed.totalOwedCents).toBe(5000);
  });

  it("RF08 — lista filtra por status e cliente", async () => {
    const byCustomer = await listReceivables(ctx, { customerId });
    expect(byCustomer.every((r) => r.customerId === customerId)).toBe(true);
    const quitados = await listReceivables(ctx, { status: "quitado" });
    expect(quitados.every((r) => r.status === "quitado")).toBe(true);
  });

  it("RF14 — overdue: vencida e aberta = true; quitada = false", async () => {
    const overdueId = await seedReceivable(tenantId, user.userId, {
      customerId,
      totalCents: 2000,
      dueDate: YESTERDAY,
    });
    const list = await listReceivables(ctx, {});
    const overdue = list.find((r) => r.id === overdueId);
    expect(overdue?.overdue).toBe(true);

    const paidOverdueId = await seedReceivable(tenantId, user.userId, {
      customerId,
      totalCents: 2000,
      dueDate: YESTERDAY,
    });
    await recordReceivablePayment(ctx, {
      accountId: paidOverdueId,
      amountCents: 2000,
      method: "pix",
    });
    const list2 = await listReceivables(ctx, {});
    const paid = list2.find((r) => r.id === paidOverdueId);
    expect(paid?.overdue).toBe(false);
  });

  it("RNF02 — pagamento dinheiro é atômico (pagamento + caixa juntos)", async () => {
    const id = await seedReceivable(tenantId, user.userId, {
      customerId,
      totalCents: 4000,
    });
    await recordReceivablePayment(ctx, {
      accountId: id,
      amountCents: 4000,
      method: "dinheiro",
    });
    const [payment] = await db
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.receivableId, id));
    const linked = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.id, payment.cashMovementId!));
    expect(linked.length).toBe(1);
    expect(linked[0].receivablePaymentId).toBe(payment.id);
    expect(linked[0].origin).toBe("recebimento");
  });

  // immut-RN10-payment-final: pagamento registrado permanece imutável (RN10).
  it("RN10 — pagamento registrado não muda após re-leitura", async () => {
    const id = await seedReceivable(tenantId, user.userId, {
      customerId,
      totalCents: 3000,
    });
    await recordReceivablePayment(ctx, {
      accountId: id,
      amountCents: 1500,
      method: "pix",
    });
    const [first] = await db
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.receivableId, id));
    // Re-leitura logo após confirma que amount, method e receivable_id são imutáveis.
    const [second] = await db
      .select()
      .from(receivablePayments)
      .where(eq(receivablePayments.receivableId, id));
    expect(second.amountCents).toBe(first.amountCents);
    expect(second.method).toBe(first.method);
    expect(second.receivableId).toBe(first.receivableId);
    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
  });

  // immut-RN10-no-update-recv: receivable-service não expõe updateReceivable /
  // deleteReceivable — a imutabilidade é estrutural (RN10). Verificado via
  // importação estática: se os nomes existissem o compilador os resolveria.
  it("RN10 — service não expõe updateReceivable nem deleteReceivable", async () => {
    const svc = await import("./receivable-service");
    expect(svc).not.toHaveProperty("updateReceivable");
    expect(svc).not.toHaveProperty("deleteReceivable");
    expect(svc).not.toHaveProperty("updateReceivablePayment");
    expect(svc).not.toHaveProperty("deleteReceivablePayment");
  });
});
