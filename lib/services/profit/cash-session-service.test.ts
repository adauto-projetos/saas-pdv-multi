// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedProduct,
  seedTenant,
} from "@/db/__tests__/seed";
import { cashSessions } from "@/db/schema";
import { registerCashMovement } from "@/lib/services/finance/cash-service";
import { finalizeSale } from "@/lib/services/sales/sale-service";
import { ConflictError, ValidationError } from "@/lib/services/errors";
import { finalizeSaleSchema } from "@/lib/validation/sale";
import type { AuthContext } from "@/types/product";

import {
  closeCashSession,
  getOpenSession,
  listSessions,
  openCashSession,
} from "./cash-session-service";

const suite = HAS_DB ? describe : describe.skip;

suite("cash-session-service (integração)", () => {
  let user = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let tenantId = "";
  let productId = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja Sessao");
    ctx = { userId: user.userId, tenantId };
    productId = await seedProduct(tenantId, {
      name: "Refri",
      unit: "un",
      salePriceCents: 1000,
      stockQuantity: 100,
      costCents: 400,
    });
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (user.userId) await deleteTestUser(user.userId);
  });

  // Cada teste começa de um estado conhecido: fecha qualquer sessão aberta.
  async function ensureNoOpenSession() {
    const open = await getOpenSession(ctx);
    if (open) await closeCashSession(ctx, { countedCents: 0 });
  }

  const sellCash = (quantity: number, paymentMethod = "dinheiro") =>
    finalizeSale(
      ctx,
      finalizeSaleSchema.parse({
        items: [{ productId, quantity }],
        paymentMethod,
      }),
    );

  it("session-RF04-open: abrir cria sessão 'aberta' com saldo inicial", async () => {
    await ensureNoOpenSession();
    const session = await openCashSession(ctx, { openingBalanceCents: 5000 });
    expect(session.status).toBe("aberta");
    expect(session.openingBalanceCents).toBe(5000);
    expect(session.openedBy).toBe(ctx.userId);
    expect(session.closedAt).toBeNull();
    expect(session.expectedCents).toBeNull();
  });

  it("session-RN10-attribution: sessão usa user/tenant do ctx", async () => {
    await ensureNoOpenSession();
    const session = await openCashSession(ctx, { openingBalanceCents: 1000 });
    const [row] = await db
      .select()
      .from(cashSessions)
      .where(eq(cashSessions.id, session.id));
    expect(row.openedBy).toBe(ctx.userId);
    expect(row.tenantId).toBe(tenantId);
  });

  it("session-RN09-single-open: abrir 2ª com uma aberta rejeita", async () => {
    await ensureNoOpenSession();
    await openCashSession(ctx, { openingBalanceCents: 1000 });
    await expect(
      openCashSession(ctx, { openingBalanceCents: 2000 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("session-RN09-close-requires-open: fechar exige sessão aberta", async () => {
    await ensureNoOpenSession();
    await expect(closeCashSession(ctx, { countedCents: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("session-RN09-reopen-after-close: após fechar pode abrir nova", async () => {
    await ensureNoOpenSession();
    const first = await openCashSession(ctx, { openingBalanceCents: 1000 });
    await closeCashSession(ctx, { countedCents: 1000 });
    const second = await openCashSession(ctx, { openingBalanceCents: 2000 });
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe("aberta");
  });

  it("session-RF06-expected: esperado=opening+Σ dinheiro; divergência", async () => {
    await ensureNoOpenSession();
    await openCashSession(ctx, { openingBalanceCents: 5000 });
    const sale = await sellCash(2); // 2 × 1000 = 2000 em dinheiro
    expect(sale.totalCents).toBe(2000);
    const closed = await closeCashSession(ctx, { countedCents: 7000 });
    expect(closed.expectedCents).toBe(7000); // 5000 + 2000
    expect(closed.countedCents).toBe(7000);
    expect(closed.divergenceCents).toBe(0);
    expect(closed.status).toBe("fechada");
  });

  it("session-RN06-money-only: esperado só dinheiro; pix/fiado fora", async () => {
    await ensureNoOpenSession();
    await openCashSession(ctx, { openingBalanceCents: 5000 });
    await sellCash(2); // dinheiro 2000
    await sellCash(3, "pix"); // pix — não toca caixa
    const closed = await closeCashSession(ctx, { countedCents: 7000 });
    expect(closed.expectedCents).toBe(7000); // só os 2000 em dinheiro
  });

  it("session-RN06-supply-and-sangria: suprimento(+) e sangria(−) no esperado", async () => {
    await ensureNoOpenSession();
    await openCashSession(ctx, { openingBalanceCents: 5000 });
    await registerCashMovement(ctx, {
      amountCents: 1000,
      description: "Suprimento",
      type: "entrada",
    });
    await registerCashMovement(ctx, {
      amountCents: 400,
      description: "Sangria",
      type: "saida",
    });
    const closed = await closeCashSession(ctx, { countedCents: 5600 });
    expect(closed.expectedCents).toBe(5600); // 5000 + 1000 − 400
  });

  it("session-RN07-divergence-sobra: divergência positiva = sobra", async () => {
    await ensureNoOpenSession();
    await openCashSession(ctx, { openingBalanceCents: 5000 });
    const closed = await closeCashSession(ctx, { countedCents: 5100 });
    expect(closed.divergenceCents).toBe(100);
    expect(closed.status).toBe("fechada");
  });

  it("session-RN07-divergence-falta: divergência negativa = falta", async () => {
    await ensureNoOpenSession();
    await openCashSession(ctx, { openingBalanceCents: 5000 });
    const closed = await closeCashSession(ctx, { countedCents: 4900 });
    expect(closed.divergenceCents).toBe(-100);
    expect(closed.status).toBe("fechada");
  });

  it("session-RN08-immutable: sessão imutável após fechada", async () => {
    await ensureNoOpenSession();
    const session = await openCashSession(ctx, { openingBalanceCents: 5000 });
    const closed = await closeCashSession(ctx, { countedCents: 5000 });
    // Fechar de novo é rejeitado (não há aberta).
    await expect(closeCashSession(ctx, { countedCents: 9999 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    // Re-leitura idêntica — campos estáveis, sem reopen.
    const [row] = await db
      .select()
      .from(cashSessions)
      .where(eq(cashSessions.id, session.id));
    expect(row.status).toBe("fechada");
    expect(row.countedCents).toBe(closed.countedCents);
    expect(row.expectedCents).toBe(closed.expectedCents);
    expect(row.divergenceCents).toBe(closed.divergenceCents);
  });

  it("session-RF07-history: histórico lista sessões por período", async () => {
    await ensureNoOpenSession();
    await openCashSession(ctx, { openingBalanceCents: 1000 });
    await closeCashSession(ctx, { countedCents: 1000 });
    await openCashSession(ctx, { openingBalanceCents: 2000 });
    await closeCashSession(ctx, { countedCents: 2000 });
    const history = await listSessions(ctx, {});
    expect(history.length).toBeGreaterThanOrEqual(2);
    const item = history[0];
    expect(item).toHaveProperty("openedAt");
    expect(item).toHaveProperty("closedAt");
    expect(item).toHaveProperty("expectedCents");
    expect(item).toHaveProperty("countedCents");
    expect(item).toHaveProperty("divergenceCents");
    expect(item).toHaveProperty("openedBy");
  });

  it("session-RF08-open-getter: turno aberto exposto; null após fechar", async () => {
    await ensureNoOpenSession();
    const open = await openCashSession(ctx, { openingBalanceCents: 3000 });
    const got = await getOpenSession(ctx);
    expect(got).not.toBeNull();
    expect(got?.id).toBe(open.id);
    await closeCashSession(ctx, { countedCents: 3000 });
    expect(await getOpenSession(ctx)).toBeNull();
  });
});
