import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { userPermissions } from "@/db/schema";
import type { PermissionCode } from "@/lib/validation/usuarios";

/**
 * Data layer de user_permissions (0014F/SF01). Roda na conexão `db` (owner) —
 * o CRUD de permissões cruza linhas de outros membros, que a RLS não-recursiva de
 * tenant_members não exporia via withUserRls (decisão do plan). Filtro por tenant
 * sempre explícito.
 */

/** Executor: a conexão `db` ou uma transação aberta sobre ela. */
type Exec = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Códigos concedidos a um usuário num tenant. */
export async function selectPermissionCodes(
  tenantId: string,
  userId: string,
  exec: Exec = db,
): Promise<PermissionCode[]> {
  const rows = await exec
    .select({ code: userPermissions.permissionCode })
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.tenantId, tenantId),
        eq(userPermissions.userId, userId),
      ),
    );
  return rows.map((r) => r.code as PermissionCode);
}

/** Insere as linhas de permissão concedidas (presença = concedida, RF02/RF05). */
export async function insertPermissions(
  exec: Exec,
  tenantId: string,
  userId: string,
  codes: PermissionCode[],
  grantedBy: string,
): Promise<void> {
  if (codes.length === 0) return;
  await exec.insert(userPermissions).values(
    codes.map((code) => ({
      tenantId,
      userId,
      permissionCode: code,
      grantedBy,
    })),
  );
}

/** Remove TODAS as permissões do usuário no tenant (usado antes de regravar). */
export async function deleteAllPermissions(
  exec: Exec,
  tenantId: string,
  userId: string,
): Promise<void> {
  await exec
    .delete(userPermissions)
    .where(
      and(
        eq(userPermissions.tenantId, tenantId),
        eq(userPermissions.userId, userId),
      ),
    );
}
