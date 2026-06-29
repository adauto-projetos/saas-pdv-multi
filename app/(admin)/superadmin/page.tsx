import { redirect } from "next/navigation";

import { requireFounder } from "@/lib/auth/admin";
import { UnauthorizedError } from "@/lib/services/errors";
import {
  getExpiringTenants,
  listAllTenantsWithStats,
} from "@/lib/services/admin/tenant-admin-service";
import type { TenantStatus } from "@/lib/services/subscriptions/subscription-status";
import {
  getMaxOperators,
  getMonthlyPlanPriceCents,
} from "@/lib/services/platform/settings-repository";
import { ExpiringTenantsList } from "@/components/admin/ExpiringTenantsList";
import { MaxOperatorsSettings } from "@/components/admin/MaxOperatorsSettings";
import { MetricsCards } from "@/components/admin/MetricsCards";
import { PlanPriceSettings } from "@/components/admin/PlanPriceSettings";
import { TenantTable } from "@/components/admin/TenantTable";

export default async function AdminPage() {
  try {
    await requireFounder();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/");
    }
    throw error;
  }

  const [tenants, expiring, monthlyPriceCents, maxOperators] = await Promise.all([
    listAllTenantsWithStats(),
    getExpiringTenants(3),
    getMonthlyPlanPriceCents(),
    getMaxOperators(),
  ]);

  const statusCounts: Record<TenantStatus, number> = {
    testando: 0,
    ativa: 0,
    travada: 0,
  };
  for (const t of tenants) {
    statusCounts[t.status]++;
  }

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-jakarta)",
          fontWeight: 800,
          fontSize: 22,
          color: "#0f172a",
          marginBottom: 6,
        }}
      >
        Painel Admin
      </div>
      <div style={{ fontSize: 13.5, color: "#64748b", marginBottom: 28 }}>
        Visão geral de todas as lojas e controle de assinaturas.
      </div>

      <MetricsCards stats={statusCounts} />

      <div style={{ marginTop: 28 }}>
        <PlanPriceSettings initialPriceCents={monthlyPriceCents} />
      </div>

      <div style={{ marginTop: 28 }}>
        <MaxOperatorsSettings initialMaxOperators={maxOperators} />
      </div>

      {expiring.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <ExpiringTenantsList tenants={expiring} />
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <TenantTable tenants={tenants} />
      </div>
    </div>
  );
}
