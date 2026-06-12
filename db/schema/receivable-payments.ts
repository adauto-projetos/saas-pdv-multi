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

import { cashMovements } from "./cash-movements";
import { receivables } from "./receivables";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Pagamento de conta a receber. `amount_cents` deve ser positivo (RN02).
 * `cash_movement_id` é populado quando `method='dinheiro'` — vínculo ao
 * lançamento de caixa gerado atomicamente (RNF02/RN08). Pagamentos são
 * imutáveis: só INSERT, nunca UPDATE/DELETE (RN10). Isolada por tenant (RN01).
 */
export const receivablePayments = pgTable(
  "receivable_payments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    receivableId: uuid("receivable_id")
      .notNull()
      .references(() => receivables.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    method: text("method").notNull(),
    cashMovementId: uuid("cash_movement_id").references(
      () => cashMovements.id,
      { onDelete: "set null" },
    ),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "receivable_payments_amount_positive",
      sql`${t.amountCents} > 0`,
    ),
    check(
      "receivable_payments_method_valid",
      sql`${t.method} in ('dinheiro', 'pix', 'cartao')`,
    ),
    index("receivable_payments_tenant_receivable_idx").on(
      t.tenantId,
      t.receivableId,
    ),
  ],
);

export type ReceivablePayment = typeof receivablePayments.$inferSelect;
export type NewReceivablePayment = typeof receivablePayments.$inferInsert;
