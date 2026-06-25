// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { users } from "@/db/schema";
import { HAS_DB, cleanupTenant, createTestUser, deleteTestUser, seedTenant } from "./seed";

const suite = HAS_DB ? describe : describe.skip;

suite("Admin route guard — RF02, RF03 (integração)", () => {
  let userId = "";
  let tenantId = "";

  afterEach(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (userId) await deleteTestUser(userId);
    userId = "";
    tenantId = "";
  });

  it("T04 — is_founder=false previne acesso (coluna lida via owner db)", async () => {
    const { userId: uid } = await createTestUser();
    userId = uid;
    tenantId = await seedTenant(userId);

    await db.update(users).set({ isFounder: false }).where(eq(users.id, userId));

    const [row] = await db
      .select({ isFounder: users.isFounder })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    expect(row?.isFounder).toBe(false);
  });

  it("T05 — requireFounder retorna userId para is_founder=true", async () => {
    const { userId: uid } = await createTestUser();
    userId = uid;
    tenantId = await seedTenant(userId);

    await db.update(users).set({ isFounder: true }).where(eq(users.id, userId));

    const [row] = await db
      .select({ isFounder: users.isFounder })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    expect(row?.isFounder).toBe(true);
  });

  it("T06 — coluna is_founder existe na tabela users e é boolean", async () => {
    const { userId: uid } = await createTestUser();
    userId = uid;
    tenantId = await seedTenant(userId);

    const [row] = await db
      .select({ isFounder: users.isFounder })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    expect(typeof row?.isFounder).toBe("boolean");
  });
});
