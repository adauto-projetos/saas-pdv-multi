"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { withUserRls } from "@/db/rls";
import { saleItems, sales } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError, ValidationError } from "@/lib/services/errors";

const receiptSchema = z.object({ saleId: z.string().uuid("ID inválido") });

export type ReceiptLineDto = {
  name: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  subtotalCents: number;
};

export type ReceiptDto = {
  saleId: string;
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
      return { sale, lines };
    });
    if (!result) return { ok: false, error: "Venda não encontrada" };
    return {
      ok: true,
      data: {
        saleId: result.sale.id,
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
