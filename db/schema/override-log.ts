import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Log de uso do override de ação sensível (0014F/SF02). Uma linha por liberação
 * bem-sucedida: o operador (`actor`) executou a ação após um Administrador
 * (`authorizer`) confirmar a senha. A AUTORIA da ação original permanece com o
 * operador (não é alterada) — este log é só a trilha de auditoria de QUEM liberou.
 *
 * `target_ref` guarda a referência do alvo (ex.: comanda id, cash_session id) como
 * texto livre. RLS por tenant em db/migrations/0011_override_rls.sql (RNF01); a
 * restrição de leitura a owner/`gerenciar_usuarios` é da camada de serviço (SF04).
 */
export const overrideLog = pgTable("override_log", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  // Operador que executou a ação (autoria real). set null preserva o log.
  actorUserId: uuid("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  // Administrador que autorizou (confirmou a senha). set null preserva o log.
  authorizerUserId: uuid("authorizer_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  actionCode: text("action_code").notNull(),
  targetRef: text("target_ref"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type OverrideLog = typeof overrideLog.$inferSelect;
export type NewOverrideLog = typeof overrideLog.$inferInsert;
