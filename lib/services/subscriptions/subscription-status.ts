export type TenantStatus = "testando" | "ativa" | "travada";

/**
 * Função pura — sem I/O, sem efeitos colaterais.
 * Deriva o status da loja a partir dos campos do tenant + flag hasRenewed.
 *
 * RN02: avalia 'travada' primeiro (suspended_at preenchido OU valid_until+2d < now),
 * depois distingue testando/ativa pelo histório de renovações.
 * RN03: suspended_at sempre ganha, independente de valid_until.
 */
export function getTenantStatus(
  tenant: { validUntil: Date | null; suspendedAt: Date | null },
  hasRenewed: boolean,
): TenantStatus {
  const now = new Date();

  // RN03: suspensão manual tem prioridade absoluta.
  if (tenant.suspendedAt !== null) return "travada";

  // RN02: verifica carência de 2 dias após valid_until.
  if (tenant.validUntil !== null) {
    const grace = new Date(tenant.validUntil.getTime() + 2 * 24 * 60 * 60 * 1000);
    if (grace < now) return "travada";
  }

  // Não está travada: distingue testando vs ativa pelo histórico de renovação.
  return hasRenewed ? "ativa" : "testando";
}

/**
 * Retorna quantos dias faltam até valid_until (negativo = já expirou).
 * Usado pelo layout para calcular daysLeft sem chamar Date.now() no componente.
 */
export function getDaysUntilExpiry(validUntil: Date): number {
  const msLeft = validUntil.getTime() - new Date().getTime();
  return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
}

// `selectHasRenewed` (query de I/O) vive em `repository.ts` — este módulo é puro.
