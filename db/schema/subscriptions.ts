import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Audit trail append-only de cada mudança de estado de assinatura de um tenant.
 * Registra liberações, renovações, suspensões e cancelamentos de trial com os
 * valores de `valid_until` antes e depois de cada operação.
 *
 * `by_user_id` aponta para o usuário que realizou a ação (founder via SF02 ou
 * sistema no onboarding). ON DELETE SET NULL preserva o log mesmo se o usuário
 * for removido.
 *
 * Permissões app_user: SELECT + INSERT apenas (append-only, sem UPDATE/DELETE).
 * Isolada por tenant via RLS (RN04). A query `hasRenewed` filtra por
 * (tenant_id, action='renewed') — coberta pelo índice tenant_action.
 *
 * feature 0011F SF01.
 */
export const subscriptionLog = pgTable(
  "subscription_log",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Ação que gerou este registro. Conjunto fechado — ver check constraint abaixo.
    action: text("action").notNull(),
    // Snapshot do valid_until imediatamente antes da ação (null no trial_started inicial).
    validUntilBefore: timestamp("valid_until_before", { withTimezone: true }),
    // Valor de valid_until após a ação (null em suspensões manuais sem renovação).
    validUntilAfter: timestamp("valid_until_after", { withTimezone: true }),
    // Usuário que disparou a ação. Nullable: sistema no onboarding não tem user_id.
    byUserId: uuid("by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Quantos meses de calendário foram liberados nesta ação (0013F, RF05).
    // Nullable: linhas legadas e actions não-renew (suspended/released/trial) não têm meses.
    monthsReleased: integer("months_released"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Garante que só actions do domínio de assinatura sejam inseridas (RN04).
    check(
      "subscription_log_action_valid",
      sql`${t.action} in ('trial_started', 'renewed', 'suspended', 'released')`,
    ),
    // Histórico por tenant ordenado do mais recente ao mais antigo (leitura no painel SF02).
    index("subscription_log_tenant_at_idx").on(t.tenantId, t.at),
    // Filtro rápido para detectar hasRenewed (RN02: testando vs ativa).
    index("subscription_log_tenant_action_idx").on(t.tenantId, t.action),
  ],
);

export type SubscriptionLog = typeof subscriptionLog.$inferSelect;
export type NewSubscriptionLog = typeof subscriptionLog.$inferInsert;
