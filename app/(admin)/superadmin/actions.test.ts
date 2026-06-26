// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { HAS_DB, cleanupTenant, createTestUser, deleteTestUser, seedTenant } from "@/db/__tests__/seed";
import { subscriptionLog, tenants, users } from "@/db/schema";
import { addCalendarMonths } from "@/lib/format/calendar-month";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getAuthUser: vi.fn() }));

import { getAuthUser } from "@/lib/auth/session";

const mockedGetAuthUser = vi.mocked(getAuthUser);

const suite = HAS_DB ? describe : describe.skip;

suite("admin billing actions (integração)", () => {
  const created: { userId: string; tenantId: string }[] = [];

  async function makeFounder() {
    const { userId, email } = await createTestUser();
    await db.update(users).set({ isFounder: true }).where(eq(users.id, userId));
    mockedGetAuthUser.mockResolvedValue({ id: userId });
    return { userId, email };
  }

  async function makeTenant(userId: string, name = "Loja Teste") {
    const tenantId = await seedTenant(userId, name);
    created.push({ userId, tenantId });
    return tenantId;
  }

  afterEach(async () => {
    vi.resetAllMocks();
    for (const { tenantId, userId } of created.reverse()) {
      if (tenantId) await cleanupTenant(tenantId);
      if (userId) await deleteTestUser(userId);
    }
    created.length = 0;
  });

  it("T24/T59 — releaseSubscriptionAction acumula a partir de valid_until futuro (RF03/RN03)", async () => {
    const { userId } = await makeFounder();
    created.push({ userId, tenantId: "" });
    const tenantId = await makeTenant(userId);
    created[created.length - 1].tenantId = tenantId;

    const future = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    await db.update(tenants).set({ validUntil: future }).where(eq(tenants.id, tenantId));

    const { releaseSubscriptionAction } = await import("./actions");
    const result = await releaseSubscriptionAction(tenantId, 2);
    if (!result.ok) throw new Error(result.error);

    const expected = addCalendarMonths(future, 2);
    const diff = Math.abs(result.data.newValidUntil.getTime() - expected.getTime());
    expect(diff).toBeLessThan(5000);
  });

  it("T25/T60 — loja vencida acumula a partir de hoje (RF03/RN03)", async () => {
    const { userId } = await makeFounder();
    const tenantId = await makeTenant(userId);

    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    await db.update(tenants).set({ validUntil: past }).where(eq(tenants.id, tenantId));

    const { releaseSubscriptionAction } = await import("./actions");
    const result = await releaseSubscriptionAction(tenantId, 1);
    if (!result.ok) throw new Error(result.error);

    const expected = addCalendarMonths(new Date(), 1);
    const diff = Math.abs(result.data.newValidUntil.getTime() - expected.getTime());
    expect(diff).toBeLessThan(10000);
  });

  it("T26/T61 — releaseSubscriptionAction atualiza valid_until e zera suspended_at (RF04)", async () => {
    const { userId } = await makeFounder();
    const tenantId = await makeTenant(userId);

    await db
      .update(tenants)
      .set({ suspendedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    const { releaseSubscriptionAction } = await import("./actions");
    const result = await releaseSubscriptionAction(tenantId, 1);
    expect(result.ok).toBe(true);

    const [row] = await db
      .select({ validUntil: tenants.validUntil, suspendedAt: tenants.suspendedAt })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    expect(row?.validUntil).not.toBeNull();
    expect(row?.suspendedAt).toBeNull();
  });

  it("T28/T62/T63 — log grava action=renewed, months_released e validade resultante (RF05)", async () => {
    const { userId } = await makeFounder();
    const tenantId = await makeTenant(userId);

    const { releaseSubscriptionAction } = await import("./actions");
    const result = await releaseSubscriptionAction(tenantId, 3);
    if (!result.ok) throw new Error(result.error);

    const logs = await db
      .select()
      .from(subscriptionLog)
      .where(eq(subscriptionLog.tenantId, tenantId));
    const renewed = logs.find((l) => l.action === "renewed");
    expect(renewed).toBeDefined();
    expect(renewed?.byUserId).toBe(userId);
    expect(renewed?.monthsReleased).toBe(3); // T62
    expect(renewed?.validUntilAfter?.getTime()).toBe(result.data.newValidUntil.getTime()); // T63
  });

  it("T64 — months fora do range é rejeitado no servidor antes de escrever (RN01)", async () => {
    const { userId } = await makeFounder();
    const tenantId = await makeTenant(userId);

    const { releaseSubscriptionAction } = await import("./actions");
    const result = await releaseSubscriptionAction(tenantId, 99);
    expect(result.ok).toBe(false);

    const logs = await db
      .select()
      .from(subscriptionLog)
      .where(eq(subscriptionLog.tenantId, tenantId));
    expect(logs.some((l) => l.action === "renewed")).toBe(false); // nada gravado
  });

  it("T31 — releaseSubscriptionAction rejeita não-autenticado (RNF01)", async () => {
    mockedGetAuthUser.mockResolvedValue(null);
    const { releaseSubscriptionAction } = await import("./actions");
    const result = await releaseSubscriptionAction("any", 1);
    expect(result.ok).toBe(false);
  });

  it("T32/T65 — releaseSubscriptionAction rejeita não-founder (RNF01)", async () => {
    const { userId } = await createTestUser();
    created.push({ userId, tenantId: "" });
    await db.update(users).set({ isFounder: false }).where(eq(users.id, userId));
    mockedGetAuthUser.mockResolvedValue({ id: userId });

    const { releaseSubscriptionAction } = await import("./actions");
    const result = await releaseSubscriptionAction("any", 1);
    expect(result.ok).toBe(false);
  });

  it("T33 — suspendTenantAction seta suspended_at (RF17)", async () => {
    const { userId } = await makeFounder();
    const tenantId = await makeTenant(userId);

    const { suspendTenantAction } = await import("./actions");
    const result = await suspendTenantAction(tenantId);
    expect(result.ok).toBe(true);

    const [row] = await db
      .select({ suspendedAt: tenants.suspendedAt })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    expect(row?.suspendedAt).not.toBeNull();
  });

  it("T34 — suspendTenantAction insere subscription_log action=suspended (RF18)", async () => {
    const { userId } = await makeFounder();
    const tenantId = await makeTenant(userId);

    const { suspendTenantAction } = await import("./actions");
    await suspendTenantAction(tenantId);

    const logs = await db
      .select()
      .from(subscriptionLog)
      .where(eq(subscriptionLog.tenantId, tenantId));
    const suspended = logs.find((l) => l.action === "suspended");
    expect(suspended).toBeDefined();
    expect(suspended?.byUserId).toBe(userId);
  });

  it("T38 — suspendTenantAction força travada mesmo com valid_until futuro (RN02)", async () => {
    const { userId } = await makeFounder();
    const tenantId = await makeTenant(userId);

    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    await db.update(tenants).set({ validUntil: future, suspendedAt: null }).where(eq(tenants.id, tenantId));

    const { suspendTenantAction } = await import("./actions");
    await suspendTenantAction(tenantId);

    const [row] = await db
      .select({ suspendedAt: tenants.suspendedAt })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    expect(row?.suspendedAt).not.toBeNull();
  });

  it("T40 — releaseFromSuspensionAction zera suspended_at (RF20)", async () => {
    const { userId } = await makeFounder();
    const tenantId = await makeTenant(userId);

    await db.update(tenants).set({ suspendedAt: new Date() }).where(eq(tenants.id, tenantId));

    const { releaseFromSuspensionAction } = await import("./actions");
    const result = await releaseFromSuspensionAction(tenantId);
    expect(result.ok).toBe(true);

    const [row] = await db
      .select({ suspendedAt: tenants.suspendedAt })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    expect(row?.suspendedAt).toBeNull();
  });

  it("T41 — releaseFromSuspensionAction não altera valid_until (RF20, RN03)", async () => {
    const { userId } = await makeFounder();
    const tenantId = await makeTenant(userId);

    const original = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db
      .update(tenants)
      .set({ validUntil: original, suspendedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    const { releaseFromSuspensionAction } = await import("./actions");
    await releaseFromSuspensionAction(tenantId);

    const [row] = await db
      .select({ validUntil: tenants.validUntil })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    expect(row?.validUntil?.getTime()).toBe(original.getTime());
  });

  it("T43 — releaseFromSuspensionAction insere subscription_log action=released (RF21)", async () => {
    const { userId } = await makeFounder();
    const tenantId = await makeTenant(userId);

    await db.update(tenants).set({ suspendedAt: new Date() }).where(eq(tenants.id, tenantId));

    const { releaseFromSuspensionAction } = await import("./actions");
    await releaseFromSuspensionAction(tenantId);

    const logs = await db
      .select()
      .from(subscriptionLog)
      .where(eq(subscriptionLog.tenantId, tenantId));
    const released = logs.find((l) => l.action === "released");
    expect(released).toBeDefined();
    expect(released?.byUserId).toBe(userId);
  });

  it("T44 — deleteTenantAction rejeita nome que não confere (confirmação)", async () => {
    const { userId: founderId } = await makeFounder();
    created.push({ userId: founderId, tenantId: "" });
    const { userId: ownerId } = await createTestUser();
    const tenantId = await seedTenant(ownerId, "Loja Excluir A");
    created.push({ userId: ownerId, tenantId });

    const { deleteTenantAction } = await import("./actions");
    const result = await deleteTenantAction(tenantId, "nome errado");
    expect(result.ok).toBe(false);

    const [row] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    expect(row).toBeDefined(); // loja preservada
  });

  it("T45 — deleteTenantAction apaga loja + dono órfão, preserva founder", async () => {
    const { userId: founderId } = await makeFounder();
    created.push({ userId: founderId, tenantId: "" });
    const { userId: ownerId } = await createTestUser();
    const tenantId = await seedTenant(ownerId, "Loja Excluir B");
    created.push({ userId: ownerId, tenantId });

    const { deleteTenantAction } = await import("./actions");
    const result = await deleteTenantAction(tenantId, "Loja Excluir B");
    if (!result.ok) throw new Error(result.error);
    expect(result.data.deletedUsers).toBe(1);

    const [tenantRow] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    expect(tenantRow).toBeUndefined(); // loja apagada

    const [ownerRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);
    expect(ownerRow).toBeUndefined(); // dono órfão apagado

    const [founderRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, founderId))
      .limit(1);
    expect(founderRow).toBeDefined(); // founder preservado
  });

  it("T46 — deleteTenantAction rejeita não-founder", async () => {
    const { userId } = await createTestUser();
    created.push({ userId, tenantId: "" });
    await db.update(users).set({ isFounder: false }).where(eq(users.id, userId));
    mockedGetAuthUser.mockResolvedValue({ id: userId });

    const { deleteTenantAction } = await import("./actions");
    const result = await deleteTenantAction("any", "any");
    expect(result.ok).toBe(false);
  });

  it("T47 — deleteTenantAction não apaga dono vinculado a outra loja", async () => {
    const { userId: founderId } = await makeFounder();
    created.push({ userId: founderId, tenantId: "" });
    const { userId: ownerId } = await createTestUser();
    const tenantA = await seedTenant(ownerId, "Loja Multi A");
    const tenantB = await seedTenant(ownerId, "Loja Multi B");
    created.push({ userId: ownerId, tenantId: tenantA });
    created.push({ userId: "", tenantId: tenantB });

    const { deleteTenantAction } = await import("./actions");
    const result = await deleteTenantAction(tenantA, "Loja Multi A");
    if (!result.ok) throw new Error(result.error);
    expect(result.data.deletedUsers).toBe(0); // ainda pertence à Loja B

    const [ownerRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);
    expect(ownerRow).toBeDefined();
  });

  it("T48 — deleteTenantAction nunca apaga o founder, mesmo dono da loja", async () => {
    const { userId: founderId } = await makeFounder();
    const tenantId = await seedTenant(founderId, "Loja do Founder");
    created.push({ userId: founderId, tenantId });

    const { deleteTenantAction } = await import("./actions");
    const result = await deleteTenantAction(tenantId, "Loja do Founder");
    if (!result.ok) throw new Error(result.error);
    expect(result.data.deletedUsers).toBe(0);

    const [founderRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, founderId))
      .limit(1);
    expect(founderRow).toBeDefined(); // founder preservado mesmo sendo dono
  });
});
