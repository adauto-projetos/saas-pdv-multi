import { and, asc, between, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { subscriptionLog, tenants } from "@/db/schema";
import type { TenantStatus } from "@/lib/services/subscriptions/subscription-status";
import { getTenantStatus } from "@/lib/services/subscriptions/subscription-status";

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
