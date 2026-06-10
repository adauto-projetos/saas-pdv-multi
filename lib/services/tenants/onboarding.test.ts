// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { HAS_DB } from "@/db/__tests__/seed";
import { tenants, users } from "@/db/schema";

import {
  createUserWithTenant,
  getUserByEmail,
  getUserTenantId,
} from "./onboarding";

const suite = HAS_DB ? describe : describe.skip;

suite("onboarding (integração)", () => {
  let userId = "";
  let tenantId = "";

  afterEach(async () => {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
    if (userId) await db.delete(users).where(eq(users.id, userId));
    userId = "";
    tenantId = "";
  });

  it("cria usuário + loja + vínculo e resolve o tenant", async () => {
    const email = `onb+${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    const result = await createUserWithTenant(email, "hash-x", "Loja Onboarding");
    userId = result.userId;
    tenantId = result.tenantId;

    expect(result.tenantId).toBeTruthy();

    const found = await getUserByEmail(email.toUpperCase());
    expect(found?.id).toBe(result.userId);

    expect(await getUserTenantId(result.userId)).toBe(result.tenantId);
  });
});
