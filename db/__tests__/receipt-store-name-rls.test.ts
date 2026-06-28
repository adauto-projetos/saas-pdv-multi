// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withUserRls } from "@/db/rls";
import { tenants } from "@/db/schema";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedTenant,
} from "./seed";

const suite = HAS_DB ? describe : describe.skip;

// O `storeName` do recibo (RN02) é lido de `tenants.name` sob `withUserRls`. Estes
// testes provam que a leitura é escopada ao tenant da sessão: a loja A vê o próprio
// nome e NUNCA o nome da loja B (RLS `tenant_self_read`).
suite("receipt storeName scoping (RN02)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let tenantA = "";
  let tenantB = "";

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A");
    tenantB = await seedTenant(userB.userId, "Loja B");
  });

  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    if (userA.userId) await deleteTestUser(userA.userId);
    if (userB.userId) await deleteTestUser(userB.userId);
  });

  it("T03 — usuário A lê o nome da própria loja", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantA)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Loja A");
  });

  it("T03b — usuário A não enxerga o nome da loja B (sem vazamento de storeName)", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantB)),
    );
    expect(rows).toHaveLength(0);
  });
});
