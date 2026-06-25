// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { HAS_DB, cleanupTenant, createTestUser, deleteTestUser, seedTenant } from "@/db/__tests__/seed";
import { subscriptionLog, tenants } from "@/db/schema";

const suite = HAS_DB ? describe : describe.skip;

async function seedSubscription(
  tenantId: string,
  action: "trial_started" | "renewed" | "suspended" | "released",
  validUntil?: Date | null,
) {
  await db.insert(subscriptionLog).values({
    tenantId,
    action,
    validUntilBefore: null,
    validUntilAfter: validUntil ?? null,
    byUserId: null,
  });
}

suite("tenant-admin-service (integração)", () => {
  const created: { userId: string; tenantId: string }[] = [];

  async function make(name = "Loja Teste") {
    const { userId } = await createTestUser();
    const tenantId = await seedTenant(userId, name);
    created.push({ userId, tenantId });
    return { userId, tenantId };
  }

  afterEach(async () => {
    for (const { tenantId, userId } of created.reverse()) {
      await cleanupTenant(tenantId);
      await deleteTestUser(userId);
    }
    created.length = 0;
  });

  it("T10 — listAllTenantsWithStats retorna todos os tenants cross-tenant", async () => {
    const { tenantId: t1 } = await make("Loja A");
    const { tenantId: t2 } = await make("Loja B");

    const { listAllTenantsWithStats } = await import("./tenant-admin-service");
    const result = await listAllTenantsWithStats();
    const ids = result.map((r) => r.id);
    expect(ids).toContain(t1);
    expect(ids).toContain(t2);
  });

  it("T11 — status derivado de suspended_at IS NOT NULL = travada", async () => {
    const { tenantId } = await make("Loja Suspensa");
    await db.update(tenants).set({ suspendedAt: new Date() }).where(eq(tenants.id, tenantId));

    const { listAllTenantsWithStats } = await import("./tenant-admin-service");
    const result = await listAllTenantsWithStats();
    const row = result.find((r) => r.id === tenantId);
    expect(row?.status).toBe("travada");
  });

  it("T13 — getExpiringTenants inclui tenant com valid_until em 2 dias", async () => {
    const { tenantId } = await make("Loja Expirando");
    const in2Days = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await db.update(tenants).set({ validUntil: in2Days }).where(eq(tenants.id, tenantId));

    const { getExpiringTenants } = await import("./tenant-admin-service");
    const result = await getExpiringTenants(3);
    expect(result.map((r) => r.id)).toContain(tenantId);
  });

  it("T14 — getExpiringTenants exclui tenant com valid_until em 5 dias", async () => {
    const { tenantId } = await make("Loja Futura");
    const in5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await db.update(tenants).set({ validUntil: in5Days }).where(eq(tenants.id, tenantId));

    const { getExpiringTenants } = await import("./tenant-admin-service");
    const result = await getExpiringTenants(3);
    expect(result.map((r) => r.id)).not.toContain(tenantId);
  });

  it("T15 — getExpiringTenants exclui tenant suspenso mesmo com valid_until próximo", async () => {
    const { tenantId } = await make("Loja Suspensa Expirando");
    const in1Day = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    await db
      .update(tenants)
      .set({ validUntil: in1Day, suspendedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    const { getExpiringTenants } = await import("./tenant-admin-service");
    const result = await getExpiringTenants(3);
    expect(result.map((r) => r.id)).not.toContain(tenantId);
  });

  it("T16 — getExpiringTenants ordena por valid_until ASC", async () => {
    const { tenantId: t1 } = await make("Loja Tarde");
    const { tenantId: t2 } = await make("Loja Cedo");
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 - 60000);
    const in1Day = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    await db.update(tenants).set({ validUntil: in3Days }).where(eq(tenants.id, t1));
    await db.update(tenants).set({ validUntil: in1Day }).where(eq(tenants.id, t2));

    const { getExpiringTenants } = await import("./tenant-admin-service");
    const result = await getExpiringTenants(3);
    const filtered = result.filter((r) => r.id === t1 || r.id === t2);
    expect(filtered.length).toBe(2);
    expect(filtered[0].validUntil.getTime()).toBeLessThanOrEqual(
      filtered[1].validUntil.getTime(),
    );
  });

  it("T18 — listAllTenantsWithStats retorna revenueCents=0 sem vendas", async () => {
    const { tenantId } = await make("Loja Sem Vendas");
    const { listAllTenantsWithStats } = await import("./tenant-admin-service");
    const result = await listAllTenantsWithStats();
    const row = result.find((r) => r.id === tenantId);
    expect(row?.revenueCents).toBe(0);
  });

  it("T19 — listAllTenantsWithStats retorna lastActivityAt=null para loja nova", async () => {
    const { tenantId } = await make("Loja Nova");
    const { listAllTenantsWithStats } = await import("./tenant-admin-service");
    const result = await listAllTenantsWithStats();
    const row = result.find((r) => r.id === tenantId);
    expect(row?.lastActivityAt).toBeNull();
  });

  it("T44 — getTenantSubscriptionHistory ordena por at DESC", async () => {
    const { tenantId } = await make("Loja Histórico");
    await seedSubscription(tenantId, "trial_started");
    await new Promise((r) => setTimeout(r, 5));
    await seedSubscription(tenantId, "renewed");
    await new Promise((r) => setTimeout(r, 5));
    await seedSubscription(tenantId, "suspended");

    const { getTenantSubscriptionHistory } = await import("./tenant-admin-service");
    const result = await getTenantSubscriptionHistory(tenantId);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0].at.getTime()).toBeGreaterThanOrEqual(result[1].at.getTime());
  });
});
