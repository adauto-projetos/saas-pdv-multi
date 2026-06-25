"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext } from "@/lib/auth";
import { requireActiveTenant } from "@/lib/auth/tenant-guard";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  getCashBalance,
  listCashMovements,
  registerCashMovement,
} from "@/lib/services/finance/cash-service";
import { cashFilterSchema, cashMovementSchema } from "@/lib/validation/finance";
import type { CashBalanceDto, CashMovementDto } from "@/types/finance";

function firstError(message: string | undefined): string {
  return message ?? "Dados inválidos.";
}

export async function registerCashInflowAction(
  input: unknown,
): Promise<ActionResult<CashMovementDto>> {
  const parsed = cashMovementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    const movement = await registerCashMovement(ctx, {
      ...parsed.data,
      type: "entrada",
    });
    revalidatePath("/financeiro/caixa");
    return { ok: true, data: movement };
  } catch (error) {
    return toActionError(error);
  }
}

export async function registerCashOutflowAction(
  input: unknown,
): Promise<ActionResult<CashMovementDto>> {
  const parsed = cashMovementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    const movement = await registerCashMovement(ctx, {
      ...parsed.data,
      type: "saida",
    });
    revalidatePath("/financeiro/caixa");
    return { ok: true, data: movement };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getCashBalanceAction(): Promise<
  ActionResult<CashBalanceDto>
> {
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await getCashBalance(ctx) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listCashMovementsAction(
  input: unknown,
): Promise<ActionResult<CashMovementDto[]>> {
  const parsed = cashFilterSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Filtro inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await listCashMovements(ctx, parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}
