"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext } from "@/lib/auth";
import { requireActiveTenant } from "@/lib/auth/tenant-guard";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  closeCashSession,
  getOpenSession,
  listSessions,
  openCashSession,
} from "@/lib/services/profit/cash-session-service";
import { getProfitByPeriod } from "@/lib/services/profit/profit-service";
import {
  closeSessionSchema,
  openSessionSchema,
  profitFilterSchema,
} from "@/lib/validation/profit";
import type { CashSessionDto, ProfitDto } from "@/types/profit";

function firstError(message: string | undefined): string {
  return message ?? "Dados inválidos.";
}

/** RF02/RF03 — lucro do período (padrão hoje). */
export async function getProfitAction(
  input?: unknown,
): Promise<ActionResult<ProfitDto>> {
  const parsed = profitFilterSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Filtro inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await getProfitByPeriod(ctx, parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF04 — abre o turno; ConflictError se já há um caixa aberto (RN09). */
export async function openCashSessionAction(
  input: unknown,
): Promise<ActionResult<CashSessionDto>> {
  const parsed = openSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    const session = await openCashSession(ctx, parsed.data);
    revalidatePath("/lucro");
    revalidatePath("/financeiro/caixa");
    return { ok: true, data: session };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF06/RF07 — fecha o turno (esperado/contado/divergência). */
export async function closeCashSessionAction(
  input: unknown,
): Promise<ActionResult<CashSessionDto>> {
  const parsed = closeSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    const session = await closeCashSession(ctx, parsed.data);
    revalidatePath("/lucro");
    revalidatePath("/financeiro/caixa");
    return { ok: true, data: session };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF08 — turno aberto (ou null) para a tela de caixa. */
export async function getOpenSessionAction(): Promise<
  ActionResult<CashSessionDto | null>
> {
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await getOpenSession(ctx) };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF07 — histórico de sessões filtrável por período. */
export async function listSessionsAction(
  input: unknown,
): Promise<ActionResult<CashSessionDto[]>> {
  const parsed = profitFilterSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Filtro inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await listSessions(ctx, parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}
