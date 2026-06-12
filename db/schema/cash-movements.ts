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

import { cashSessions } from "./cash-sessions";
import { sales } from "./sales";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Ledger assinado do caixa físico. `amount_cents` é o **delta assinado**
 * (entrada +, saída −) — assim `SUM(amount_cents)` é o saldo corrente (RN05).
 * Espelha o padrão de `stock_movements` (ledger assinado + CHECK de sinal).
 *
 * `receivable_payment_id` / `payable_payment_id` são UUIDs simples SEM
 * .references() — as tabelas `receivable_payments` e `payable_payments`
 * referenciam `cash_movements`, não o contrário (FK circular seria inviável).
 * O vínculo é consultado via JOIN na leitura.
 *
 * Isolada por tenant (RN01).
 */
export const cashMovements = pgTable(
  "cash_movements",
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
    amountCents: integer("amount_cents").notNull(),
    type: text("type").notNull(),
    description: text("description"),
    origin: text("origin").notNull(),
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
    // UUIDs sem FK declarada — receivable_payments/payable_payments referenciam
    // cash_movements (não o inverso). FK circular causaria erro de bootstrap.
    receivablePaymentId: uuid("receivable_payment_id"),
    payablePaymentId: uuid("payable_payment_id"),
    // Vínculo ao turno de caixa aberto no momento da movimentação (RF05).
    // null = movimentação sem turno (ex: movimentos anteriores à feature 0005F).
    sessionId: uuid("session_id").references(() => cashSessions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "cash_movements_type_valid",
      sql`${t.type} in ('entrada', 'saida')`,
    ),
    check(
      "cash_movements_origin_valid",
      sql`${t.origin} in ('venda', 'recebimento', 'pagamento', 'manual')`,
    ),
    // Sinal coerente com o tipo: entrada positiva, saída negativa (espelha
    // stock_movements_quantity_sign). Garante integridade do ledger (RN05).
    check(
      "cash_movements_amount_sign",
      sql`(${t.type} = 'entrada' AND ${t.amountCents} > 0) OR (${t.type} = 'saida' AND ${t.amountCents} < 0)`,
    ),
    index("cash_movements_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("cash_movements_tenant_idx").on(t.tenantId),
  ],
);

export type CashMovement = typeof cashMovements.$inferSelect;
export type NewCashMovement = typeof cashMovements.$inferInsert;
