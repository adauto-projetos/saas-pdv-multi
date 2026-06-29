"use server";

import { and, eq } from "drizzle-orm";

import { withUserRls } from "@/db/rls";
import { saleItems, sales, tenants } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError, ValidationError } from "@/lib/services/errors";
import { receiptSchema } from "@/lib/validation/sale";

export type ReceiptLineDto = {
  name: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  subtotalCents: number;
};

export type ReceiptDto = {
  saleId: string;
  /** Nome da loja (tenant da sessão). Pode vir vazio; o fallback de marca é da UI (RN02). */
  storeName: string;
  totalCents: number;
  paymentMethod: string;
  createdAt: string;
  items: ReceiptLineDto[];
};

export async function getSaleReceiptAction(
  saleId: string,
): Promise<ActionResult<ReceiptDto>> {
  try {
    const parsed = receiptSchema.safeParse({ saleId });
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "ID inválido");
    }
    const ctx = await requireAuthContext();
    const result = await withUserRls(ctx.userId, async (tx) => {
      const [sale] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, saleId), eq(sales.tenantId, ctx.tenantId)))
        .limit(1);
      if (!sale) return null;
      const lines = await tx
        .select()
        .from(saleItems)
        .where(
          and(eq(saleItems.saleId, saleId), eq(saleItems.tenantId, ctx.tenantId)),
        );
      // Nome da loja escopado ao tenant da sessão (sob RLS) — RN02.
      const [tenant] = await tx
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);
      return { sale, lines, storeName: tenant?.name ?? "" };
    });
    if (!result) return { ok: false, error: "Venda não encontrada" };
    return {
      ok: true,
      data: {
        saleId: result.sale.id,
        storeName: result.storeName,
        totalCents: result.sale.totalCents,
        paymentMethod: result.sale.paymentMethod,
        createdAt: result.sale.createdAt.toISOString(),
        items: result.lines.map((l) => ({
          name: l.nameSnapshot,
          quantity: parseFloat(l.quantity),
          unit: l.unit,
          unitPriceCents: l.unitPriceCents,
          subtotalCents: l.subtotalCents,
        })),
      },
    };
  } catch (err) {
    return toActionError(err);
  }
}
