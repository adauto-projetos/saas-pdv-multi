import { sql } from "drizzle-orm";
import {
  check,
  date,
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
 * Conta a pagar (despesa do estabelecimento). `total_cents` é o valor total;
 * saldo devedor derivado na leitura: `total_cents − Σ payable_payments.amount_cents`
 * (RN04). `category` é obrigatório (RF11). Pagamentos são imutáveis (RN10).
 * Isolada por tenant (RN01).
 */
export const payables = pgTable(
  "payables",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    totalCents: integer("total_cents").notNull(),
    dueDate: date("due_date"),
    category: text("category").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("payables_total_cents_non_negative", sql`${t.totalCents} >= 0`),
    index("payables_tenant_due_date_idx").on(t.tenantId, t.dueDate),
    index("payables_tenant_category_idx").on(t.tenantId, t.category),
  ],
);

export type Payable = typeof payables.$inferSelect;
export type NewPayable = typeof payables.$inferInsert;
