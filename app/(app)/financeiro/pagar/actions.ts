"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext } from "@/lib/auth";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  createPayable,
  listPayables,
  recordPayablePayment,
} from "@/lib/services/finance/payable-service";
import {
  createPayableSchema,
  payableQuerySchema,
  recordPaymentSchema,
} from "@/lib/validation/finance";
import type { PayableDto } from "@/types/finance";

function firstError(message: string | undefined): string {
  return message ?? "Dados inválidos.";
}

export async function createPayableAction(
  input: unknown,
): Promise<ActionResult<PayableDto>> {
  const parsed = createPayableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    const payable = await createPayable(ctx, parsed.data);
    revalidatePath("/financeiro/pagar");
    return { ok: true, data: payable };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listPayablesAction(
  input: unknown,
): Promise<ActionResult<PayableDto[]>> {
  const parsed = payableQuerySchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Filtro inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await listPayables(ctx, parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function recordPayablePaymentAction(
  input: unknown,
): Promise<ActionResult<PayableDto>> {
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    const payable = await recordPayablePayment(ctx, parsed.data);
    revalidatePath("/financeiro/pagar");
    return { ok: true, data: payable };
  } catch (error) {
    return toActionError(error);
  }
}
