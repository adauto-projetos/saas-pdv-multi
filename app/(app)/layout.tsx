import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { getAuthUser } from "@/lib/auth/session";
import { getNavPermissions } from "@/lib/auth/permissions";
import { getImpersonatedTenantId } from "@/lib/auth/impersonation";
import { getUserTenantId } from "@/lib/services/tenants/onboarding";
import { getDaysUntilExpiry, getTenantStatus } from "@/lib/services/subscriptions/subscription-status";
import { selectHasRenewed } from "@/lib/services/subscriptions/repository";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner";
import { SubscriptionWarningBanner } from "@/components/layout/SubscriptionWarningBanner";
import { SubscriptionLockedBanner } from "@/components/layout/SubscriptionLockedBanner";
import { SubscriptionTrialBanner } from "@/components/layout/SubscriptionTrialBanner";
import { HelpProvider } from "@/lib/help/help-context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const [userRow] = await db
    .select({ email: users.email, isFounder: users.isFounder })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  // Loja própria do usuário (null para o super admin, que não tem tenant).
  const ownTenantId = await getUserTenantId(user.id);

  // Impersonação (SF03): founder sem loja própria mas com cookie ativo opera a
  // loja impersonada. tenantId efetivo = própria OU impersonada.
  let tenantId = ownTenantId;
  let impersonating = false;
  if (!tenantId && userRow?.isFounder) {
    const impersonated = await getImpersonatedTenantId();
    if (impersonated) {
      tenantId = impersonated;
      impersonating = true;
    }
  }

  // Conta sem loja: o super admin (founder) sem impersonar vai direto ao painel.
  // Conta sem loja e sem ser founder é estado inválido → login.
  if (!tenantId) {
    if (userRow?.isFounder) redirect("/superadmin");
    redirect("/login");
  }

  // Permissões para filtrar o menu (RF11). Owner recebe todas; founder
  // impersonando vê tudo (canSeeAll). Operador, só os códigos concedidos.
  const nav = await getNavPermissions(tenantId, user.id);
  const canSeeAll = nav.isOwner || impersonating;

  let subscriptionStatus: "testando" | "ativa" | "travada" | null = null;
  let daysLeft = 0;
  let storeName = "";

  const [tenantRow] = await db
    .select({
      name: tenants.name,
      validUntil: tenants.validUntil,
      suspendedAt: tenants.suspendedAt,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (tenantRow) {
    storeName = tenantRow.name;
    const hasRenewed = await selectHasRenewed(tenantId);
    subscriptionStatus = getTenantStatus(tenantRow, hasRenewed);

    // Days until expiry for warning banner (RF04: warn when < 3 days).
    if (tenantRow.validUntil && subscriptionStatus !== "travada") {
      daysLeft = getDaysUntilExpiry(tenantRow.validUntil);
    }
  }

  // Impersonando, não mostramos os banners de assinatura da loja-alvo — eles são
  // do contexto do dono, não do suporte do super admin.
  const showWarning =
    !impersonating && subscriptionStatus !== null && subscriptionStatus !== "travada" && daysLeft <= 3;
  const showLocked = !impersonating && subscriptionStatus === "travada";
  // Em teste e ainda com folga (> 3 dias): banner informativo sempre visível com
  // os dias restantes. Na reta final (≤ 3 dias) o aviso âmbar acima assume.
  const showTrial =
    !impersonating && subscriptionStatus === "testando" && !showWarning && daysLeft > 0;

  return (
    <HelpProvider>
      <div
        className="flex h-screen flex-col overflow-hidden lg:flex-row"
        style={{ background: "var(--pdv-bg)" }}
      >
        <AppSidebar
          userEmail={userRow?.email ?? ""}
          isFounder={userRow?.isFounder ?? false}
          permissions={nav.codes}
          canSeeAll={canSeeAll}
        />
        <main className="flex flex-1 flex-col min-w-0 overflow-x-hidden overflow-y-auto pb-16 lg:pb-0">
          {impersonating && <ImpersonationBanner storeName={storeName} />}
          {showLocked && <SubscriptionLockedBanner />}
          {showWarning && <SubscriptionWarningBanner daysLeft={daysLeft} />}
          {showTrial && <SubscriptionTrialBanner daysLeft={daysLeft} />}
          {children}
        </main>
        <BottomNav
          className="lg:hidden"
          isFounder={userRow?.isFounder ?? false}
          permissions={nav.codes}
          canSeeAll={canSeeAll}
        />
      </div>
    </HelpProvider>
  );
}
