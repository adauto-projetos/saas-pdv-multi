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

import { customers } from "./customers";
import { sales } from "./sales";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Conta a receber (fiado de venda ou avulsa). `total_cents` é o valor total
 * da dívida; o saldo devedor é derivado na leitura: `total_cents − Σ
 * receivable_payments.amount_cents` — sem coluna de status armazenada (RN04).
 * `origin='venda'` quando gerada por `finalizeSale` (RF07); `origin='avulsa'`
 * quando criada manualmente (RF08). Isolada por tenant (RN01).
 */
export const receivables = pgTable(
  "receivables",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    totalCents: integer("total_cents").notNull(),
    description: text("description"),
    dueDate: date("due_date"),
    origin: text("origin").notNull(),
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("receivables_total_cents_non_negative", sql`${t.totalCents} >= 0`),
    check(
      "receivables_origin_valid",
      sql`${t.origin} in ('venda', 'avulsa')`,
    ),
    index("receivables_tenant_customer_idx").on(t.tenantId, t.customerId),
    index("receivables_tenant_due_date_idx").on(t.tenantId, t.dueDate),
  ],
);

export type Receivable = typeof receivables.$inferSelect;
export type NewReceivable = typeof receivables.$inferInsert;
