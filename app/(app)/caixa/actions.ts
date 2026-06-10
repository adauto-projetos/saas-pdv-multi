"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext } from "@/lib/auth";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  lookupProductByBarcode,
  searchProducts,
} from "@/lib/services/sales/lookup";
import { finalizeSale, listTodaySales } from "@/lib/services/sales/sale-service";
import { finalizeSaleSchema } from "@/lib/validation/sale";
import type { ProductDto } from "@/types/product";
import type { SaleDto } from "@/types/sale";

export async function lookupProductByBarcodeAction(
  barcode: string,
): Promise<ActionResult<ProductDto | null>> {
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await lookupProductByBarcode(ctx, barcode) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function searchProductsAction(
  query: string,
): Promise<ActionResult<ProductDto[]>> {
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await searchProducts(ctx, query) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function finalizeSaleAction(
  input: unknown,
): Promise<ActionResult<SaleDto>> {
  const parsed = finalizeSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Venda inválida.",
    };
  }
  try {
    const ctx = await requireAuthContext();
    const sale = await finalizeSale(ctx, parsed.data);
    revalidatePath("/caixa");
    revalidatePath("/vendas");
    return { ok: true, data: sale };
  } catch (error) {
    return toActionError(error);
  }
}

export async function listTodaySalesAction(): Promise<ActionResult<SaleDto[]>> {
  try {
    const ctx = await requireAuthContext();
    return { ok: true, data: await listTodaySales(ctx) };
  } catch (error) {
    return toActionError(error);
  }
}
