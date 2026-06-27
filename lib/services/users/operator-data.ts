import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { tenantMembers, users } from "@/db/schema";

/**
 * Data layer de operadores (0014F/SF01). Roda na conexão `db` (owner) — listar e
 * editar operadores cruza linhas de outros membros do tenant, que a RLS
 * não-recursiva de tenant_members não exporia via withUserRls. Filtro por tenant
 * sempre explícito; o gate de autorização vive na action (`gerenciar_usuarios`).
 */

type Exec = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type OperatorRow = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
};

/** Membro (vínculo) de um usuário num tenant, ou null. */
export async function selectMember(
  tenantId: string,
  userId: string,
): Promise<{ role: string; isActive: boolean } | null> {
  const [row] = await db
    .select({ role: tenantMembers.role, isActive: tenantMembers.isActive })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Lista todos os membros da loja (owner + operadores), com dados do usuário. */
export async function selectOperators(
  tenantId: string,
): Promise<OperatorRow[]> {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: tenantMembers.role,
      isActive: tenantMembers.isActive,
      createdAt: tenantMembers.createdAt,
    })
    .from(tenantMembers)
    .innerJoin(users, eq(users.id, tenantMembers.userId))
    .where(eq(tenantMembers.tenantId, tenantId))
    .orderBy(desc(tenantMembers.createdAt));
}

/** Usuário global por email (checagem de unicidade na criação, RF04). */
export async function selectUserByEmail(email: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

/**
 * Cria usuário + vínculo `operator` ativo numa transação (RF03). Retorna o userId.
 * As permissões são gravadas pelo serviço dentro da MESMA transação (atômico).
 */
export async function insertOperatorTx(
  exec: Exec,
  tenantId: string,
  input: { name: string; email: string; passwordHash: string },
): Promise<string> {
  const [user] = await exec
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
    })
    .returning({ id: users.id });
  await exec.insert(tenantMembers).values({
    tenantId,
    userId: user.id,
    role: "operator",
    isActive: true,
  });
  return user.id;
}

/** Atualiza nome/email do usuário (edição cadastral). */
export async function updateUserNameEmail(
  userId: string,
  name: string,
  email: string,
): Promise<void> {
  await db
    .update(users)
    .set({ name, email: email.toLowerCase() })
    .where(eq(users.id, userId));
}

/** Atualiza a senha (hash bcrypt) do usuário (reset pelo dono / troca própria). */
export async function updateUserPassword(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

/** Hash de senha atual do usuário (para conferir na troca própria). */
export async function selectUserPasswordHash(
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.passwordHash ?? null;
}

/** Ativa/desativa o vínculo do operador no tenant (soft-delete, RF14/RF16). */
export async function setMemberActive(
  tenantId: string,
  userId: string,
  isActive: boolean,
): Promise<void> {
  await db
    .update(tenantMembers)
    .set({ isActive, updatedAt: new Date() })
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, userId),
      ),
    );
}

/**
 * Conta operadores (role='operator') ativos no tenant — gate do limite (SF03).
 * Owner não conta (role='owner'); desativado não conta. Aceita um executor para
 * rodar na MESMA transação do insert (atômico contra concorrência, RNF01).
 */
export async function countActiveOperators(
  tenantId: string,
  exec: Exec = db,
): Promise<number> {
  const rows = await exec
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.role, "operator"),
        eq(tenantMembers.isActive, true),
      ),
    );
  return rows.length;
}
