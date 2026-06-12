// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedTenant,
} from "@/db/__tests__/seed";
import type { AuthContext } from "@/types/product";

import {
  getCashBalance,
  listCashMovements,
  registerCashMovement,
} from "./cash-service";

const suite = HAS_DB ? describe : describe.skip;

suite("cash-service (integração)", () => {
  let user = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let tenantId = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja Caixa Fin");
    ctx = { userId: user.userId, tenantId };
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (user.userId) await deleteTestUser(user.userId);
  });

  it("RF01 — suprimento grava entrada positiva", async () => {
    const mv = await registerCashMovement(ctx, {
      amountCents: 10000,
      description: "Suprimento",
      type: "entrada",
    });
    expect(mv.type).toBe("entrada");
    expect(mv.amountCents).toBe(10000);
    expect(mv.origin).toBe("manual");
    expect(mv.userId).toBe(ctx.userId);
  });

  it("RF02 — sangria grava saída negativa (sinal imposto)", async () => {
    const mv = await registerCashMovement(ctx, {
      amountCents: 3000,
      description: "Sangria",
      type: "saida",
    });
    expect(mv.type).toBe("saida");
    expect(mv.amountCents).toBe(-3000);
  });

  it("RF03/RN05 — saldo é a soma do ledger", async () => {
    const { balanceCents } = await getCashBalance(ctx);
    expect(balanceCents).toBe(7000); // 10000 − 3000
  });

  it("RF04 — extrato lista movimentações (mais recentes primeiro)", async () => {
    const all = await listCashMovements(ctx, {});
    expect(all.length).toBe(2);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const filtered = await listCashMovements(ctx, { from: future });
    expect(filtered.length).toBe(0);
  });

  it("RN06 — userId/tenantId vêm do contexto, não do input", async () => {
    const mv = await registerCashMovement(ctx, {
      amountCents: 500,
      description: "Teste sessão",
      type: "entrada",
    });
    expect(mv.userId).toBe(ctx.userId);
  });
});
