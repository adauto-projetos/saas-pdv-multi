"use server";

import { requireAuthContext } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/permissions";
import { getAuditByPeriod } from "@/lib/services/audit/audit-service";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import { auditFilterSchema } from "@/lib/validation/auditoria";
import type { AuditReportDto } from "@/types/audit";

/**
 * RF01/RF03 — relatório de auditoria por operador/período. Gated por
 * `gerenciar_usuarios` (owner sempre passa). Filtro inválido cai no default.
 */
export async function getAuditAction(
  filter?: unknown,
): Promise<ActionResult<AuditReportDto>> {
  const parsed = auditFilterSchema.safeParse(filter ?? {});
  const data = parsed.success ? parsed.data : {};
  try {
    const ctx = await requireAuthContext();
    await requirePermission(ctx, "gerenciar_usuarios");
    return { ok: true, data: await getAuditByPeriod(ctx, data) };
  } catch (error) {
    return toActionError(error);
  }
}
