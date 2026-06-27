import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { overrideLog, tenantMembers, users } from "@/db/schema";
import type { RlsTx } from "@/db/rls";

/**
 * Data layer do override de ação sensível (0014F/SF02). A leitura do autorizador
 * roda na conexão `db` (owner): o autorizador NÃO é o usuário da sessão e a RLS
 * não-recursiva de tenant_members só exporia o próprio vínculo via withUserRls.
 * O INSERT do log roda sob withUserRls(ctx.userId) — o ator É o usuário da sessão.
 */

export type AuthorizerRow = {
  userId: string;
  role: string;
  isActive: boolean;
  passwordHash: string;
};

/**
 * Resolve um possível autorizador pelo email DENTRO do tenant (filtro explícito).
 * Retorna role/isActive/hash para a validação no serviço. Owner db.
 */
export async function selectAuthorizerByEmail(
  tenantId: string,
  email: string,
): Promise<AuthorizerRow | null> {
  const [row] = await db
    .select({
      userId: users.id,
      role: tenantMembers.role,
      isActive: tenantMembers.isActive,
      passwordHash: users.passwordHash,
    })
    .from(tenantMembers)
    .innerJoin(users, eq(users.id, tenantMembers.userId))
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(users.email, email.toLowerCase()),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Grava uma linha de override bem-sucedido (sob withUserRls do ator). */
export async function insertOverrideLog(
  tx: RlsTx,
  entry: {
    tenantId: string;
    actorUserId: string;
    authorizerUserId: string;
    actionCode: string;
    targetRef: string | null;
  },
): Promise<void> {
  await tx.insert(overrideLog).values(entry);
}
