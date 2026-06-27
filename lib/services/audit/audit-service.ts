import type { AuditFilterInput } from "@/lib/validation/auditoria";
import type { AuditReportDto, OperatorActivityDto } from "@/types/audit";
import type { AuthContext } from "@/types/product";

import {
  overrideLogExists,
  selectCashClosedByUser,
  selectCashMovesByUser,
  selectCashOpenedByUser,
  selectComandasByStatusClosedBy,
  selectComandasOpenedByUser,
  selectOverrides,
  selectSalesByUser,
  selectStockMovesByUser,
  selectTenantMembers,
} from "./audit-data";

/** Constrói um mapa userId→count a partir de linhas agregadas. */
function countMap(rows: { userId: string | null; count: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.userId) m.set(r.userId, r.count);
  }
  return m;
}

/**
 * Relatório de auditoria por operador no período (0014F/SF04). Roda inteiramente
 * na conexão owner `db` (ver audit-data) — gated por `requirePermission(ctx,
 * 'gerenciar_usuarios')` na action. Operador desativado continua nomeado (RF04);
 * o owner é distinto dos operadores (RN02). Seção de overrides só se SF02 entregou
 * a tabela (RF05).
 */
export async function getAuditByPeriod(
  ctx: AuthContext,
  filter: AuditFilterInput,
): Promise<AuditReportDto> {
  const { operatorId, from, to } = filter;
  const t = ctx.tenantId;

  const [
    members,
    salesRows,
    cashOpened,
    cashClosed,
    comandasOpened,
    comandasClosed,
    comandasCancelled,
    stockMoves,
    cashMoves,
  ] = await Promise.all([
    selectTenantMembers(t),
    selectSalesByUser(t, from, to),
    selectCashOpenedByUser(t, from, to),
    selectCashClosedByUser(t, from, to),
    selectComandasOpenedByUser(t, from, to),
    selectComandasByStatusClosedBy(t, "fechada", from, to),
    selectComandasByStatusClosedBy(t, "cancelada", from, to),
    selectStockMovesByUser(t, from, to),
    selectCashMovesByUser(t, from, to),
  ]);

  const salesMap = new Map<string, { count: number; total: number }>();
  for (const r of salesRows) {
    if (r.userId) salesMap.set(r.userId, { count: r.count, total: r.total });
  }
  const cashOpenedMap = countMap(cashOpened);
  const cashClosedMap = countMap(cashClosed);
  const comandasOpenedMap = countMap(comandasOpened);
  const comandasClosedMap = countMap(comandasClosed);
  const comandasCancelledMap = countMap(comandasCancelled);
  const stockMap = countMap(stockMoves);
  const cashMovesMap = countMap(cashMoves);

  const operators: OperatorActivityDto[] = members
    .filter((m) => !operatorId || m.userId === operatorId)
    .map((m) => {
      const sale = salesMap.get(m.userId);
      return {
        userId: m.userId,
        name: m.name,
        email: m.email,
        role: m.role,
        isOwner: m.role === "owner",
        isActive: m.isActive,
        salesCount: sale?.count ?? 0,
        salesTotalCents: sale?.total ?? 0,
        cashOpened: cashOpenedMap.get(m.userId) ?? 0,
        cashClosed: cashClosedMap.get(m.userId) ?? 0,
        comandasOpened: comandasOpenedMap.get(m.userId) ?? 0,
        comandasClosed: comandasClosedMap.get(m.userId) ?? 0,
        comandasCancelled: comandasCancelledMap.get(m.userId) ?? 0,
        stockMovements: stockMap.get(m.userId) ?? 0,
        cashMovements: cashMovesMap.get(m.userId) ?? 0,
      };
    })
    // Owner por último; demais por nome/email.
    .sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? 1 : -1;
      return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    });

  // Seção de overrides — só se a tabela existir (SF02). Degrada sem erro (RF05).
  const overrides = (await overrideLogExists())
    ? await selectOverrides(t, from, to)
    : null;

  return { operators, overrides, from: from ?? null, to: to ?? null };
}
