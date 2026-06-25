import { eq } from "drizzle-orm";

import { db } from "@/db";
import { subscriptionLog, tenantMembers, tenants, users } from "@/db/schema";

/**
 * Signup atômico: cria usuário + loja + vínculo owner. Roda no `db` direto (papel
 * `postgres`, bypassa RLS) porque no signup ainda não há sessão/membership — as
 * políticas baseadas em `current_app_user()` não permitiriam os INSERTs. O CRUD de
 * produtos segue isolado por loja via `withUserRls` (RN05).
 */
export async function createUserWithTenant(
  email: string,
  passwordHash: string,
  tenantName: string,
): Promise<{ userId: string; tenantId: string }> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: email.toLowerCase(), passwordHash })
      .returning({ id: users.id });
    const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: tenantName, validUntil })
      .returning({ id: tenants.id });
    await tx
      .insert(tenantMembers)
      .values({ tenantId: tenant.id, userId: user.id, role: "owner" });
    // RN01/RF01: trial de 7 dias + log atômico na mesma transação.
    await tx.insert(subscriptionLog).values({
      tenantId: tenant.id,
      action: "trial_started",
      validUntilBefore: null,
      validUntilAfter: validUntil,
      byUserId: null,
    });
    return { userId: user.id, tenantId: tenant.id };
  });
}

export async function getUserByEmail(email: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

/**
 * Resolve o tenant do usuário a partir do vínculo (sessão -> tenantId). Filtra por
 * userId explicitamente; usado pela camada de actions para montar o AuthContext.
 */
export async function getUserTenantId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .limit(1);
  return row?.tenantId ?? null;
}
