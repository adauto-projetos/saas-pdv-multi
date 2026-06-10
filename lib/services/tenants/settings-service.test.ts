// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_AUTH,
  seedTenant,
} from "@/db/__tests__/seed";
import type { AuthContext } from "@/types/product";

import { getDefaultMarkup, updateDefaultMarkup } from "./settings-service";

const suite = HAS_AUTH ? describe : describe.skip;

suite("settings-service (integração, RF05)", () => {
  let user = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let tenantId = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja Settings", "30.00");
    ctx = { userId: user.userId, tenantId };
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (user.userId) await deleteTestUser(user.userId);
  });

  it("T09 — atualiza e lê a margem padrão da loja", async () => {
    const updated = await updateDefaultMarkup(ctx, 25);
    expect(updated.defaultMarkupPercent).toBe(25);

    const read = await getDefaultMarkup(ctx);
    expect(read.defaultMarkupPercent).toBe(25);
  });
});
