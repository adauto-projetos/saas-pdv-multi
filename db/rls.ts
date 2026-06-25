import { sql } from "drizzle-orm";

import { getImpersonatedTenantId } from "@/lib/auth/impersonation";
import { selectIsFounder } from "@/lib/services/subscriptions/repository";
import { db } from "./index";

/**
 * Transação Drizzle vinculada ao usuário, com a RLS ativa (multi-tenancy / RN05).
 *
 * Por que isto existe: o data layer usa Drizzle sobre uma conexão Postgres direta,
 * que roda como `postgres` (dono das tabelas) e IGNORA a RLS — vazaria dados entre
 * lojas. Aqui injetamos o id do usuário na GUC `app.current_user_id` e assumimos o
 * papel `app_user` (sem privilégio de bypass) por transação. Assim a função
 * `current_app_user()` resolve e as políticas (`tenant_isolation` etc.) filtram.
 *
 * Impersonação (SF03): se houver cookie de impersonação E o usuário for founder,
 * injetamos também a GUC `app.impersonate_tenant_id`. Aí `current_app_tenants()`
 * passa a incluir o tenant impersonado e o founder opera dentro da loja. A dupla
 * checagem (founder na app + `current_app_is_founder()` no SQL) garante que um
 * não-founder nunca ganhe acesso, mesmo com cookie forjado (RN01/RN03).
 *
 * `SET LOCAL`/`set_config(..., true)` garantem que papel/GUCs valem só dentro da
 * transação — nunca vazam entre conexões do pool (RN02).
 */
export async function withUserRls<T>(
  userId: string,
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  const impersonateTenantId = await resolveImpersonation(userId);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_user_id', ${userId}, true)`,
    );
    if (impersonateTenantId) {
      await tx.execute(
        sql`select set_config('app.impersonate_tenant_id', ${impersonateTenantId}, true)`,
      );
    }
    await tx.execute(sql`set local role app_user`);
    return fn(tx);
  });
}

/**
 * Resolve o tenant impersonado para esta requisição, ou null. Só faz a consulta
 * de founder (owner db) quando há cookie presente — no caso comum (sem cookie),
 * é apenas uma leitura de cookie, sem custo de DB no hot path.
 */
async function resolveImpersonation(userId: string): Promise<string | null> {
  const tenantId = await getImpersonatedTenantId();
  if (!tenantId) return null;
  const isFounder = await selectIsFounder(userId);
  return isFounder ? tenantId : null;
}

export type RlsTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
