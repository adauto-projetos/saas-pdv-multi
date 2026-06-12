"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext } from "@/lib/auth";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  createCustomer,
  listCustomers,
} from "@/lib/services/finance/customer-service";
import { getCustomerOwedTotal } from "@/lib/services/finance/receivable-service";
import {
  createCustomerSchema,
  customerIdSchema,
  customerQuerySchema,
} from "@/lib/validation/finance";
import type { CustomerDto, CustomerOwedDto } from "@/types/finance";

function firstError(message: string | undefined): string {
  return message ?? "Dados inválidos.";
}

export async function createCustomerAction(
  input: unknown,
): Promise<ActionResult<CustomerDto>> {
  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    const customer = await createCustomer(ctx, parsed.data);
    revalidatePath("/financeiro/clientes");
    return { ok: true, data: customer };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listCustomersAction(
  input: unknown,
): Promise<ActionResult<CustomerDto[]>> {
  const parsed = customerQuerySchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Filtro inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await listCustomers(ctx, parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function getCustomerOwedTotalAction(
  input: unknown,
): Promise<ActionResult<CustomerOwedDto>> {
  const parsed = customerIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await getCustomerOwedTotal(ctx, parsed.data.id) };
  } catch (error) {
    return toActionError(error);
  }
}
