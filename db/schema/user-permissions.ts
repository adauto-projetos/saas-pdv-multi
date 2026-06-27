import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Permissões granulares por operador (0014F/SF01). Modelo: a PRESENÇA da linha =
 * permissão concedida; revogar = deletar a linha (sem coluna `granted`/`is_active`
 * — evita duas fontes de verdade, RF02). `permission_code` é validado no app pelo
 * catálogo de 8 códigos (lib/validation/usuarios.ts) — coluna text, sem enum no DB
 * para o catálogo poder crescer sem migração (decisão do discovery, RN01).
 *
 * `granted_by` registra quem concedeu (autoria/anti-escalonamento). RLS por tenant
 * em db/migrations/0010_usuarios_rls.sql (RNF01).
 */
export const userPermissions = pgTable(
  "user_permissions",
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
    permissionCode: text("permission_code").notNull(),
    grantedBy: uuid("granted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("user_permissions_tenant_user_code_unique").on(
      t.tenantId,
      t.userId,
      t.permissionCode,
    ),
  ],
);

export type UserPermission = typeof userPermissions.$inferSelect;
export type NewUserPermission = typeof userPermissions.$inferInsert;
