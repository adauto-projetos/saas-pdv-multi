"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext } from "@/lib/auth";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  addComandaItem,
  cancelComanda,
  closeComanda,
  getComanda,
  listComandaHistory,
  listOpenComandas,
  openComanda,
  removeComandaItem,
} from "@/lib/services/comanda/comanda-service";
import {
  addComandaItemSchema,
  closeComandaSchema,
  comandaFilterSchema,
  comandaIdSchema,
  openComandaSchema,
  removeComandaItemSchema,
} from "@/lib/validation/comanda";
import type { ComandaDto, ComandaSummaryDto } from "@/types/comanda";
import type { SaleDto } from "@/types/sale";

function firstError(message: string | undefined): string {
  return message ?? "Dados inválidos.";
}

/** RF01 — abre comanda com rótulo livre (RN04: sem conflito de múltiplas abertas). */
export async function openComandaAction(
  input: unknown,
): Promise<ActionResult<ComandaDto>> {
  const parsed = openComandaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    const comanda = await openComanda(ctx, parsed.data);
    revalidatePath("/comandas");
    return { ok: true, data: comanda };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF02 — lança item na comanda aberta (baixa estoque no lançamento — RN03). */
export async function addComandaItemAction(
  input: unknown,
): Promise<ActionResult<ComandaDto>> {
  const parsed = addComandaItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    const comanda = await addComandaItem(ctx, parsed.data);
    revalidatePath("/comandas");
    return { ok: true, data: comanda };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF03 — remove item de comanda aberta (estorna estoque — RN03). */
export async function removeComandaItemAction(
  input: unknown,
): Promise<ActionResult<ComandaDto>> {
  const parsed = removeComandaItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    const comanda = await removeComandaItem(ctx, parsed.data);
    revalidatePath("/comandas");
    return { ok: true, data: comanda };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF04 — cancela comanda aberta (estorna todos os itens, sem venda — RN06). */
export async function cancelComandaAction(
  input: unknown,
): Promise<ActionResult<ComandaDto>> {
  const parsed = comandaIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    const comanda = await cancelComanda(ctx, parsed.data);
    revalidatePath("/comandas");
    return { ok: true, data: comanda };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * RF06/RF07 — fecha comanda → cria venda com snapshot de preço/custo.
 * dinheiro→caixa, fiado→a receber (RN07/RN09). Sem re-baixa de estoque (RN08).
 */
export async function closeComandaAction(
  input: unknown,
): Promise<ActionResult<SaleDto>> {
  const parsed = closeComandaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    const sale = await closeComanda(ctx, parsed.data);
    revalidatePath("/comandas");
    return { ok: true, data: sale };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF05 — comanda com itens + total parcial ao vivo (preço corrente). */
export async function getComandaAction(
  comandaId: unknown,
): Promise<ActionResult<ComandaDto>> {
  const parsed = comandaIdSchema.safeParse({ comandaId });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    const comanda = await getComanda(ctx, parsed.data);
    return { ok: true, data: comanda };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF08/RNF01 — lista comandas abertas com total parcial (JOIN products, sem N+1). */
export async function listOpenComandasAction(): Promise<
  ActionResult<ComandaDto[]>
> {
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await listOpenComandas(ctx) };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF08 — histórico de comandas fechadas/canceladas, filtrável por período/status. */
export async function listComandaHistoryAction(
  filter?: unknown,
): Promise<ActionResult<ComandaSummaryDto[]>> {
  const parsed = comandaFilterSchema.safeParse(filter ?? {});
  if (!parsed.success) {
    return { ok: false, error: "Filtro inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await listComandaHistory(ctx, parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}
