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
import { payables } from "./payables";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Pagamento de conta a pagar. `amount_cents` deve ser positivo (RN02).
 * `cash_movement_id` é populado quando `method='dinheiro'` — vínculo ao
 * lançamento de saída de caixa gerado atomicamente (RNF02/RN08). Pagamentos
 * são imutáveis: só INSERT, nunca UPDATE/DELETE (RN10). Isolada por tenant (RN01).
 */
export const payablePayments = pgTable(
  "payable_payments",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    payableId: uuid("payable_id")
      .notNull()
      .references(() => payables.id, { onDelete: "cascade" }),
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
      "payable_payments_amount_positive",
      sql`${t.amountCents} > 0`,
    ),
    check(
      "payable_payments_method_valid",
      sql`${t.method} in ('dinheiro', 'pix', 'cartao')`,
    ),
    index("payable_payments_tenant_payable_idx").on(t.tenantId, t.payableId),
  ],
);

export type PayablePayment = typeof payablePayments.$inferSelect;
export type NewPayablePayment = typeof payablePayments.$inferInsert;
