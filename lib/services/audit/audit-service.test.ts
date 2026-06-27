// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { cashSessions, comandas, overrideLog, sales } from "@/db/schema";
import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedOperator,
  seedTenant,
} from "@/db/__tests__/seed";

import { getAuditByPeriod } from "./audit-service";

const suite = HAS_DB ? describe : describe.skip;

async function insertSale(tenantId: string, userId: string, totalCents: number) {
  await db
    .insert(sales)
    .values({ tenantId, userId, totalCents, paymentMethod: "dinheiro" });
}

suite("getAuditByPeriod — agregação por operador (SF04)", () => {
  let owner = { userId: "", email: "" };
  let tenantId = "";
  let op = { userId: "", email: "" };
  let deadOp = { userId: "", email: "" };

  beforeAll(async () => {
    owner = await createTestUser();
    tenantId = await seedTenant(owner.userId, "Loja Auditoria");
    op = await seedOperator(tenantId, { permissions: ["vendas"], name: "Operador Um" });
    deadOp = await seedOperator(tenantId, {
      permissions: ["vendas"],
      name: "Operador Inativo",
      isActive: false,
    });

    // Vendas: 2 do operador (1000 + 2000), 1 do owner (500), 1 do desativado (700).
    await insertSale(tenantId, op.userId, 1000);
    await insertSale(tenantId, op.userId, 2000);
    await insertSale(tenantId, owner.userId, 500);
    await insertSale(tenantId, deadOp.userId, 700);

    // Caixa aberto pelo operador.
    await db.insert(cashSessions).values({
      tenantId,
      openingBalanceCents: 0,
      openedBy: op.userId,
      status: "aberta",
    });

    // Comanda cancelada pelo operador.
    await db.insert(comandas).values({
      tenantId,
      openedBy: op.userId,
      label: "Mesa X",
      status: "cancelada",
      closedBy: op.userId,
      closedAt: new Date(),
    });
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    for (const u of [owner, op, deadOp]) {
      if (u.userId) await deleteTestUser(u.userId);
    }
  });

  const ctx = () => ({ userId: owner.userId, tenantId });

  it("agrega vendas por operador e bate com as linhas brutas (RF01)", async () => {
    const report = await getAuditByPeriod(ctx(), {});
    const opRow = report.operators.find((o) => o.userId === op.userId);
    expect(opRow?.salesCount).toBe(2);
    expect(opRow?.salesTotalCents).toBe(3000);
    expect(opRow?.cashOpened).toBe(1);
    expect(opRow?.comandasCancelled).toBe(1);
  });

  it("atribui a venda do owner ao owner, distinta do operador (RN02)", async () => {
    const report = await getAuditByPeriod(ctx(), {});
    const ownerRow = report.operators.find((o) => o.userId === owner.userId);
    expect(ownerRow?.isOwner).toBe(true);
    expect(ownerRow?.salesCount).toBe(1);
    expect(ownerRow?.salesTotalCents).toBe(500);
  });

  it("operador desativado ainda aparece nomeado (RF04)", async () => {
    const report = await getAuditByPeriod(ctx(), {});
    const dead = report.operators.find((o) => o.userId === deadOp.userId);
    expect(dead).toBeDefined();
    expect(dead?.name).toBe("Operador Inativo");
    expect(dead?.isActive).toBe(false);
    expect(dead?.salesCount).toBe(1);
  });

  it("filtra por operador quando operatorId é dado (RF02)", async () => {
    const report = await getAuditByPeriod(ctx(), { operatorId: op.userId });
    expect(report.operators).toHaveLength(1);
    expect(report.operators[0].userId).toBe(op.userId);
  });

  it("seção de overrides presente (tabela existe) e lista as linhas (RF05)", async () => {
    await db.insert(overrideLog).values({
      tenantId,
      actorUserId: op.userId,
      authorizerUserId: owner.userId,
      actionCode: "cancelar_comanda",
      targetRef: "mesa-x",
    });
    const report = await getAuditByPeriod(ctx(), {});
    expect(report.overrides).not.toBeNull();
    expect(Array.isArray(report.overrides)).toBe(true);
    expect(
      report.overrides?.some((o) => o.actionCode === "cancelar_comanda"),
    ).toBe(true);
  });
});
