// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withUserRls } from "@/db/rls";
import {
  cashMovements,
  customers,
  payables,
  receivables,
} from "@/db/schema";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedCashMovement,
  seedCustomer,
  seedPayable,
  seedReceivable,
  seedTenant,
} from "./seed";

// Requires a real Postgres connection (DATABASE_URL). Skipped without it.
const suite = HAS_DB ? describe : describe.skip;

suite("finance tables RLS isolation (RN01)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let tenantA = "";
  let tenantB = "";

  // IDs seeded in tenant B — tenant A must not see them via withUserRls.
  let customerBId = "";
  let receivableBId = "";
  let payableBId = "";
  let cashMovementBId = "";

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A Financeiro");
    tenantB = await seedTenant(userB.userId, "Loja B Financeiro");

    // Seed data in tenant B only.
    customerBId = await seedCustomer(tenantB, "Cliente da Loja B");

    receivableBId = await seedReceivable(tenantB, userB.userId, {
      customerId: customerBId,
      totalCents: 5000,
      origin: "avulsa",
    });

    payableBId = await seedPayable(tenantB, userB.userId, {
      description: "Conta da Loja B",
      totalCents: 3000,
      category: "outros",
    });

    cashMovementBId = await seedCashMovement(tenantB, userB.userId, {
      amountCents: 1000,
      type: "entrada",
      origin: "manual",
    });
  });

  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    if (userA.userId) await deleteTestUser(userA.userId);
    if (userB.userId) await deleteTestUser(userB.userId);
  });

  it("rls-RN01-cust — tenant A não enxerga clientes da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(customers),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(customerBId);
    expect(rows).toHaveLength(0);
  });

  it("rls-RN01-recv — tenant A não enxerga receivables da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(receivables),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(receivableBId);
    expect(rows).toHaveLength(0);
  });

  it("rls-RN01-pay — tenant A não enxerga payables da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(payables),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(payableBId);
    expect(rows).toHaveLength(0);
  });

  it("rls-RN01-cash — tenant A não enxerga cash_movements da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(cashMovements),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(cashMovementBId);
    expect(rows).toHaveLength(0);
  });
});
