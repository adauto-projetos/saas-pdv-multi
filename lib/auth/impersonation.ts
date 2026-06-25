import { cookies } from "next/headers";

/**
 * Impersonação do super admin (0011F SF03): o founder "entra" numa loja e passa a
 * operar o app como se fosse dono dela. O alvo é guardado num cookie httpOnly
 * (`pdv_impersonate` = tenant_id). O cookie SÓ produz efeito para usuários
 * `is_founder` — a checagem é feita na app (withUserRls/requireAuthContext) e
 * reforçada no banco por `current_app_is_founder()` (RN01/RN03, defesa em profundidade).
 */
const IMPERSONATE_COOKIE = "pdv_impersonate";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias (acompanha a sessão)

/**
 * Lê o tenant impersonado do cookie, ou null. Seguro fora de um contexto de
 * request (ex.: testes, scripts): `cookies()` lança nesse caso e tratamos como
 * "sem impersonação" (RF02).
 */
export async function getImpersonatedTenantId(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(IMPERSONATE_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/** Grava o cookie de impersonação (chamado por enterStoreAction após validar founder). */
export async function setImpersonation(tenantId: string): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATE_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
  });
}

/** Remove o cookie de impersonação (chamado por exitStoreAction). */
export async function clearImpersonation(): Promise<void> {
  const store = await cookies();
  store.delete(IMPERSONATE_COOKIE);
}
