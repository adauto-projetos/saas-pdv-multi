import { db } from "@/db";
import { isOwner } from "@/lib/auth/permissions";
import { UnauthorizedError } from "@/lib/services/errors";
import {
  PERMISSION_LABELS,
  type PermissionCode,
} from "@/lib/validation/usuarios";
import type { AuthContext } from "@/types/product";

import {
  deleteAllPermissions,
  insertPermissions,
  selectPermissionCodes,
} from "./permission-data";

/**
 * Serviço de permissões (0014F/SF01). Anti-escalonamento (RF13/RN05): um concedente
 * só pode conceder códigos que ele PRÓPRIO possui; o owner concede qualquer um.
 */

/** Lança se o concedente (não-owner) tenta conceder um código que não possui. */
export async function assertCanGrant(
  ctx: AuthContext,
  codes: PermissionCode[],
): Promise<void> {
  if (await isOwner(ctx)) return;
  const ownCodes = new Set(await selectPermissionCodes(ctx.tenantId, ctx.userId));
  for (const code of codes) {
    if (!ownCodes.has(code)) {
      throw new UnauthorizedError(
        `Você não pode conceder a permissão "${PERMISSION_LABELS[code]}" porque não a possui`,
      );
    }
  }
}

/** Lista os códigos concedidos a um usuário no tenant. */
export function listPermissions(
  ctx: AuthContext,
  userId: string,
): Promise<PermissionCode[]> {
  return selectPermissionCodes(ctx.tenantId, userId);
}

/**
 * Regrava o conjunto de permissões de um operador (delete + insert atômico).
 * Valida o anti-escalonamento antes. `granted_by` = concedente atual (RF05).
 */
export async function replacePermissions(
  ctx: AuthContext,
  targetUserId: string,
  codes: PermissionCode[],
): Promise<void> {
  await assertCanGrant(ctx, codes);
  await db.transaction(async (tx) => {
    await deleteAllPermissions(tx, ctx.tenantId, targetUserId);
    await insertPermissions(tx, ctx.tenantId, targetUserId, codes, ctx.userId);
  });
}
