import { sql } from "drizzle-orm";

import { db } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  ConflictError,
  isUniqueViolation,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/services/errors";
import {
  assertCanGrant,
  replacePermissions,
} from "@/lib/services/permissions/permission-service";
import {
  insertPermissions,
  selectPermissionCodes,
} from "@/lib/services/permissions/permission-data";
import type {
  ChangeOwnPasswordInput,
  CreateOperatorInput,
  ResetOperatorPasswordInput,
  UpdateOperatorInput,
  UpdateOperatorPermissionsInput,
} from "@/lib/validation/usuarios";
import type { AuthContext } from "@/types/product";
import type { OperatorDto } from "@/types/usuarios";

import { getMaxOperators } from "@/lib/services/platform/settings-repository";

import {
  countActiveOperators,
  insertOperatorTx,
  selectMember,
  selectOperators,
  selectUserByEmail,
  selectUserPasswordHash,
  setMemberActive,
  updateUserNameEmail,
  updateUserPassword,
} from "./operator-data";

/**
 * Serviço de operadores (0014F/SF01). Hierarquia e anti-escalonamento são regra de
 * negócio aqui (não SQL): owner intocável (RF12), sem auto-desativar (RN05), ≥1
 * permissão (RN02), concedente só concede o que tem (RF13, via permission-service).
 * Roda na conexão `db` (owner) — o gate `gerenciar_usuarios` está na action.
 */

/**
 * Garante que `targetUserId` é um operador editável deste tenant. Bloqueia o owner
 * (RF12) e alvo inexistente. Retorna o vínculo.
 */
async function assertEditableOperator(
  ctx: AuthContext,
  targetUserId: string,
): Promise<{ role: string; isActive: boolean }> {
  const member = await selectMember(ctx.tenantId, targetUserId);
  if (!member) throw new NotFoundError("Operador não encontrado");
  if (member.role === "owner") {
    throw new UnauthorizedError("O dono da loja não pode ser editado ou desativado");
  }
  return member;
}

/** Lista owner + operadores da loja com suas permissões (RF03/menu de gestão). */
export async function listOperators(ctx: AuthContext): Promise<OperatorDto[]> {
  const rows = await selectOperators(ctx.tenantId);
  return Promise.all(
    rows.map(async (row) => {
      const isOwnerRow = row.role === "owner";
      return {
        userId: row.userId,
        name: row.name,
        email: row.email,
        role: row.role,
        isOwner: isOwnerRow,
        isActive: row.isActive,
        // Owner tem tudo implícito; não lemos linhas (não existem) — UI mostra "todas".
        permissions: isOwnerRow
          ? []
          : await selectPermissionCodes(ctx.tenantId, row.userId),
        createdAt: row.createdAt.toISOString(),
      };
    }),
  );
}

/**
 * Cria um operador (RF03/RN02): usuário + vínculo `operator` ativo + permissões,
 * tudo numa transação. Email único global (RF04). Anti-escalonamento via
 * assertCanGrant (RF13). O hook de limite por plano entra em SF03.
 */
export async function createOperator(
  ctx: AuthContext,
  input: CreateOperatorInput,
): Promise<OperatorDto> {
  if (input.permissions.length === 0) {
    throw new ValidationError("Selecione ao menos uma permissão");
  }
  await assertCanGrant(ctx, input.permissions);

  const existing = await selectUserByEmail(input.email);
  if (existing) {
    throw new ConflictError("Já existe um usuário com esse e-mail", "email");
  }

  // Teto de operadores por loja (SF03): conta + insert na MESMA transação
  // (atômico contra concorrência, RNF01). Owner não conta; desativado não conta.
  const maxOperators = await getMaxOperators();

  const passwordHash = await hashPassword(input.password);
  let userId: string;
  try {
    userId = await db.transaction(async (tx) => {
      // Serializa criações concorrentes do MESMO tenant (RNF01): o lock de transação
      // garante que duas requisições simultâneas não contem o mesmo slot e excedam
      // o teto. Liberado automaticamente no commit/rollback.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${"operator_limit:" + ctx.tenantId}))`,
      );
      const activeCount = await countActiveOperators(ctx.tenantId, tx);
      if (activeCount >= maxOperators) {
        throw new ConflictError(
          `Limite de ${maxOperators} operador(es) atingido. Desative um operador ou aumente o limite no plano.`,
        );
      }
      const id = await insertOperatorTx(tx, ctx.tenantId, {
        name: input.name,
        email: input.email,
        passwordHash,
      });
      await insertPermissions(
        tx,
        ctx.tenantId,
        id,
        input.permissions,
        ctx.userId,
      );
      return id;
    });
  } catch (error) {
    // Corrida: dois cadastros simultâneos com o mesmo e-mail passam o pré-check
    // mas o DB lança unique violation em users.email — converte para ConflictError.
    if (isUniqueViolation(error)) {
      throw new ConflictError("Já existe um usuário com esse e-mail", "email");
    }
    throw error;
  }

  return {
    userId,
    name: input.name,
    email: input.email.toLowerCase(),
    role: "operator",
    isOwner: false,
    isActive: true,
    permissions: input.permissions,
    createdAt: new Date().toISOString(),
  };
}

/** Edita nome/email do operador (RF12: owner intocável; RF04: email único). */
export async function updateOperator(
  ctx: AuthContext,
  input: UpdateOperatorInput,
): Promise<void> {
  await assertEditableOperator(ctx, input.userId);
  const existing = await selectUserByEmail(input.email);
  if (existing && existing.id !== input.userId) {
    throw new ConflictError("Já existe um usuário com esse e-mail", "email");
  }
  try {
    await updateUserNameEmail(input.userId, input.name, input.email);
  } catch (error) {
    // Corrida: dois updates simultâneos com o mesmo e-mail — converte unique
    // violation do banco em ConflictError legível (RF04).
    if (isUniqueViolation(error)) {
      throw new ConflictError("Já existe um usuário com esse e-mail", "email");
    }
    throw error;
  }
}

/** Regrava as permissões do operador (RF05/RF12/RF13). */
export async function updateOperatorPermissions(
  ctx: AuthContext,
  input: UpdateOperatorPermissionsInput,
): Promise<void> {
  // Ninguém edita as próprias permissões (RN05 — defesa explícita além do
  // anti-escalonamento de assertCanGrant). Espelha o guard de auto-desativação.
  if (input.userId === ctx.userId) {
    throw new UnauthorizedError("Você não pode editar as próprias permissões");
  }
  await assertEditableOperator(ctx, input.userId);
  await replacePermissions(ctx, input.userId, input.permissions);
}

/**
 * Desativa o operador (RF14): soft-delete (`is_active=false`), preserva registro e
 * autoria. Bloqueia desativar o owner (RF12) e a si mesmo (RN05).
 */
export async function deactivateOperator(
  ctx: AuthContext,
  targetUserId: string,
): Promise<void> {
  if (targetUserId === ctx.userId) {
    throw new UnauthorizedError("Você não pode desativar a si mesmo");
  }
  await assertEditableOperator(ctx, targetUserId);
  await setMemberActive(ctx.tenantId, targetUserId, false);
}

/** Reativa o operador (RF16): `is_active=true`, permissões preservadas. */
export async function reactivateOperator(
  ctx: AuthContext,
  targetUserId: string,
): Promise<void> {
  await assertEditableOperator(ctx, targetUserId);
  await setMemberActive(ctx.tenantId, targetUserId, true);
}

/** Dono reseta a senha do operador para uma nova provisória (RF08/RN03). */
export async function resetOperatorPassword(
  ctx: AuthContext,
  input: ResetOperatorPasswordInput,
): Promise<void> {
  await assertEditableOperator(ctx, input.userId);
  const passwordHash = await hashPassword(input.password);
  await updateUserPassword(input.userId, passwordHash);
}

/** Operador troca a própria senha em "Meu perfil" (RF08/RN03). */
export async function changeOwnPassword(
  ctx: AuthContext,
  input: ChangeOwnPasswordInput,
): Promise<void> {
  const currentHash = await selectUserPasswordHash(ctx.userId);
  if (!currentHash || !(await verifyPassword(input.currentPassword, currentHash))) {
    throw new ValidationError("Senha atual incorreta", {
      currentPassword: "Senha atual incorreta",
    });
  }
  const passwordHash = await hashPassword(input.newPassword);
  await updateUserPassword(ctx.userId, passwordHash);
}
