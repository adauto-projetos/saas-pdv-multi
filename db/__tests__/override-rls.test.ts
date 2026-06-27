// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { withUserRls } from "@/db/rls";
import { overrideLog } from "@/db/schema";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedOperator,
  seedTenant,
} from "./seed";

const suite = HAS_DB ? describe : describe.skip;

suite("override_log RLS isolation (RNF01)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let tenantA = "";
  let tenantB = "";
  let opB = { userId: "", email: "" };

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A Override RLS");
    tenantB = await seedTenant(userB.userId, "Loja B Override RLS");
    opB = await seedOperator(tenantB, { permissions: ["vendas"] });
    // Linha de override no tenant B (inserida via owner db, bypassa RLS).
    await db.insert(overrideLog).values({
      tenantId: tenantB,
      actorUserId: opB.userId,
      authorizerUserId: userB.userId,
      actionCode: "cancelar_comanda",
      targetRef: "comanda-b",
    });
  });

  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    for (const u of [userA, userB, opB]) {
      if (u.userId) await deleteTestUser(u.userId);
    }
  });

  it("rls-RNF01 — tenant A não vê override_log do tenant B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(overrideLog),
    );
    const tenantIds = new Set(rows.map((r) => r.tenantId));
    expect(tenantIds.has(tenantB)).toBe(false);
  });

  it("rls-RNF01 — tenant B vê o próprio override_log", async () => {
    const rows = await withUserRls(userB.userId, (tx) =>
      tx.select().from(overrideLog),
    );
    expect(rows.some((r) => r.targetRef === "comanda-b")).toBe(true);
  });
});
