import { withUserRls } from "@/db/rls";
import { NotFoundError } from "@/lib/services/errors";
import {
  selectTenantDefaultMarkup,
  updateTenantDefaultMarkup,
} from "@/lib/services/products/data";
import type { AuthContext, TenantSettingsDto } from "@/types/product";

/** RF05 — lê a margem padrão da loja (pré-preenche o form de novo produto). */
export async function getDefaultMarkup(
  ctx: AuthContext,
): Promise<TenantSettingsDto> {
  const percent = await withUserRls(ctx.userId, (tx) =>
    selectTenantDefaultMarkup(tx, ctx.tenantId),
  );
  if (percent == null) throw new NotFoundError("Loja não encontrada");
  return { tenantId: ctx.tenantId, defaultMarkupPercent: percent };
}

/** RF05 — atualiza a margem padrão da loja. */
export async function updateDefaultMarkup(
  ctx: AuthContext,
  percent: number,
): Promise<TenantSettingsDto> {
  const result = await withUserRls(ctx.userId, (tx) =>
    updateTenantDefaultMarkup(tx, ctx.tenantId, percent),
  );
  if (!result) throw new NotFoundError("Loja não encontrada");
  return result;
}
