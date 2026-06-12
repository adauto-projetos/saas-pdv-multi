import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";

/**
 * Cliente cadastrado no tenant. `name` é obrigatório (RN09). Isolada por
 * tenant (RN01) — um cliente só existe dentro de um estabelecimento.
 */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("customers_tenant_idx").on(t.tenantId),
    index("customers_tenant_name_idx").on(t.tenantId, t.name),
  ],
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
