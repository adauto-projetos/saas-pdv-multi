// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withUserRls } from "@/db/rls";
import { userPermissions } from "@/db/schema";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedOperator,
  seedTenant,
} from "./seed";

const suite = HAS_DB ? describe : describe.skip;

suite("user_permissions RLS isolation (RNF01)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let tenantA = "";
  let tenantB = "";
  let opA = { userId: "", email: "" };
  let opB = { userId: "", email: "" };

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A Perm RLS");
    tenantB = await seedTenant(userB.userId, "Loja B Perm RLS");
    // Operador em cada loja com permissões.
    opA = await seedOperator(tenantA, { permissions: ["vendas", "comanda"] });
    opB = await seedOperator(tenantB, { permissions: ["loja", "financeiro"] });
  });

  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    for (const u of [userA, userB, opA, opB]) {
      if (u.userId) await deleteTestUser(u.userId);
    }
  });

  it("rls-RNF01 — owner do tenant A não vê user_permissions do tenant B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(userPermissions),
    );
    const tenantIds = new Set(rows.map((r) => r.tenantId));
    expect(tenantIds.has(tenantB)).toBe(false);
    // Vê as do próprio tenant (as do opA).
    expect(rows.some((r) => r.userId === opA.userId)).toBe(true);
  });

  it("rls-RNF01 — owner do tenant B não vê user_permissions do tenant A", async () => {
    const rows = await withUserRls(userB.userId, (tx) =>
      tx.select().from(userPermissions),
    );
    const tenantIds = new Set(rows.map((r) => r.tenantId));
    expect(tenantIds.has(tenantA)).toBe(false);
    expect(rows.some((r) => r.userId === opB.userId)).toBe(true);
  });
});
