import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { subscriptionLog, tenants, users } from "@/db/schema";
import type { NewSubscriptionLog } from "@/db/schema";

/** Tipo do objeto de transação do Drizzle (postgres-js). */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Busca o tenant por PK via conexão owner (sem RLS).
 * Usado por requireActiveTenant — PK lookup < 50ms (RNF01).
 */
export async function selectTenantById(tenantId: string) {
  const [row] = await db
    .select({
      id: tenants.id,
      validUntil: tenants.validUntil,
      suspendedAt: tenants.suspendedAt,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row ?? null;
}

/**
 * Insere um registro no subscription_log dentro de uma transação existente.
 * Chamado atomicamente no onboarding (RF01) e pelo painel founder (SF02).
 */
export async function insertSubscriptionLog(
  tx: Tx,
  data: Pick<
    NewSubscriptionLog,
    | "tenantId"
    | "action"
    | "validUntilBefore"
    | "validUntilAfter"
    | "byUserId"
    | "monthsReleased"
  >,
) {
  await tx.insert(subscriptionLog).values(data);
}

/**
 * Boolean: existe ao menos um registro action='renewed' para este tenant?
 * Usa db owner (sem RLS) — chamado do layout server component.
 */
export async function selectHasRenewed(tenantId: string): Promise<boolean> {
  const rows = await db
    .select({ id: subscriptionLog.id })
    .from(subscriptionLog)
    .where(and(eq(subscriptionLog.tenantId, tenantId), eq(subscriptionLog.action, "renewed")))
    .limit(1);
  return rows.length > 0;
}

/**
 * Atualiza valid_until do tenant. Chamado por SF02 ao renovar assinatura.
 * Usa db owner (sem RLS).
 */
export async function updateTenantValidUntil(tenantId: string, validUntil: Date) {
  await db.update(tenants).set({ validUntil }).where(eq(tenants.id, tenantId));
}

/**
 * Atualiza suspended_at do tenant. Passar null para liberar (RF02).
 * Chamado por SF02 para suspender/liberar manualmente.
 */
export async function updateTenantSuspendedAt(tenantId: string, suspendedAt: Date | null) {
  await db.update(tenants).set({ suspendedAt }).where(eq(tenants.id, tenantId));
}

/**
 * Boolean: o usuário é founder (super admin)? Lê via owner db (sem RLS).
 * Usado por withUserRls/requireAuthContext para validar impersonação (SF03, RN01).
 */
export async function selectIsFounder(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ isFounder: users.isFounder })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.isFounder ?? false;
}

/**
 * Seta is_founder=true para o usuário com o email informado.
 * Seed do founder (RF07): lê FOUNDER_EMAIL do env e chama esta função.
 * Lança erro se o email não existir.
 */
export async function setFounderByEmail(email: string): Promise<void> {
  const updated = await db
    .update(users)
    .set({ isFounder: true })
    .where(eq(users.email, email.toLowerCase()))
    .returning({ id: users.id });
  if (updated.length === 0) {
    throw new Error(`Usuário não encontrado com email: ${email}`);
  }
}
