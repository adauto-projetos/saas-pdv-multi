import { getAuthUser } from "@/lib/auth/session";
import { getImpersonatedTenantId } from "@/lib/auth/impersonation";
import { UnauthorizedError } from "@/lib/services/errors";
import { getUserTenantId } from "@/lib/services/tenants/onboarding";
import { selectIsFounder } from "@/lib/services/subscriptions/repository";
import type { AuthContext } from "@/types/product";

/**
 * Monta o contexto de auth para as Server Actions: userId da sessão + tenantId
 * resolvido do vínculo. O tenantId NUNCA vem do input do cliente (RN05).
 *
 * Impersonação (SF03): se o usuário não tem loja própria mas é founder e há um
 * cookie de impersonação, o tenantId resolvido é o da loja impersonada. Assim
 * todas as actions de escrita já existentes operam dentro da loja sem alteração.
 *
 * Lança UnauthorizedError se não há sessão ou loja associada.
 */
export async function requireAuthContext(): Promise<AuthContext> {
  const user = await getAuthUser();
  if (!user) throw new UnauthorizedError();

  let tenantId = await getUserTenantId(user.id);

  if (!tenantId) {
    const impersonated = await getImpersonatedTenantId();
    if (impersonated && (await selectIsFounder(user.id))) {
      tenantId = impersonated;
    }
  }

  if (!tenantId) {
    throw new UnauthorizedError("Usuário sem loja associada");
  }

  return { userId: user.id, tenantId };
}
