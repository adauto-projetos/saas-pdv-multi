import { sql } from "drizzle-orm";

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
 * `SET LOCAL` garante que papel/GUC valem só dentro da transação.
 */
export async function withUserRls<T>(
  userId: string,
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_user_id', ${userId}, true)`,
    );
    await tx.execute(sql`set local role app_user`);
    return fn(tx);
  });
}

export type RlsTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
