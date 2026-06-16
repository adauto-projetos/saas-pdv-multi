import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Log de cada tentativa de impressão (audit trail append-only). Registra pedidos
 * de cozinha e cupons de venda — sucessos e falhas — para rastreabilidade e
 * reimpressão (RF08, RN01).
 *
 * `trigger_id` é uuid polimórfico sem FK declarada: aponta para `comanda_items.id`
 * quando `type='cozinha'` ou para `sales.id` quando `type='cupom'`. Mesmo padrão
 * de `sales.comanda_id` — evita ciclo de dependência TypeScript entre módulos.
 *
 * `printed_by` aponta para o usuário que disparou a impressão (garçom/operador),
 * com RESTRICT para preservar o log mesmo que o usuário seja desativado no futuro.
 *
 * Permissões app_user: SELECT + INSERT apenas (append-only, sem UPDATE/DELETE).
 * Isolada por tenant via RLS (RN01).
 */
export const printLogs = pgTable(
  "print_logs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // 'cozinha' = pedido de cozinha (trigger: addComandaItem); 'cupom' = recibo de venda.
    type: text("type").notNull(),
    // UUID polimórfico sem FK: comanda_items.id (cozinha) ou sales.id (cupom).
    // Sem .references() — dois targets possíveis (RF08, padrão de sales.comandaId).
    triggerId: uuid("trigger_id").notNull(),
    status: text("status").notNull().default("ok"),
    errorMessage: text("error_message"),
    printedAt: timestamp("printed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    printedBy: uuid("printed_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  (t) => [
    check(
      "print_logs_type_valid",
      sql`${t.type} in ('cozinha', 'cupom')`,
    ),
    check(
      "print_logs_status_valid",
      sql`${t.status} in ('ok', 'falhou')`,
    ),
    // Histórico de impressões por tenant ordenado por data (RF08, reimpressão).
    index("print_logs_tenant_printed_at_idx").on(t.tenantId, t.printedAt),
    // Busca de logs por trigger (reimpressão / rastrear por venda ou item).
    index("print_logs_tenant_type_trigger_idx").on(
      t.tenantId,
      t.type,
      t.triggerId,
    ),
  ],
);

export type PrintLog = typeof printLogs.$inferSelect;
export type NewPrintLog = typeof printLogs.$inferInsert;
