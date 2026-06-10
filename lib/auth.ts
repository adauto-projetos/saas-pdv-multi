import { getAuthUser } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/services/errors";
import { getUserTenantId } from "@/lib/services/tenants/onboarding";
import type { AuthContext } from "@/types/product";

/**
 * Monta o contexto de auth para as Server Actions: userId da sessão Supabase +
 * tenantId resolvido do vínculo. O tenantId NUNCA vem do input do cliente (RN05).
 * Lança UnauthorizedError se não há sessão ou loja associada.
 */
export async function requireAuthContext(): Promise<AuthContext> {
  const user = await getAuthUser();
  if (!user) throw new UnauthorizedError();

  const tenantId = await getUserTenantId(user.id);
  if (!tenantId) {
    throw new UnauthorizedError("Usuário sem loja associada");
  }

  return { userId: user.id, tenantId };
}
