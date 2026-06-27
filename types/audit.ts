/**
 * DTOs da tela de Auditoria (0014F/SF04). Tudo derivado das colunas de autoria já
 * existentes — nenhuma coluna nova (RN01).
 */

/** Atividade agregada de um operador (ou do owner) no período. */
export type OperatorActivityDto = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  isOwner: boolean;
  isActive: boolean;
  salesCount: number;
  salesTotalCents: number;
  cashOpened: number;
  cashClosed: number;
  comandasOpened: number;
  comandasClosed: number;
  comandasCancelled: number;
  stockMovements: number;
  cashMovements: number;
};

/** Uma liberação de override no período (só se `override_log` existir — SF02). */
export type OverrideEntryDto = {
  actorName: string;
  authorizerName: string;
  actionCode: string;
  targetRef: string | null;
  createdAt: string;
};

/**
 * Relatório de auditoria. `overrides = null` quando a tabela `override_log` não
 * existe (SF02 não entregue) — a UI omite a seção sem erro (RF05).
 */
export type AuditReportDto = {
  operators: OperatorActivityDto[];
  overrides: OverrideEntryDto[] | null;
  from: string | null;
  to: string | null;
};
