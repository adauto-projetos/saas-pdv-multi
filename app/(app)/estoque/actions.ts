"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext } from "@/lib/auth";
import { requireActiveTenant } from "@/lib/auth/tenant-guard";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  listLowStock,
  listMovements,
  recordAdjustment,
  recordEntry,
  setMinStock,
} from "@/lib/services/stock/stock-service";
import {
  minStockSchema,
  movementFilterSchema,
  stockAdjustmentSchema,
  stockEntrySchema,
} from "@/lib/validation/stock";
import type { ProductDto } from "@/types/product";
import type { StockMovementDto } from "@/types/stock";

function firstError(message: string | undefined): string {
  return message ?? "Dados inválidos.";
}

export async function recordEntryAction(
  input: unknown,
): Promise<ActionResult<StockMovementDto>> {
  const parsed = stockEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    const movement = await recordEntry(ctx, parsed.data);
    revalidatePath("/estoque");
    revalidatePath("/products");
    return { ok: true, data: movement };
  } catch (error) {
    return toActionError(error);
  }
}

export async function recordAdjustmentAction(
  input: unknown,
): Promise<ActionResult<StockMovementDto>> {
  const parsed = stockAdjustmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    const movement = await recordAdjustment(ctx, parsed.data);
    revalidatePath("/estoque");
    revalidatePath("/products");
    return { ok: true, data: movement };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listMovementsAction(
  input: unknown,
): Promise<ActionResult<StockMovementDto[]>> {
  const parsed = movementFilterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Filtro inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await listMovements(ctx, parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setMinStockAction(
  input: unknown,
): Promise<ActionResult<ProductDto>> {
  const parsed = minStockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    const product = await setMinStock(ctx, parsed.data);
    revalidatePath("/estoque");
    revalidatePath("/products");
    return { ok: true, data: product };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listLowStockAction(): Promise<ActionResult<ProductDto[]>> {
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await listLowStock(ctx) };
  } catch (error) {
    return toActionError(error);
  }
}
