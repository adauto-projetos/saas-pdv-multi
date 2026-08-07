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

export interface SubscriptionBanners {
  showLocked: boolean;
  showWarning: boolean;
  showTrial: boolean;
  daysLeft: number;
}

/**
 * Função pura — decide QUAIS banners de assinatura o layout mostra (RF04).
 *
 * `validUntil === null` significa **sem vencimento** (loja legada ou seed —
 * ver `db/schema/tenants.ts`; também a cópia local de {{doc:0026F}}, onde a
 * trava de assinatura é removida). Isso NUNCA pode virar aviso de expiração:
 * antes, `daysLeft` ficava no default `0` e a checagem `daysLeft <= 3` dava
 * verdadeiro, exibindo "Seu período expira hoje" para uma loja que, na
 * verdade, nunca expira. Por isso o aviso agora exige `validUntil` presente.
 *
 * Impersonando, nenhum banner de assinatura da loja-alvo aparece — eles são do
 * contexto do dono, não do suporte do super admin.
 */
export function resolveSubscriptionBanners(params: {
  status: TenantStatus | null;
  validUntil: Date | null;
  impersonating: boolean;
}): SubscriptionBanners {
  const { status, validUntil, impersonating } = params;

  const daysLeft =
    validUntil !== null && status !== "travada"
      ? getDaysUntilExpiry(validUntil)
      : 0;

  if (impersonating || status === null) {
    return { showLocked: false, showWarning: false, showTrial: false, daysLeft };
  }

  const showLocked = status === "travada";
  // Sem vencimento (validUntil null) => nunca avisa expiração.
  const showWarning = !showLocked && validUntil !== null && daysLeft <= 3;
  // Em teste e com folga (> 3 dias): banner informativo. Na reta final o aviso
  // âmbar acima assume.
  const showTrial = status === "testando" && !showWarning && daysLeft > 0;

  return { showLocked, showWarning, showTrial, daysLeft };
}

// `selectHasRenewed` (query de I/O) vive em `repository.ts` — este módulo é puro.
