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
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
