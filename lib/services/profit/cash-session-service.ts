import { withUserRls } from "@/db/rls";
import {
  ConflictError,
  isUniqueViolation,
  ValidationError,
} from "@/lib/services/errors";
import type {
  CloseSessionInput,
  OpenSessionInput,
  ProfitFilterInput,
} from "@/lib/validation/profit";
import type { AuthContext } from "@/types/product";
import type { CashSessionDto } from "@/types/profit";

import * as data from "./cash-session-data";

/**
 * Serviço de fechamento de caixa por turno (0005F). Tudo sob `withUserRls`
 * (RN01). Dinheiro em centavos; `opened_by`/`closed_by` sempre do ctx (RN10).
 * No máximo uma sessão aberta por tenant (RN09); sessão imutável após fechada (RN08).
 */

/**
 * RF04 — abre o turno com o saldo inicial. RN09: pré-checa se já há sessão aberta
 * → ConflictError. O partial unique index é a última linha (corrida): se uma
 * inserção escapar do pré-check, o `isUniqueViolation` a converte em ConflictError.
 */
export async function openCashSession(
  ctx: AuthContext,
  input: OpenSessionInput,
): Promise<CashSessionDto> {
  return withUserRls(ctx.userId, async (tx) => {
    const existing = await data.selectOpenSession(tx, ctx.tenantId);
    if (existing) {
      throw new ConflictError("Já existe um caixa aberto");
    }
    try {
      return await data.insertCashSession(tx, ctx.tenantId, {
        openingBalanceCents: input.openingBalanceCents,
        openedBy: ctx.userId,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("Já existe um caixa aberto");
      }
      throw error;
    }
  });
}

/**
 * RF06 — fecha o turno. RN09: exige sessão aberta (null → ValidationError).
 * Esperado = opening + Σ movimentos do turno (RN06); divergência = contado −
 * esperado (RN07). O fechamento é o único UPDATE da sessão (RN08).
 */
export async function closeCashSession(
  ctx: AuthContext,
  input: CloseSessionInput,
): Promise<CashSessionDto> {
  return withUserRls(ctx.userId, async (tx) => {
    const open = await data.selectOpenSession(tx, ctx.tenantId);
    if (!open) {
      throw new ValidationError("Não há caixa aberto para fechar");
    }
    const movementsSum = await data.selectSessionMovementsSum(
      tx,
      ctx.tenantId,
      open.id,
    );
    const expectedCents = open.openingBalanceCents + movementsSum;
    const divergenceCents = input.countedCents - expectedCents;
    const closed = await data.closeCashSession(tx, ctx.tenantId, open.id, {
      closedBy: ctx.userId,
      countedCents: input.countedCents,
      expectedCents,
      divergenceCents,
    });
    if (!closed) {
      // Corrida: a sessão deixou de estar 'aberta' entre o select e o update.
      throw new ValidationError("Não há caixa aberto para fechar");
    }
    return closed;
  });
}

/** RF08 — turno aberto do tenant (ou null) para a tela de caixa. */
export async function getOpenSession(
  ctx: AuthContext,
): Promise<CashSessionDto | null> {
  return withUserRls(ctx.userId, (tx) =>
    data.selectOpenSession(tx, ctx.tenantId),
  );
}

/** RF07 — histórico de sessões do tenant, filtrável por período. */
export async function listSessions(
  ctx: AuthContext,
  filter: ProfitFilterInput,
): Promise<CashSessionDto[]> {
  return withUserRls(ctx.userId, (tx) =>
    data.selectSessions(tx, ctx.tenantId, {
      from: filter.from,
      to: filter.to,
    }),
  );
}
