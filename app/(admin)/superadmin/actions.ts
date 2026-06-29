"use server";

import { revalidatePath } from "next/cache";

import { requireFounder } from "@/lib/auth/admin";
import type { SubscriptionLogEntry } from "@/lib/services/admin/tenant-admin-service";
import {
  deleteTenantById,
  getTenantName,
  getTenantSubscriptionHistory,
  releaseFromSuspension,
  releaseSubscription,
  suspendTenant,
} from "@/lib/services/admin/tenant-admin-service";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  setMaxOperators,
  setMonthlyPlanPriceCents,
} from "@/lib/services/platform/settings-repository";
import { maxOperatorsSchema, planPriceSchema } from "@/lib/validation/platform";
import { releaseMonthsSchema } from "@/lib/validation/subscription";

export async function releaseSubscriptionAction(
  tenantId: string,
  months: number,
): Promise<ActionResult<{ newValidUntil: Date }>> {
  // RN01 (defesa em profundidade): revalida no servidor antes de qualquer escrita.
  const parsed = releaseMonthsSchema.safeParse({ months });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Quantidade de meses inválida" };
  }
  try {
    const { userId } = await requireFounder();
    const { newValidUntil } = await releaseSubscription(
      tenantId,
      parsed.data.months,
      userId,
    );
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
    await suspendTenant(tenantId, userId);
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
    await releaseFromSuspension(tenantId, userId);
    revalidatePath("/superadmin");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteTenantAction(
  tenantId: string,
  confirmationName: string,
): Promise<ActionResult<{ deletedUsers: number }>> {
  try {
    await requireFounder();

    const tenant = await getTenantName(tenantId);
    if (!tenant) return { ok: false, error: "Loja não encontrada" };

    // Confirmação: o nome digitado precisa bater exatamente com o da loja.
    // Defesa contra exclusão acidental (e contra chamada da action sem o diálogo).
    if (confirmationName.trim() !== tenant.name) {
      return { ok: false, error: "O nome digitado não confere com o da loja." };
    }

    const { deletedUserIds } = await deleteTenantById(tenantId);

    revalidatePath("/superadmin");
    return { ok: true, data: { deletedUsers: deletedUserIds.length } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updatePlanPriceAction(
  priceCents: number,
): Promise<ActionResult<{ priceCents: number }>> {
  // RN: revalida no servidor (defesa em profundidade) além do MoneyInput.
  const parsed = planPriceSchema.safeParse({ priceCents });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Preço inválido" };
  }
  try {
    const { userId } = await requireFounder();
    await setMonthlyPlanPriceCents(parsed.data.priceCents, userId);
    revalidatePath("/superadmin");
    return { ok: true, data: { priceCents: parsed.data.priceCents } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateMaxOperatorsAction(
  maxOperators: number,
): Promise<ActionResult<{ maxOperators: number }>> {
  // RN: revalida no servidor (defesa em profundidade) — 0014F/SF03 RF02.
  const parsed = maxOperatorsSchema.safeParse({ maxOperators });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Limite inválido",
    };
  }
  try {
    const { userId } = await requireFounder();
    await setMaxOperators(parsed.data.maxOperators, userId);
    revalidatePath("/superadmin");
    return { ok: true, data: { maxOperators: parsed.data.maxOperators } };
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
