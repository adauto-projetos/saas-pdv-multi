import { sql } from "drizzle-orm";
import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Estabelecimento (loja). Raiz da multi-tenancy: todo dado de negócio aponta
 * para um tenant. `default_markup_percent` é a margem padrão pré-preenchida em
 * cada novo cadastro de produto (RF05).
 */
export const tenants = pgTable("tenants", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  // numeric(5,2): 0.00–999.99%. Decimal exato, sem drift de float (RF05).
  defaultMarkupPercent: numeric("default_markup_percent", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("30.00"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Ciclo de vida de assinatura (feature 0011F SF01):
  // valid_until: data até quando a loja está paga/em trial. Nullable — lojas
  // legadas e seeds de teste não têm valid_until até o primeiro trial ser criado.
  validUntil: timestamp("valid_until", { withTimezone: true }),
  // suspended_at: preenchido manualmente pelo founder para forçar status 'travada'
  // independente de valid_until (RN03). Null = não suspensa manualmente.
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
