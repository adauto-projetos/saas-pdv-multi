"use server";

import { revalidatePath } from "next/cache";

import { withUserRls } from "@/db/rls";
import { requireAuthContext } from "@/lib/auth";
import { requireActiveTenant } from "@/lib/auth/tenant-guard";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import { selectTenantName } from "@/lib/services/print/print-data";
import { tryReceiptPrint } from "@/lib/services/print/print-service";
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
    await requireActiveTenant(ctx.tenantId);
    const sale = await finalizeSale(ctx, parsed.data);
    revalidatePath("/caixa");
    revalidatePath("/vendas");
    // Seção pós-commit: tenantName + print são side-effects (RN04).
    // Falha aqui NUNCA deve retornar ok:false — a venda já foi gravada.
    try {
      const tenantName = await withUserRls(ctx.userId, (tx) =>
        selectTenantName(tx, ctx.tenantId),
      );
      const printResult = await tryReceiptPrint(ctx, sale, tenantName);
      return {
        ok: true,
        data: sale,
        printWarning: printResult.success
          ? undefined
          : "Impressora offline — reimprima manualmente",
      };
    } catch {
      return {
        ok: true,
        data: sale,
        printWarning: "Impressora offline — reimprima manualmente",
      };
    }
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
