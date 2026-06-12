// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { withUserRls } from "@/db/rls";
import { cashSessions, saleItems, sales } from "@/db/schema";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedCashSession,
  seedProduct,
  seedTenant,
} from "./seed";

// Requires a real Postgres connection (DATABASE_URL). Skipped without it.
const suite = HAS_DB ? describe : describe.skip;

suite("lucro/fechamento RLS isolation (RN01)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let tenantA = "";
  let tenantB = "";

  // IDs seeded in tenant B — tenant A must not see them via withUserRls.
  let cashSessionBId = "";
  let saleItemBId = "";

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A Lucro");
    tenantB = await seedTenant(userB.userId, "Loja B Lucro");

    // Seed cash session in tenant B only.
    cashSessionBId = await seedCashSession(tenantB, userB.userId, {
      openingBalanceCents: 5000,
      status: "aberta",
    });

    // Seed sale + sale_item in tenant B via owner db (bypasses RLS).
    const productBId = await seedProduct(tenantB, {
      name: "Produto Loja B",
      salePriceCents: 1000,
      costCents: 400,
    });

    const [saleBRow] = await db
      .insert(sales)
      .values({
        tenantId: tenantB,
        userId: userB.userId,
        totalCents: 1000,
        paymentMethod: "dinheiro",
      })
      .returning({ id: sales.id });

    const [saleItemBRow] = await db
      .insert(saleItems)
      .values({
        saleId: saleBRow.id,
        tenantId: tenantB,
        productId: productBId,
        nameSnapshot: "Produto Loja B",
        unit: "un",
        unitPriceCents: 1000,
        quantity: "1.000",
        subtotalCents: 1000,
        costCentsSnapshot: 400,
      })
      .returning({ id: saleItems.id });

    saleItemBId = saleItemBRow.id;
  });

  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    if (userA.userId) await deleteTestUser(userA.userId);
    if (userB.userId) await deleteTestUser(userB.userId);
  });

  it("rls-RN01-session-isolation — tenant A não enxerga cash_sessions da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(cashSessions),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(cashSessionBId);
    expect(rows).toHaveLength(0);
  });

  it("rls-RN01-profit-isolation — tenant A não enxerga sale_items da loja B (agregação de lucro isolada)", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(saleItems),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(saleItemBId);
    expect(rows).toHaveLength(0);
  });
});
