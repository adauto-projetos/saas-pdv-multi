import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { cashMovements, cashSessions } from "@/db/schema";
import type { CashSessionDto, CashSessionStatus } from "@/types/profit";

/**
 * Data layer das sessões de caixa (0005F). Executor = `db` direto OU `RlsTx`; o
 * service decide o contexto (sempre `withUserRls`). TODA função filtra por
 * `tenant_id` — filtro de aplicação aditivo à RLS (RN01). Padrão espelhado de
 * `lib/services/finance/cash-data.ts`.
 */
type Executor = Pick<Database, "insert" | "select" | "update">;

function toCashSessionDto(
  row: typeof cashSessions.$inferSelect,
): CashSessionDto {
  return {
    id: row.id,
    openingBalanceCents: row.openingBalanceCents,
    openedAt: row.openedAt.toISOString(),
    openedBy: row.openedBy,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    closedBy: row.closedBy,
    countedCents: row.countedCents,
    countedCardCents: row.countedCardCents,
    countedPixCents: row.countedPixCents,
    expectedCents: row.expectedCents,
    divergenceCents: row.divergenceCents,
    status: row.status as CashSessionStatus,
  };
}

/**
 * Cria uma sessão 'aberta' com o saldo inicial (RF04). `opened_by` vem do service
 * (ctx — RN10). O partial unique index `(tenant_id) WHERE status = 'aberta'` é a
 * última linha de defesa contra duas aberturas simultâneas (RN09).
 */
export async function insertCashSession(
  tx: Executor,
  tenantId: string,
  data: { openingBalanceCents: number; openedBy: string },
): Promise<CashSessionDto> {
  const [row] = await tx
    .insert(cashSessions)
    .values({
      tenantId,
      openingBalanceCents: data.openingBalanceCents,
      openedBy: data.openedBy,
      status: "aberta",
    })
    .returning();
  return toCashSessionDto(row);
}

/** Sessão 'aberta' do tenant, ou null (RF08). */
export async function selectOpenSession(
  tx: Executor,
  tenantId: string,
): Promise<CashSessionDto | null> {
  const [row] = await tx
    .select()
    .from(cashSessions)
    .where(
      and(
        eq(cashSessions.tenantId, tenantId),
        eq(cashSessions.status, "aberta"),
      ),
    )
    .limit(1);
  return row ? toCashSessionDto(row) : null;
}

/**
 * Id da sessão 'aberta' do tenant, ou null. Ponto de integração único (RF05):
 * reusado por `finalizeSale` (entrada de venda) e `registerCashMovement`
 * (sangria/suprimento) para carimbar `session_id` nas movimentações.
 */
export async function selectOpenSessionId(
  tx: Executor,
  tenantId: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ id: cashSessions.id })
    .from(cashSessions)
    .where(
      and(
        eq(cashSessions.tenantId, tenantId),
        eq(cashSessions.status, "aberta"),
      ),
    )
    .limit(1);
  return row ? row.id : null;
}

/**
 * Σ das movimentações de caixa vinculadas ao turno (RN06). Esperado da gaveta =
 * opening + este valor. Como `cash_movements` só existem para dinheiro (0004F
 * RN08), o SUM já é dinheiro-only. Espelha `selectCashBalance`.
 */
export async function selectSessionMovementsSum(
  tx: Executor,
  tenantId: string,
  sessionId: string,
): Promise<number> {
  const rows = await tx
    .select({
      total: sql<string>`coalesce(sum(${cashMovements.amountCents}), 0)`,
    })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.tenantId, tenantId),
        eq(cashMovements.sessionId, sessionId),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Único UPDATE permitido na sessão: a transição aberta → fechada (RN08). Preenche
 * closed_*, counted, expected, divergence e status='fechada'. O WHERE exige
 * `status = 'aberta'` — fechar uma já fechada não afeta linha alguma (idempotência
 * de auditoria; o service trata o caso "sem aberta" antes). Retorna o DTO atualizado.
 */
export async function closeCashSession(
  tx: Executor,
  tenantId: string,
  sessionId: string,
  data: {
    closedBy: string;
    countedCents: number;
    countedCardCents: number;
    countedPixCents: number;
    expectedCents: number;
    divergenceCents: number;
  },
): Promise<CashSessionDto | null> {
  const [row] = await tx
    .update(cashSessions)
    .set({
      closedAt: new Date(),
      closedBy: data.closedBy,
      countedCents: data.countedCents,
      countedCardCents: data.countedCardCents,
      countedPixCents: data.countedPixCents,
      expectedCents: data.expectedCents,
      divergenceCents: data.divergenceCents,
      status: "fechada",
    })
    .where(
      and(
        eq(cashSessions.id, sessionId),
        eq(cashSessions.tenantId, tenantId),
        eq(cashSessions.status, "aberta"),
      ),
    )
    .returning();
  return row ? toCashSessionDto(row) : null;
}

/** Histórico de sessões do tenant por período de abertura, recentes primeiro (RF07). */
export async function selectSessions(
  tx: Executor,
  tenantId: string,
  filters: { from?: string; to?: string } = {},
): Promise<CashSessionDto[]> {
  const conds = [eq(cashSessions.tenantId, tenantId)];
  // Ignora datas inválidas em vez de quebrar a query (padrão cashFilterSchema).
  const fromDate = filters.from ? new Date(filters.from) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    conds.push(gte(cashSessions.openedAt, fromDate));
  }
  const toDate = filters.to ? new Date(filters.to) : null;
  if (toDate && !Number.isNaN(toDate.getTime())) {
    conds.push(lte(cashSessions.openedAt, toDate));
  }

  const rows = await tx
    .select()
    .from(cashSessions)
    .where(and(...conds))
    .orderBy(desc(cashSessions.openedAt));
  return rows.map(toCashSessionDto);
}
