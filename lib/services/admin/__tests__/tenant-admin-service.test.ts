// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  HAS_DB,
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  seedTenant,
} from "@/db/__tests__/seed";
import { subscriptionLog, tenants } from "@/db/schema";
import { addCalendarMonths } from "@/lib/format/calendar-month";

/**
 * Contract tests das funções transacionais do super-admin (0020F/RF01).
 * Owner-bypass (sem RLS): semeia o tenant e lê de volta via owner `db`. DB-touching
 * — pulado sem DATABASE_URL.
 */
const suite = HAS_DB ? describe : describe.skip;

suite("tenant-admin-service — funções transacionais (RF01)", () => {
  const created: { userId: string; tenantId: string }[] = [];

  async function make(name = "Loja Admin Teste") {
    const { userId } = await createTestUser();
    const tenantId = await seedTenant(userId, name);
    created.push({ userId, tenantId });
    return { userId, tenantId };
  }

  async function logsFor(tenantId: string) {
    return db
      .select()
      .from(subscriptionLog)
      .where(eq(subscriptionLog.tenantId, tenantId));
  }

  async function tenantRow(tenantId: string) {
    const [row] = await db
      .select({ validUntil: tenants.validUntil, suspendedAt: tenants.suspendedAt })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return row;
  }

  afterEach(async () => {
    for (const { tenantId, userId } of created.reverse()) {
      await cleanupTenant(tenantId);
      await deleteTestUser(userId);
    }
    created.length = 0;
  });

  it("admin-RF01-getname — getTenantName retorna { name } e null p/ uuid inexistente", async () => {
    const { tenantId } = await make("Loja Nome");
    const { getTenantName } = await import("../tenant-admin-service");

    const found = await getTenantName(tenantId);
    expect(found).toEqual({ name: "Loja Nome" });

    const missing = await getTenantName("00000000-0000-0000-0000-000000000000");
    expect(missing).toBeNull();
  });

  it("admin-RF01-release — releaseSubscription renova base+3 meses, loga renewed, limpa suspended_at", async () => {
    const { userId, tenantId } = await make();
    // Estado inicial: vencida e suspensa (base = agora; suspended_at deve limpar).
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db
      .update(tenants)
      .set({ validUntil: past, suspendedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    const before = new Date();
    const { releaseSubscription } = await import("../tenant-admin-service");
    const { newValidUntil } = await releaseSubscription(tenantId, 3, userId);

    // base = agora (validUntil vencida) → newValidUntil ≈ agora + 3 meses de calendário.
    const expectedLow = addCalendarMonths(before, 3);
    expect(newValidUntil.getTime()).toBeGreaterThanOrEqual(expectedLow.getTime() - 5000);

    const row = await tenantRow(tenantId);
    expect(row.validUntil?.getTime()).toBe(newValidUntil.getTime());
    expect(row.suspendedAt).toBeNull();

    const logs = await logsFor(tenantId);
    const renewed = logs.filter((l) => l.action === "renewed");
    expect(renewed).toHaveLength(1);
    expect(renewed[0].monthsReleased).toBe(3);
    expect(renewed[0].byUserId).toBe(userId);
    expect(renewed[0].validUntilAfter?.getTime()).toBe(newValidUntil.getTime());
  });

  it("admin-RF01-release — acumula a partir da validade vigente quando futura", async () => {
    const { userId, tenantId } = await make();
    const future = addCalendarMonths(new Date(), 2);
    await db.update(tenants).set({ validUntil: future }).where(eq(tenants.id, tenantId));

    const { releaseSubscription } = await import("../tenant-admin-service");
    const { newValidUntil } = await releaseSubscription(tenantId, 1, userId);

    // base = future (ainda válida) → future + 1 mês.
    expect(newValidUntil.getTime()).toBe(addCalendarMonths(future, 1).getTime());
  });

  it("admin-RF01-suspend — suspendTenant seta suspended_at e loga suspended", async () => {
    const { userId, tenantId } = await make();
    const { suspendTenant } = await import("../tenant-admin-service");
    await suspendTenant(tenantId, userId);

    const row = await tenantRow(tenantId);
    expect(row.suspendedAt).not.toBeNull();

    const logs = await logsFor(tenantId);
    const suspended = logs.filter((l) => l.action === "suspended");
    expect(suspended).toHaveLength(1);
    expect(suspended[0].byUserId).toBe(userId);
  });

  it("admin-RF01-unsuspend — releaseFromSuspension limpa suspended_at e loga released", async () => {
    const { userId, tenantId } = await make();
    const { suspendTenant, releaseFromSuspension } = await import(
      "../tenant-admin-service"
    );
    await suspendTenant(tenantId, userId);
    await releaseFromSuspension(tenantId, userId);

    const row = await tenantRow(tenantId);
    expect(row.suspendedAt).toBeNull();

    const logs = await logsFor(tenantId);
    expect(logs.filter((l) => l.action === "released")).toHaveLength(1);
  });
});
