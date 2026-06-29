import { and, asc, between, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { subscriptionLog, tenantMembers, tenants, users } from "@/db/schema";
import { addCalendarMonths } from "@/lib/format/calendar-month";
import { NotFoundError } from "@/lib/services/errors";
import type { TenantStatus } from "@/lib/services/subscriptions/subscription-status";
import { getTenantStatus } from "@/lib/services/subscriptions/subscription-status";
import {
  insertSubscriptionLog,
  selectTenantById,
} from "@/lib/services/subscriptions/repository";

import { selectTenantName } from "./admin-data";

export type AdminTenantRow = {
  id: string;
  name: string;
  status: TenantStatus;
  validUntil: Date | null;
  suspendedAt: Date | null;
  revenueCents: number;
  lastActivityAt: Date | null;
};

export type SubscriptionLogEntry = {
  id: string;
  action: "trial_started" | "renewed" | "suspended" | "released";
  validUntilBefore: Date | null;
  validUntilAfter: Date | null;
  byUserId: string | null;
  at: Date;
};

type RawTenantRow = {
  id: string;
  name: string;
  valid_until: Date | string | null;
  suspended_at: Date | string | null;
  revenue_cents: number | string;
  last_activity_at: Date | string | null;
  has_renewed: boolean;
};

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

export async function listAllTenantsWithStats(): Promise<AdminTenantRow[]> {
  const result = await db.execute<RawTenantRow>(sql`
    SELECT
      t.id,
      t.name,
      t.valid_until,
      t.suspended_at,
      COALESCE(s.revenue_cents, 0)::int AS revenue_cents,
      act.last_activity_at,
      (r.tenant_id IS NOT NULL) AS has_renewed
    FROM tenants t
    LEFT JOIN (
      SELECT tenant_id, SUM(total_cents)::bigint AS revenue_cents
      FROM sales
      WHERE created_at >= date_trunc('month', NOW())
      GROUP BY tenant_id
    ) s ON s.tenant_id = t.id
    LEFT JOIN (
      SELECT tenant_id, MAX(created_at) AS last_activity_at
      FROM (
        SELECT tenant_id, created_at FROM sales
        UNION ALL
        SELECT tenant_id, created_at FROM stock_movements
      ) combined
      GROUP BY tenant_id
    ) act ON act.tenant_id = t.id
    LEFT JOIN (
      SELECT DISTINCT tenant_id
      FROM subscription_log
      WHERE action = 'renewed'
    ) r ON r.tenant_id = t.id
    ORDER BY t.name
  `);

  return result.map((row) => {
    const validUntil = toDate(row.valid_until);
    const suspendedAt = toDate(row.suspended_at);
    return {
      id: row.id,
      name: row.name,
      validUntil,
      suspendedAt,
      revenueCents: Number(row.revenue_cents),
      lastActivityAt: toDate(row.last_activity_at),
      status: getTenantStatus({ validUntil, suspendedAt }, row.has_renewed),
    };
  });
}

export async function getExpiringTenants(
  days: number,
): Promise<Array<{ id: string; name: string; validUntil: Date }>> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ id: tenants.id, name: tenants.name, validUntil: tenants.validUntil })
    .from(tenants)
    .where(
      and(
        between(tenants.validUntil, now, cutoff),
        isNull(tenants.suspendedAt),
      ),
    )
    .orderBy(asc(tenants.validUntil));

  return rows
    .filter((r): r is { id: string; name: string; validUntil: Date } => r.validUntil !== null)
    .map((r) => ({ id: r.id, name: r.name, validUntil: r.validUntil }));
}

/**
 * Apaga a loja fisicamente (hard-delete). O `ON DELETE CASCADE` em todos os
 * FKs `tenant_id` remove produtos, vendas, estoque, comandas, caixa, financeiro,
 * `subscription_log` e os vínculos `tenant_members` automaticamente.
 *
 * A conta `users` NÃO tem `tenant_id` (só o vínculo em tenant_members), então
 * não cascateia. Após apagar a loja, removemos os usuários que ficaram órfãos
 * (sem nenhum outro vínculo) — exceto o founder, que nunca é apagado.
 *
 * Tudo numa transação: ou a loja inteira some, ou nada muda.
 */
export async function deleteTenantById(
  tenantId: string,
): Promise<{ deletedUserIds: string[] }> {
  return db.transaction(async (tx) => {
    // 1. Capturar membros ANTES do cascade (depois o vínculo já não existe).
    const members = await tx
      .select({ userId: tenantMembers.userId })
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, tenantId));
    const memberIds = members.map((m) => m.userId);

    // 2. Apagar a loja — cascade remove todos os dados de negócio + vínculos.
    await tx.delete(tenants).where(eq(tenants.id, tenantId));

    // 3. Apagar usuários órfãos (sem outro vínculo) e não-founder.
    const deletedUserIds: string[] = [];
    for (const userId of memberIds) {
      const remaining = await tx
        .select({ id: tenantMembers.id })
        .from(tenantMembers)
        .where(eq(tenantMembers.userId, userId))
        .limit(1);
      if (remaining.length > 0) continue; // ainda pertence a outra loja

      const [u] = await tx
        .select({ isFounder: users.isFounder })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!u || u.isFounder) continue; // nunca apagar o founder

      await tx.delete(users).where(eq(users.id, userId));
      deletedUserIds.push(userId);
    }

    return { deletedUserIds };
  });
}

export async function getTenantSubscriptionHistory(
  tenantId: string,
): Promise<SubscriptionLogEntry[]> {
  const rows = await db
    .select()
    .from(subscriptionLog)
    .where(eq(subscriptionLog.tenantId, tenantId))
    .orderBy(sql`${subscriptionLog.at} DESC`);

  return rows.map((r) => ({
    id: r.id,
    action: r.action as SubscriptionLogEntry["action"],
    validUntilBefore: r.validUntilBefore,
    validUntilAfter: r.validUntilAfter,
    byUserId: r.byUserId,
    at: r.at,
  }));
}

// ---------------------------------------------------------------------------
// Funções transacionais do super-admin (0020F/RF01). Owner-bypass (sem RLS);
// a action só valida borda + autoriza (requireFounder) e delega aqui. Reusa os
// helpers de subscriptions/repository.ts dentro de db.transaction (atomicidade:
// update do tenant + insert no log juntos, ou nada).
// ---------------------------------------------------------------------------

/** Nome do tenant por PK (owner db). Para confirmação de exclusão no super-admin. */
export async function getTenantName(
  tenantId: string,
): Promise<{ name: string } | null> {
  return selectTenantName(tenantId);
}

/**
 * Renova a assinatura: recalcula valid_until (a partir do maior entre a validade
 * vigente e hoje — loja vencida não recupera tempo perdido), atualiza o tenant
 * (limpando suspended_at) e grava o log "renewed" numa única transação (RF01).
 * Assume `months` já validado pela action (inteiro positivo).
 */
export async function releaseSubscription(
  tenantId: string,
  months: number,
  byUserId: string,
): Promise<{ newValidUntil: Date }> {
  // Read+write na MESMA transação (0020F): o snapshot de `validUntilBefore` reflete
  // exatamente o estado que será sobrescrito, mesmo sob escrita concorrente.
  return db.transaction(async (tx) => {
    const tenant = await selectTenantById(tenantId, tx);
    if (!tenant) throw new NotFoundError("Loja não encontrada");

    const now = new Date();
    // RN03: acumula a partir do maior entre a validade vigente e hoje.
    const base = tenant.validUntil && tenant.validUntil > now ? tenant.validUntil : now;
    // RN02: meses de calendário (não blocos de 30 dias), com clamp de fim-de-mês.
    const newValidUntil = addCalendarMonths(base, months);

    await tx
      .update(tenants)
      .set({ validUntil: newValidUntil, suspendedAt: null })
      .where(eq(tenants.id, tenantId));
    await insertSubscriptionLog(tx, {
      tenantId,
      action: "renewed",
      validUntilBefore: tenant.validUntil,
      validUntilAfter: newValidUntil,
      byUserId,
      // RF05: registra quantos meses foram liberados nesta ação.
      monthsReleased: months,
    });

    return { newValidUntil };
  });
}

/**
 * Suspende a loja: seta suspended_at=now e grava o log "suspended" numa única
 * transação (RF01). A suspensão não altera valid_until — o log apenas faz o
 * snapshot do valor vigente (auditoria).
 */
export async function suspendTenant(
  tenantId: string,
  byUserId: string,
): Promise<void> {
  // Read+write na MESMA transação (0020F): snapshot de auditoria consistente.
  await db.transaction(async (tx) => {
    const tenant = await selectTenantById(tenantId, tx);
    if (!tenant) throw new NotFoundError("Loja não encontrada");

    await tx
      .update(tenants)
      .set({ suspendedAt: new Date() })
      .where(eq(tenants.id, tenantId));
    await insertSubscriptionLog(tx, {
      tenantId,
      action: "suspended",
      validUntilBefore: tenant.validUntil,
      validUntilAfter: tenant.validUntil,
      byUserId,
    });
  });
}

/**
 * Libera a loja da suspensão: seta suspended_at=null e grava o log "released"
 * numa única transação (RF01). valid_until permanece inalterado.
 */
export async function releaseFromSuspension(
  tenantId: string,
  byUserId: string,
): Promise<void> {
  // Read+write na MESMA transação (0020F): snapshot de auditoria consistente.
  await db.transaction(async (tx) => {
    const tenant = await selectTenantById(tenantId, tx);
    if (!tenant) throw new NotFoundError("Loja não encontrada");

    await tx
      .update(tenants)
      .set({ suspendedAt: null })
      .where(eq(tenants.id, tenantId));
    await insertSubscriptionLog(tx, {
      tenantId,
      action: "released",
      validUntilBefore: tenant.validUntil,
      validUntilAfter: tenant.validUntil,
      byUserId,
    });
  });
}
