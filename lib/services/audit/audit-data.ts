import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  cashMovements,
  cashSessions,
  comandas,
  sales,
  stockMovements,
  tenantMembers,
  users,
} from "@/db/schema";
import type { OverrideEntryDto } from "@/types/audit";

/**
 * Data layer da Auditoria (0014F/SF04). TUDO roda na conexão `db` (owner) com
 * filtro `tenant_id = ctx.tenantId` explícito: os nomes vêm de tenant_members (RLS
 * não-recursiva esconderia outros membros via withUserRls). Uma query por métrica,
 * GROUP BY pela coluna de autoria — sem N+1 (RNF01). Nenhuma coluna nova (RN01).
 */

const intCount = sql<number>`cast(count(*) as int)`;

/** Condição de faixa de datas opcional sobre uma coluna timestamptz. */
function dateRange(
  column: Parameters<typeof gte>[0],
  from?: string,
  to?: string,
): SQL[] {
  const conds: SQL[] = [];
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) conds.push(gte(column, d));
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) conds.push(lte(column, d));
  }
  return conds;
}

/** Membros do tenant (owner + operadores) com nome/email — base do relatório. */
export async function selectTenantMembers(tenantId: string) {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: tenantMembers.role,
      isActive: tenantMembers.isActive,
    })
    .from(tenantMembers)
    .innerJoin(users, eq(users.id, tenantMembers.userId))
    .where(eq(tenantMembers.tenantId, tenantId));
}

/** Vendas por autor: contagem + soma de total_cents. */
export async function selectSalesByUser(
  tenantId: string,
  from?: string,
  to?: string,
) {
  return db
    .select({
      userId: sales.userId,
      count: intCount,
      total: sql<number>`cast(coalesce(sum(${sales.totalCents}), 0) as int)`,
    })
    .from(sales)
    .where(and(eq(sales.tenantId, tenantId), ...dateRange(sales.createdAt, from, to)))
    .groupBy(sales.userId);
}

/** Caixas abertos por autor (opened_by / opened_at). */
export async function selectCashOpenedByUser(
  tenantId: string,
  from?: string,
  to?: string,
) {
  return db
    .select({ userId: cashSessions.openedBy, count: intCount })
    .from(cashSessions)
    .where(
      and(
        eq(cashSessions.tenantId, tenantId),
        ...dateRange(cashSessions.openedAt, from, to),
      ),
    )
    .groupBy(cashSessions.openedBy);
}

/** Caixas fechados por autor (closed_by / closed_at, não nulos). */
export async function selectCashClosedByUser(
  tenantId: string,
  from?: string,
  to?: string,
) {
  return db
    .select({ userId: cashSessions.closedBy, count: intCount })
    .from(cashSessions)
    .where(
      and(
        eq(cashSessions.tenantId, tenantId),
        sql`${cashSessions.closedBy} is not null`,
        ...dateRange(cashSessions.closedAt, from, to),
      ),
    )
    .groupBy(cashSessions.closedBy);
}

/** Comandas abertas por autor (opened_by / opened_at). */
export async function selectComandasOpenedByUser(
  tenantId: string,
  from?: string,
  to?: string,
) {
  return db
    .select({ userId: comandas.openedBy, count: intCount })
    .from(comandas)
    .where(
      and(eq(comandas.tenantId, tenantId), ...dateRange(comandas.openedAt, from, to)),
    )
    .groupBy(comandas.openedBy);
}

/** Comandas por status (fechada/cancelada) agrupadas por quem fechou (closed_by). */
export async function selectComandasByStatusClosedBy(
  tenantId: string,
  status: "fechada" | "cancelada",
  from?: string,
  to?: string,
) {
  return db
    .select({ userId: comandas.closedBy, count: intCount })
    .from(comandas)
    .where(
      and(
        eq(comandas.tenantId, tenantId),
        eq(comandas.status, status),
        sql`${comandas.closedBy} is not null`,
        ...dateRange(comandas.closedAt, from, to),
      ),
    )
    .groupBy(comandas.closedBy);
}

/** Movimentações de estoque por autor. */
export async function selectStockMovesByUser(
  tenantId: string,
  from?: string,
  to?: string,
) {
  return db
    .select({ userId: stockMovements.userId, count: intCount })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.tenantId, tenantId),
        ...dateRange(stockMovements.createdAt, from, to),
      ),
    )
    .groupBy(stockMovements.userId);
}

/** Movimentações de caixa por autor. */
export async function selectCashMovesByUser(
  tenantId: string,
  from?: string,
  to?: string,
) {
  return db
    .select({ userId: cashMovements.userId, count: intCount })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.tenantId, tenantId),
        ...dateRange(cashMovements.createdAt, from, to),
      ),
    )
    .groupBy(cashMovements.userId);
}

/** A tabela override_log existe? (SF02 pode não ter sido entregue — RF05.) */
export async function overrideLogExists(): Promise<boolean> {
  const rows = await db.execute<{ present: boolean }>(
    sql`select to_regclass('public.override_log') is not null as present`,
  );
  // postgres-js retorna um array-like de linhas.
  const first = (rows as unknown as Array<{ present: boolean }>)[0];
  return first?.present === true;
}

/**
 * Lê os overrides do período com os nomes do ator e do autorizador. Só chamado
 * quando `overrideLogExists()` é true. Owner `db`, filtro por tenant explícito.
 */
export async function selectOverrides(
  tenantId: string,
  from?: string,
  to?: string,
): Promise<OverrideEntryDto[]> {
  const conds = dateRange(sql`ol.created_at`, from, to);
  const where = conds.length
    ? sql` and ${sql.join(conds, sql` and `)}`
    : sql``;
  const rows = await db.execute<{
    actor_name: string | null;
    actor_email: string | null;
    authorizer_name: string | null;
    authorizer_email: string | null;
    action_code: string;
    target_ref: string | null;
    created_at: Date;
  }>(sql`
    select
      actor.name as actor_name, actor.email as actor_email,
      auth.name as authorizer_name, auth.email as authorizer_email,
      ol.action_code, ol.target_ref, ol.created_at
    from override_log ol
      left join users actor on actor.id = ol.actor_user_id
      left join users auth on auth.id = ol.authorizer_user_id
    where ol.tenant_id = ${tenantId}${where}
    order by ol.created_at desc
  `);

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    actorName: (r.actor_name as string) ?? (r.actor_email as string) ?? "—",
    authorizerName:
      (r.authorizer_name as string) ?? (r.authorizer_email as string) ?? "—",
    actionCode: r.action_code as string,
    targetRef: (r.target_ref as string | null) ?? null,
    createdAt: (r.created_at instanceof Date
      ? r.created_at
      : new Date(r.created_at as string)
    ).toISOString(),
  }));
}
