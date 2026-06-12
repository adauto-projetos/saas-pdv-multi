import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { cashMovements } from "@/db/schema";
import type { CashMovementDto, CashMovementType, CashOrigin } from "@/types/finance";

type Executor = Pick<Database, "insert" | "select" | "update">;

type CashMovementInsert = {
  /** Magnitude OU valor assinado — o sinal é forçado aqui pelo `type`. */
  amountCents: number;
  type: CashMovementType;
  origin: CashOrigin;
  description?: string | null;
  userId: string;
  saleId?: string | null;
  receivablePaymentId?: string | null;
  payablePaymentId?: string | null;
};

function toCashMovementDto(
  row: typeof cashMovements.$inferSelect,
): CashMovementDto {
  return {
    id: row.id,
    amountCents: row.amountCents,
    type: row.type as CashMovementType,
    description: row.description,
    origin: row.origin as CashOrigin,
    saleId: row.saleId,
    receivablePaymentId: row.receivablePaymentId,
    payablePaymentId: row.payablePaymentId,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Insere um lançamento no ledger de caixa. O SINAL é imposto aqui a partir do
 * `type` (entrada → +|x|, saída → −|x|), de modo que nenhum chamador consiga
 * violar o CHECK de sinal do banco (RN05). Isolado por tenant (RN01).
 */
export async function insertCashMovement(
  tx: Executor,
  tenantId: string,
  data: CashMovementInsert,
): Promise<CashMovementDto> {
  const magnitude = Math.abs(data.amountCents);
  const signed = data.type === "entrada" ? magnitude : -magnitude;
  const [row] = await tx
    .insert(cashMovements)
    .values({
      tenantId,
      userId: data.userId,
      amountCents: signed,
      type: data.type,
      origin: data.origin,
      description: data.description ?? null,
      saleId: data.saleId ?? null,
      receivablePaymentId: data.receivablePaymentId ?? null,
      payablePaymentId: data.payablePaymentId ?? null,
    })
    .returning();
  return toCashMovementDto(row);
}

/** Saldo corrente do caixa: Σ amount_cents do tenant (RN05). */
export async function selectCashBalance(
  tx: Executor,
  tenantId: string,
): Promise<number> {
  const rows = await tx
    .select({
      total: sql<string>`coalesce(sum(${cashMovements.amountCents}), 0)`,
    })
    .from(cashMovements)
    .where(eq(cashMovements.tenantId, tenantId));
  return Number(rows[0]?.total ?? 0);
}

/** Movimentações de caixa do tenant, mais recentes primeiro, filtráveis por data. */
export async function selectCashMovements(
  tx: Executor,
  tenantId: string,
  filters: { from?: string; to?: string } = {},
): Promise<CashMovementDto[]> {
  const conds = [eq(cashMovements.tenantId, tenantId)];
  // Ignora datas inválidas em vez de quebrar a query.
  const fromDate = filters.from ? new Date(filters.from) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    conds.push(gte(cashMovements.createdAt, fromDate));
  }
  const toDate = filters.to ? new Date(filters.to) : null;
  if (toDate && !Number.isNaN(toDate.getTime())) {
    conds.push(lte(cashMovements.createdAt, toDate));
  }

  const rows = await tx
    .select()
    .from(cashMovements)
    .where(and(...conds))
    .orderBy(desc(cashMovements.createdAt));
  return rows.map(toCashMovementDto);
}
