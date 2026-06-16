"use server";

import { requireAuthContext } from "@/lib/auth";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  reprintKitchen,
  reprintReceipt,
} from "@/lib/services/print/print-service";
import {
  reprintKitchenSchema,
  reprintReceiptSchema,
} from "@/lib/validation/print";

/**
 * RF07 — reimprime pedido de cozinha por `comanda_item_id`.
 * UUID inválido → `{ ok: false }` sem chamar o serviço (T30).
 */
export async function reprintKitchenAction(input: {
  comandaItemId: string;
}): Promise<ActionResult<void>> {
  const parsed = reprintKitchenSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "UUID inválido" };
  }
  try {
    const ctx = await requireAuthContext();
    const result = await reprintKitchen(ctx, parsed.data.comandaItemId);
    return result.success
      ? { ok: true, data: undefined }
      : { ok: false, error: result.error ?? "Impressora offline — reimprima manualmente" };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * RF07 — reimprime cupom de venda por `sale_id`.
 * UUID inválido → `{ ok: false }` sem chamar o serviço.
 */
export async function reprintReceiptAction(input: {
  saleId: string;
}): Promise<ActionResult<void>> {
  const parsed = reprintReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "UUID inválido" };
  }
  try {
    const ctx = await requireAuthContext();
    const result = await reprintReceipt(ctx, parsed.data.saleId);
    return result.success
      ? { ok: true, data: undefined }
      : { ok: false, error: result.error ?? "Impressora offline — reimprima manualmente" };
  } catch (err) {
    return toActionError(err);
  }
}
