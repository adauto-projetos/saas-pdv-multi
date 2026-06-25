import { AppError } from "@/lib/services/errors";
import {
  selectHasRenewed,
  selectTenantById,
} from "@/lib/services/subscriptions/repository";
import { getTenantStatus } from "@/lib/services/subscriptions/subscription-status";

export class TenantLockedError extends AppError {
  constructor(
    message = "Loja travada — entre em contato para reativar: WhatsApp 13 99130-6911",
  ) {
    super(message, "TENANT_LOCKED");
  }
}

/**
 * RF02: lê o tenant via owner db (sem RLS) e lança TenantLockedError se status='travada'.
 * Deve ser chamado DEPOIS de requireAuthContext() e ANTES de withUserRls() em toda
 * action de escrita. RNF01: PK lookup — resolve em < 50ms.
 */
export async function requireActiveTenant(tenantId: string): Promise<void> {
  const tenant = await selectTenantById(tenantId);
  if (!tenant) throw new TenantLockedError();
  const hasRenewed = await selectHasRenewed(tenantId);
  const status = getTenantStatus(tenant, hasRenewed);
  if (status === "travada") throw new TenantLockedError();
}
