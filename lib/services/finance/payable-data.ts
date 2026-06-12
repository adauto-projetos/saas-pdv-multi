import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { payablePayments, payables } from "@/db/schema";
import type { AccountPaymentMethod } from "@/lib/validation/finance";
import type { AccountStatus, PayableDto } from "@/types/finance";

import { deriveOverdue, deriveStatus } from "./derive";

type Executor = Pick<Database, "insert" | "select" | "update">;

export type PayableRow = typeof payables.$inferSelect;

type InsertPayableInput = {
  description: string;
  totalCents: number;
  category: string;
  dueDate?: string | null;
};

export async function insertPayable(
  tx: Executor,
  tenantId: string,
  userId: string,
  data: InsertPayableInput,
): Promise<PayableRow> {
  const [row] = await tx
    .insert(payables)
    .values({
      tenantId,
      userId,
      description: data.description,
      totalCents: data.totalCents,
      category: data.category,
      dueDate: data.dueDate ?? null,
    })
    .returning();
  return row;
}

function buildPayableDto(row: PayableRow, paidCents: number): PayableDto {
  const remainingCents = row.totalCents - paidCents;
  return {
    id: row.id,
    description: row.description,
    category: row.category,
    totalCents: row.totalCents,
    paidCents,
    remainingCents,
    status: deriveStatus(row.totalCents, paidCents),
    dueDate: row.dueDate,
    overdue: deriveOverdue(row.dueDate, remainingCents),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Lista contas a pagar do tenant com Σ pago (subquery). Deriva status/overdue em
 * JS. Filtra `category` no SQL; `status` (derivado) em JS.
 */
export async function selectPayables(
  tx: Executor,
  tenantId: string,
  filters: { status?: AccountStatus; category?: string } = {},
): Promise<PayableDto[]> {
  const paidSub = tx
    .select({
      payableId: payablePayments.payableId,
      paid: sql<string>`sum(${payablePayments.amountCents})`.as("paid"),
    })
    .from(payablePayments)
    .where(eq(payablePayments.tenantId, tenantId))
    .groupBy(payablePayments.payableId)
    .as("paid_sub");

  const conds = [eq(payables.tenantId, tenantId)];
  if (filters.category) conds.push(eq(payables.category, filters.category));

  const rows = await tx
    .select({ payable: payables, paid: paidSub.paid })
    .from(payables)
    .leftJoin(paidSub, eq(paidSub.payableId, payables.id))
    .where(and(...conds))
    .orderBy(desc(payables.createdAt));

  const dtos = rows.map((r) => buildPayableDto(r.payable, Number(r.paid ?? 0)));
  return filters.status ? dtos.filter((d) => d.status === filters.status) : dtos;
}

export async function selectPayableWithPaid(
  tx: Executor,
  tenantId: string,
  id: string,
): Promise<{ payable: PayableRow; paidCents: number } | null> {
  const [row] = await tx
    .select()
    .from(payables)
    .where(and(eq(payables.tenantId, tenantId), eq(payables.id, id)));
  if (!row) return null;

  const paidRows = await tx
    .select({
      paid: sql<string>`coalesce(sum(${payablePayments.amountCents}), 0)`,
    })
    .from(payablePayments)
    .where(
      and(
        eq(payablePayments.tenantId, tenantId),
        eq(payablePayments.payableId, id),
      ),
    );

  return { payable: row, paidCents: Number(paidRows[0]?.paid ?? 0) };
}

export function payableDtoFrom(loaded: {
  payable: PayableRow;
  paidCents: number;
}): PayableDto {
  return buildPayableDto(loaded.payable, loaded.paidCents);
}

export async function insertPayablePayment(
  tx: Executor,
  tenantId: string,
  userId: string,
  data: {
    payableId: string;
    amountCents: number;
    method: AccountPaymentMethod;
    cashMovementId?: string | null;
  },
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(payablePayments)
    .values({
      tenantId,
      userId,
      payableId: data.payableId,
      amountCents: data.amountCents,
      method: data.method,
      cashMovementId: data.cashMovementId ?? null,
    })
    .returning({ id: payablePayments.id });
  return { id: row.id };
}

/**
 * Back-link: preenche `cash_movement_id` no pagamento após o lançamento de
 * caixa ser criado na mesma transação (RNF02). Esta é a única atualização
 * permitida em um pagamento — preenche o campo de referência que estava nulo
 * no insert inicial (dentro da mesma tx atômica). Não viola RN10: o dado
 * financeiro (amount, method, payable_id) permanece imutável.
 */
export async function updatePayablePaymentCashLink(
  tx: Executor,
  tenantId: string,
  paymentId: string,
  cashMovementId: string,
): Promise<void> {
  await tx
    .update(payablePayments)
    .set({ cashMovementId })
    .where(
      and(
        eq(payablePayments.tenantId, tenantId),
        eq(payablePayments.id, paymentId),
      ),
    );
}
