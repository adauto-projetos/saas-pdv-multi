// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withUserRls } from "@/db/rls";
import { comandaItems, comandas } from "@/db/schema";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedComanda,
  seedComandaItem,
  seedProduct,
  seedTenant,
} from "./seed";

// Requires a real Postgres connection (DATABASE_URL). Skipped without it.
const suite = HAS_DB ? describe : describe.skip;

suite("comanda/mesa RLS isolation (RN01)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let tenantA = "";
  let tenantB = "";

  // IDs seeded in tenant B — tenant A must not see them via withUserRls.
  let comandaBId = "";
  let comandaItemBId = "";

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A Comanda RLS");
    tenantB = await seedTenant(userB.userId, "Loja B Comanda RLS");

    // Seed comanda in tenant B only.
    const comandaB = await seedComanda(tenantB, userB.userId, {
      label: "Mesa Loja B",
      status: "aberta",
    });
    comandaBId = comandaB.id;

    // Seed product + comanda_item in tenant B.
    const productBId = await seedProduct(tenantB, {
      name: "Produto Loja B",
      salePriceCents: 1000,
      stockQuantity: 10,
    });
    const itemB = await seedComandaItem(tenantB, comandaBId, productBId, {
      quantity: 2,
    });
    comandaItemBId = itemB.id;
  });

  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    if (userA.userId) await deleteTestUser(userA.userId);
    if (userB.userId) await deleteTestUser(userB.userId);
  });

  it("rls-RN01-comanda-isolation — tenant A não vê comandas da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(comandas),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(comandaBId);
    expect(rows).toHaveLength(0);
  });

  it("rls-RN01-comanda-items-isolation — tenant A não vê comanda_items da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(comandaItems),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(comandaItemBId);
    expect(rows).toHaveLength(0);
  });
});
