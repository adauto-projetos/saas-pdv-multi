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
 * Venda registrada no caixa. `total_cents` é a soma dos subtotais (recalculada no
 * servidor). `payment_method` é só um rótulo (sem integração). `user_id` é o
 * operador que fez a venda (RN08). Isolada por tenant (RN01).
 */
export const sales = pgTable(
  "sales",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    totalCents: integer("total_cents").notNull(),
    paymentMethod: text("payment_method").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("sales_total_cents_non_negative", sql`${t.totalCents} >= 0`),
    check(
      "sales_payment_method_valid",
      sql`${t.paymentMethod} in ('dinheiro', 'pix', 'cartao')`,
    ),
    // Lista de vendas do dia: filtro por tenant + data.
    index("sales_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);

export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;
