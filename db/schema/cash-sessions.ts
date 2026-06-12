import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Sessão de caixa (turno). Representa um turno de operação: abertura com saldo
 * inicial, movimentações vinculadas (via `cash_movements.session_id`) e
 * fechamento com contagem real da gaveta. `divergence_cents` = contado − esperado
 * (positivo = sobra, negativo = falta). Sessão é imutável após fechada (RN08).
 *
 * Partial UNIQUE INDEX `(tenant_id) WHERE status = 'aberta'` garante no banco
 * que nunca haverá dois turnos abertos ao mesmo tempo (RN09) — última linha de
 * defesa além do ConflictError no serviço.
 *
 * Isolada por tenant (RN01).
 */
export const cashSessions = pgTable(
  "cash_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    openingBalanceCents: integer("opening_balance_cents").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    openedBy: uuid("opened_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    // Contagem real da gaveta informada pelo operador no fechamento.
    countedCents: integer("counted_cents"),
    // Esperado = opening_balance + SUM(cash_movements.amount_cents WHERE session_id).
    expectedCents: integer("expected_cents"),
    // Divergência = contado − esperado (pode ser negativo = falta ou positivo = sobra).
    divergenceCents: integer("divergence_cents"),
    status: text("status").notNull().default("aberta"),
  },
  (t) => [
    check(
      "cash_sessions_opening_balance_non_negative",
      sql`${t.openingBalanceCents} >= 0`,
    ),
    check(
      "cash_sessions_counted_non_negative",
      sql`${t.countedCents} IS NULL OR ${t.countedCents} >= 0`,
    ),
    check(
      "cash_sessions_status_valid",
      sql`${t.status} in ('aberta', 'fechada')`,
    ),
    // RN09: uma sessão aberta por tenant — partial unique index no banco.
    uniqueIndex("cash_sessions_tenant_open_unique")
      .on(t.tenantId)
      .where(sql`${t.status} = 'aberta'`),
    // RNF01: histórico de sessões por tenant ordenado por abertura.
    index("cash_sessions_tenant_opened_at_idx").on(t.tenantId, t.openedAt),
  ],
);

export type CashSession = typeof cashSessions.$inferSelect;
export type NewCashSession = typeof cashSessions.$inferInsert;
