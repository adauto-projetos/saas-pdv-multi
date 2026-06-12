import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { customers, receivablePayments, receivables } from "@/db/schema";
import type { AccountPaymentMethod } from "@/lib/validation/finance";
import type {
  AccountStatus,
  ReceivableDto,
  ReceivableOrigin,
} from "@/types/finance";

import { deriveOverdue, deriveStatus } from "./derive";

type Executor = Pick<Database, "insert" | "select" | "update">;

/** Linha crua da conta a receber (sem agregados derivados). */
export type ReceivableRow = typeof receivables.$inferSelect;

type InsertReceivableInput = {
  customerId: string;
  totalCents: number;
  origin: ReceivableOrigin;
  description?: string | null;
  dueDate?: string | null;
  saleId?: string | null;
};

/** Insere uma conta a receber; retorna a linha crua (para montar o DTO). */
export async function insertReceivable(
  tx: Executor,
  tenantId: string,
  userId: string,
  data: InsertReceivableInput,
): Promise<ReceivableRow> {
  const [row] = await tx
    .insert(receivables)
    .values({
      tenantId,
      userId,
      customerId: data.customerId,
      totalCents: data.totalCents,
      origin: data.origin,
      description: data.description ?? null,
      dueDate: data.dueDate ?? null,
      saleId: data.saleId ?? null,
    })
    .returning();
  return row;
}

function buildReceivableDto(
  row: ReceivableRow,
  customerName: string,
  paidCents: number,
): ReceivableDto {
  const remainingCents = row.totalCents - paidCents;
  return {
    id: row.id,
    customerId: row.customerId,
    customerName,
    totalCents: row.totalCents,
    paidCents,
    remainingCents,
    status: deriveStatus(row.totalCents, paidCents),
    origin: row.origin as ReceivableOrigin,
    saleId: row.saleId,
    dueDate: row.dueDate,
    overdue: deriveOverdue(row.dueDate, remainingCents),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Lista contas a receber do tenant com nome do cliente (LEFT JOIN) e Σ pago
 * (subquery agrupada por receivable_id). Deriva remaining/status/overdue em JS.
 * Filtra `customerId` no SQL; `status` (derivado) em JS.
 */
export async function selectReceivables(
  tx: Executor,
  tenantId: string,
  filters: { status?: AccountStatus; customerId?: string } = {},
): Promise<ReceivableDto[]> {
  const paidSub = tx
    .select({
      receivableId: receivablePayments.receivableId,
      paid: sql<string>`sum(${receivablePayments.amountCents})`.as("paid"),
    })
    .from(receivablePayments)
    .where(eq(receivablePayments.tenantId, tenantId))
    .groupBy(receivablePayments.receivableId)
    .as("paid_sub");

  const conds = [eq(receivables.tenantId, tenantId)];
  if (filters.customerId) {
    conds.push(eq(receivables.customerId, filters.customerId));
  }

  const rows = await tx
    .select({
      receivable: receivables,
      customerName: customers.name,
      paid: paidSub.paid,
    })
    .from(receivables)
    .leftJoin(customers, eq(customers.id, receivables.customerId))
    .leftJoin(paidSub, eq(paidSub.receivableId, receivables.id))
    .where(and(...conds))
    .orderBy(desc(receivables.createdAt));

  const dtos = rows.map((r) =>
    buildReceivableDto(r.receivable, r.customerName ?? "", Number(r.paid ?? 0)),
  );
  return filters.status ? dtos.filter((d) => d.status === filters.status) : dtos;
}

/** Carrega a conta + Σ pago para um único id (pagamento + montar DTO único). */
export async function selectReceivableWithPaid(
  tx: Executor,
  tenantId: string,
  id: string,
): Promise<{ receivable: ReceivableRow; customerName: string; paidCents: number } | null> {
  const [row] = await tx
    .select({ receivable: receivables, customerName: customers.name })
    .from(receivables)
    .leftJoin(customers, eq(customers.id, receivables.customerId))
    .where(and(eq(receivables.tenantId, tenantId), eq(receivables.id, id)));
  if (!row) return null;

  const paidRows = await tx
    .select({
      paid: sql<string>`coalesce(sum(${receivablePayments.amountCents}), 0)`,
    })
    .from(receivablePayments)
    .where(
      and(
        eq(receivablePayments.tenantId, tenantId),
        eq(receivablePayments.receivableId, id),
      ),
    );

  return {
    receivable: row.receivable,
    customerName: row.customerName ?? "",
    paidCents: Number(paidRows[0]?.paid ?? 0),
  };
}

/** Monta o DTO a partir do resultado de selectReceivableWithPaid (re-derivado). */
export function receivableDtoFrom(loaded: {
  receivable: ReceivableRow;
  customerName: string;
  paidCents: number;
}): ReceivableDto {
  return buildReceivableDto(
    loaded.receivable,
    loaded.customerName,
    loaded.paidCents,
  );
}

export async function insertReceivablePayment(
  tx: Executor,
  tenantId: string,
  userId: string,
  data: {
    receivableId: string;
    amountCents: number;
    method: AccountPaymentMethod;
    cashMovementId?: string | null;
  },
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(receivablePayments)
    .values({
      tenantId,
      userId,
      receivableId: data.receivableId,
      amountCents: data.amountCents,
      method: data.method,
      cashMovementId: data.cashMovementId ?? null,
    })
    .returning({ id: receivablePayments.id });
  return { id: row.id };
}

/**
 * Back-link: preenche `cash_movement_id` no pagamento após o lançamento de
 * caixa ser criado na mesma transação (RNF02). Esta é a única atualização
 * permitida em um pagamento — preenche o campo de referência que estava nulo
 * no insert inicial (dentro da mesma tx atômica). Não viola RN10: o dado
 * financeiro (amount, method, receivable_id) permanece imutável.
 */
export async function updateReceivablePaymentCashLink(
  tx: Executor,
  tenantId: string,
  paymentId: string,
  cashMovementId: string,
): Promise<void> {
  await tx
    .update(receivablePayments)
    .set({ cashMovementId })
    .where(
      and(
        eq(receivablePayments.tenantId, tenantId),
        eq(receivablePayments.id, paymentId),
      ),
    );
}

/**
 * Total em aberto de um cliente (RF10): Σ saldo devedor das contas não quitadas.
 * Calculado em JS porque o status é derivado. Retorna `null` se o cliente não
 * existir no tenant (permite que o serviço lance NotFoundError).
 */
export async function selectCustomerOwedTotal(
  tx: Executor,
  tenantId: string,
  customerId: string,
): Promise<{ name: string; totalOwedCents: number } | null> {
  const [customer] = await tx
    .select({ name: customers.name })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)));

  if (!customer) return null;

  const dtos = await selectReceivables(tx, tenantId, { customerId });
  const totalOwedCents = dtos
    .filter((d) => d.status !== "quitado")
    .reduce((sum, d) => sum + d.remainingCents, 0);

  return { name: customer.name, totalOwedCents };
}
