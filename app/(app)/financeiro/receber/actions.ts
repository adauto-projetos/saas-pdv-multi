"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext } from "@/lib/auth";
import { requireAnyPermission, requirePermission } from "@/lib/auth/permissions";
import { requireActiveTenant } from "@/lib/auth/tenant-guard";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  createReceivable,
  listReceivables,
  recordReceivablePayment,
} from "@/lib/services/finance/receivable-service";
import {
  createReceivableSchema,
  receivableQuerySchema,
  recordPaymentSchema,
} from "@/lib/validation/finance";
import type { ReceivableDto } from "@/types/finance";

function firstError(message: string | undefined): string {
  return message ?? "Dados inválidos.";
}

export async function createReceivableAction(
  input: unknown,
): Promise<ActionResult<ReceivableDto>> {
  const parsed = createReceivableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    await requirePermission(ctx, "financeiro");
    const receivable = await createReceivable(ctx, parsed.data);
    revalidatePath("/financeiro/receber");
    return { ok: true, data: receivable };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listReceivablesAction(
  input: unknown,
): Promise<ActionResult<ReceivableDto[]>> {
  const parsed = receivableQuerySchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Filtro inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    // O caixa recebe notas no balcão → liberado a "financeiro" OU "caixa".
    await requireAnyPermission(ctx, ["financeiro", "caixa"]);
    return { ok: true, data: await listReceivables(ctx, parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function recordReceivablePaymentAction(
  input: unknown,
): Promise<ActionResult<ReceivableDto>> {
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    // O caixa pode registrar o pagamento de notas (fiado) no balcão.
    await requireAnyPermission(ctx, ["financeiro", "caixa"]);
    const receivable = await recordReceivablePayment(ctx, parsed.data);
    revalidatePath("/financeiro/receber");
    return { ok: true, data: receivable };
  } catch (error) {
    return toActionError(error);
  }
}
