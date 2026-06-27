import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { tenantMembers, userPermissions } from "@/db/schema";
import { UnauthorizedError } from "@/lib/services/errors";
import { selectPermissionCodes } from "@/lib/services/permissions/permission-data";
import {
  PERMISSION_CODES,
  PERMISSION_LABELS,
  type PermissionCode,
} from "@/lib/validation/usuarios";
import type { AuthContext } from "@/types/product";

/**
 * Guard de autorização (0014F/SF01). Encaixa na action ENTRE `requireActiveTenant`
 * e o serviço (padrão fixo de `app/(app)/comandas/actions.ts`). Defesa em
 * profundidade: action (aqui) + menu filtrado + RLS (RNF02).
 *
 * Roda na conexão `db` (owner, bypassa RLS) filtrando explicitamente por
 * `ctx.tenantId` + `ctx.userId` — ambos resolvidos do servidor, nunca do cliente
 * (RN05). O owner (`tenant_members.role='owner'`) tem TODAS as permissões
 * implícitas, nunca gravadas (RF09/RF13).
 */
export async function hasPermission(
  ctx: AuthContext,
  code: PermissionCode,
): Promise<boolean> {
  // Founder impersonando a loja (0011F/SF03): acesso total para dar suporte,
  // mesmo sem vínculo em tenant_members. Espelha o `canSeeAll` do menu (0017H).
  if (ctx.isImpersonating) return true;

  const [member] = await db
    .select({ role: tenantMembers.role, isActive: tenantMembers.isActive })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, ctx.tenantId),
        eq(tenantMembers.userId, ctx.userId),
      ),
    )
    .limit(1);

  // Sem vínculo ativo nessa loja → sem permissão (defesa extra; a sessão já barra).
  if (!member || !member.isActive) return false;
  // Owner é supremo: todas as permissões implícitas (RF09).
  if (member.role === "owner") return true;

  const [perm] = await db
    .select({ id: userPermissions.id })
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.tenantId, ctx.tenantId),
        eq(userPermissions.userId, ctx.userId),
        eq(userPermissions.permissionCode, code),
      ),
    )
    .limit(1);

  return !!perm;
}

/**
 * Lança `UnauthorizedError` se o usuário não possui `code`. Owner sempre passa.
 * Usar em toda action de módulo protegido (RF10).
 */
export async function requirePermission(
  ctx: AuthContext,
  code: PermissionCode,
): Promise<void> {
  if (!(await hasPermission(ctx, code))) {
    throw new UnauthorizedError(
      `Permissão "${PERMISSION_LABELS[code]}" necessária para esta ação`,
    );
  }
}

/**
 * Lança se o usuário não possui NENHUM dos códigos. Para leituras compartilhadas
 * por mais de um perfil — ex.: a leitura do catálogo de produtos serve tanto a
 * quem gerencia produtos (`produtos`) quanto a quem vende no PDV (`caixa`).
 *
 * Faz uma única query em tenant_members (para checar role/isActive) + uma única
 * query em user_permissions com IN(codes) — evita N round-trips ao DB.
 */
export async function requireAnyPermission(
  ctx: AuthContext,
  codes: PermissionCode[],
): Promise<void> {
  // Founder impersonando: acesso total (0017H, ver hasPermission).
  if (ctx.isImpersonating) return;

  const [member] = await db
    .select({ role: tenantMembers.role, isActive: tenantMembers.isActive })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, ctx.tenantId),
        eq(tenantMembers.userId, ctx.userId),
      ),
    )
    .limit(1);

  if (!member || !member.isActive) {
    const labels = codes.map((c) => PERMISSION_LABELS[c]).join(" ou ");
    throw new UnauthorizedError(`Permissão "${labels}" necessária para esta ação`);
  }
  if (member.role === "owner") return;

  // Operador: verifica se possui ao menos um dos códigos em uma única query.
  const [perm] = await db
    .select({ id: userPermissions.id })
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.tenantId, ctx.tenantId),
        eq(userPermissions.userId, ctx.userId),
        inArray(userPermissions.permissionCode, codes),
      ),
    )
    .limit(1);

  if (perm) return;

  const labels = codes.map((c) => PERMISSION_LABELS[c]).join(" ou ");
  throw new UnauthorizedError(`Permissão "${labels}" necessária para esta ação`);
}

/** True se o usuário é o dono (`role='owner'`) da loja do contexto. */
export async function isOwner(ctx: AuthContext): Promise<boolean> {
  // Founder impersonando age como dono para fins de suporte (0017H).
  if (ctx.isImpersonating) return true;

  const [member] = await db
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, ctx.tenantId),
        eq(tenantMembers.userId, ctx.userId),
      ),
    )
    .limit(1);
  return member?.role === "owner";
}

/**
 * Conjunto de permissões para filtrar o menu (RF11). Owner recebe o catálogo
 * completo (tudo implícito); operador, só os códigos concedidos. Usado pelo layout
 * para renderizar `AppSidebar`/`BottomNav` só com os itens permitidos.
 */
export async function getNavPermissions(
  tenantId: string,
  userId: string,
): Promise<{ isOwner: boolean; codes: PermissionCode[] }> {
  const [member] = await db
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, userId),
      ),
    )
    .limit(1);

  if (member?.role === "owner") {
    return { isOwner: true, codes: [...PERMISSION_CODES] };
  }
  const codes = await selectPermissionCodes(tenantId, userId);
  return { isOwner: false, codes };
}
