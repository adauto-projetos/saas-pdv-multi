import { date, integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenants";

/**
 * Contador sequencial de pedidos de cozinha por tenant por dia (RN02).
 *
 * PK composta `(tenant_id, date)` — uma linha por tenant por dia.
 * O incremento é feito via upsert atômico:
 *   INSERT INTO kitchen_order_seqs (tenant_id, date, seq)
 *   VALUES ($tenantId, $date, 1)
 *   ON CONFLICT (tenant_id, date) DO UPDATE SET seq = kitchen_order_seqs.seq + 1
 *   RETURNING seq;
 *
 * O caller converte o instante para UTC-3 antes de passar a data, garantindo
 * o reset diário alinhado ao fuso horário local (RN02).
 *
 * Sem surrogate id — a PK composta é suficiente; sem join com outras tabelas.
 * Permissões app_user: SELECT + INSERT + UPDATE (upsert requer UPDATE).
 * Isolada por tenant via RLS (RN01).
 */
export const kitchenOrderSeqs = pgTable(
  "kitchen_order_seqs",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // Data local do tenant (UTC-3). Tipo `date` armazena só a data sem timezone.
    date: date("date").notNull(),
    // Número atual do pedido do dia — começa em 1, incrementa atomicamente.
    seq: integer("seq").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.date] }),
  ],
);

export type KitchenOrderSeq = typeof kitchenOrderSeqs.$inferSelect;
export type NewKitchenOrderSeq = typeof kitchenOrderSeqs.$inferInsert;
