import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { sales } from "./sales";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Comanda (conta aberta). Representa uma conta de atendimento de mesa/cliente:
 * abre com rótulo livre ("Mesa 3", "João"), recebe itens ao longo do tempo
 * (via `comanda_items`) e fecha gerando uma venda (`sales`).
 *
 * Lifecycle: 'aberta' → 'fechada' | 'cancelada'. Imutável após fechar/cancelar
 * (RN06). Várias comandas abertas por tenant simultaneamente (RN04 — sem
 * unique parcial em status, diferente de cash_sessions).
 *
 * `sale_id` é o back-link para a venda criada no fechamento. `opened_by` e
 * `closed_by` rastreiam o operador responsável (RN10). Isolada por tenant (RN01).
 */
export const comandas = pgTable(
  "comandas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    status: text("status").notNull().default("aberta"),
    openedBy: uuid("opened_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedBy: uuid("closed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // Back-link para a venda criada no fechamento (RF06). SET NULL se a venda
    // for removida (sem referência circular: sales não referencia comandas via
    // NOT NULL). Null enquanto a comanda está aberta ou cancelada.
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
  },
  (t) => [
    check(
      "comandas_status_valid",
      sql`${t.status} in ('aberta', 'fechada', 'cancelada')`,
    ),
    // RNF01: listar comandas abertas rapidamente por tenant.
    index("comandas_tenant_status_idx").on(t.tenantId, t.status),
    // Histórico de comandas por tenant ordenado por abertura.
    index("comandas_tenant_opened_at_idx").on(t.tenantId, t.openedAt),
    // RN04: SEM unique parcial em status — várias comandas abertas por tenant.
  ],
);

export type Comanda = typeof comandas.$inferSelect;
export type NewComanda = typeof comandas.$inferInsert;
