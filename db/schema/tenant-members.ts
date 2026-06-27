import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Vínculo usuário → tenant. É a tabela que a RLS consulta para descobrir a quais
 * lojas o usuário da sessão pertence (`current_app_user()`). Criada no onboarding
 * de signup junto com o tenant (RN05).
 */
export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    // soft-delete de operadores (RF14/0014F): desativar não apaga o registro,
    // preservando a autoria histórica (sales.userId etc.). Barrado na sessão.
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("tenant_members_tenant_user_unique").on(t.tenantId, t.userId)],
);

export type TenantMember = typeof tenantMembers.$inferSelect;
export type NewTenantMember = typeof tenantMembers.$inferInsert;
