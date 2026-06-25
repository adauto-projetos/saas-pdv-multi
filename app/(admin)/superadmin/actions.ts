"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { requireFounder } from "@/lib/auth/admin";
import type { SubscriptionLogEntry } from "@/lib/services/admin/tenant-admin-service";
import { getTenantSubscriptionHistory } from "@/lib/services/admin/tenant-admin-service";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import { insertSubscriptionLog, selectTenantById } from "@/lib/services/subscriptions/repository";

export async function releaseSubscriptionAction(
  tenantId: string,
): Promise<ActionResult<{ newValidUntil: Date }>> {
  try {
    const { userId } = await requireFounder();

    const tenant = await selectTenantById(tenantId);
    if (!tenant) return { ok: false, error: "Loja não encontrada" };

    const now = new Date();
    const base =
      tenant.validUntil && tenant.validUntil > now ? tenant.validUntil : now;
    const newValidUntil = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    const validUntilBefore = tenant.validUntil;

    await db.transaction(async (tx) => {
      await tx
        .update(tenants)
        .set({ validUntil: newValidUntil, suspendedAt: null })
        .where(eq(tenants.id, tenantId));
      await insertSubscriptionLog(tx, {
        tenantId,
        action: "renewed",
        validUntilBefore,
        validUntilAfter: newValidUntil,
        byUserId: userId,
      });
    });

    revalidatePath("/superadmin");
    return { ok: true, data: { newValidUntil } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function suspendTenantAction(
  tenantId: string,
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireFounder();

    const tenant = await selectTenantById(tenantId);
    if (!tenant) return { ok: false, error: "Loja não encontrada" };

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(tenants)
        .set({ suspendedAt: now })
        .where(eq(tenants.id, tenantId));
      await insertSubscriptionLog(tx, {
        tenantId,
        action: "suspended",
        // Snapshot do valid_until no momento da suspensão (auditoria) — a suspensão
        // não altera valid_until, mas o log preserva o valor vigente.
        validUntilBefore: tenant.validUntil,
        validUntilAfter: tenant.validUntil,
        byUserId: userId,
      });
    });

    revalidatePath("/superadmin");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function releaseFromSuspensionAction(
  tenantId: string,
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireFounder();

    const tenant = await selectTenantById(tenantId);
    if (!tenant) return { ok: false, error: "Loja não encontrada" };

    await db.transaction(async (tx) => {
      await tx
        .update(tenants)
        .set({ suspendedAt: null })
        .where(eq(tenants.id, tenantId));
      await insertSubscriptionLog(tx, {
        tenantId,
        action: "released",
        validUntilBefore: tenant.validUntil,
        validUntilAfter: tenant.validUntil,
        byUserId: userId,
      });
    });

    revalidatePath("/superadmin");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getTenantHistoryAction(
  tenantId: string,
): Promise<ActionResult<SubscriptionLogEntry[]>> {
  try {
    await requireFounder();
    const entries = await getTenantSubscriptionHistory(tenantId);
    return { ok: true, data: entries };
  } catch (error) {
    return toActionError(error);
  }
}
