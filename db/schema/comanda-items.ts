import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { comandas } from "./comandas";
import { products } from "./products";
import { tenants } from "./tenants";

/**
 * Item de uma comanda. Armazena produto + quantidade + observação livre (RN11).
 *
 * Sem colunas de preço ou custo — snapshot é tirado apenas no fechamento (RN05).
 * O total parcial informativo (RF05) é calculado na leitura via JOIN com `products`
 * usando o preço corrente (não o do lançamento).
 *
 * `product_id` é ON DELETE SET NULL: se o produto for removido, o item de comanda
 * sobrevive (sem snapshots aqui — o nome/preço fica indisponível, tratado no serviço).
 * `comanda_id` é ON DELETE CASCADE: apagar a comanda remove todos os seus itens.
 *
 * `tenant_id` repetido para a RLS ser uniforme (política baseada em tenant_id,
 * sem join com comandas). Isolada por tenant (RN01).
 */
export const comandaItems = pgTable(
  "comanda_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    comandaId: uuid("comanda_id")
      .notNull()
      .references(() => comandas.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
    // Observação livre por item (RN11): ex "sem cebola", "bem passado".
    // Texto puro — não afeta preço, custo ou cálculo de total.
    observation: text("observation"),
  },
  (t) => [
    check("comanda_items_quantity_positive", sql`${t.quantity} > 0`),
    // Busca de itens por comanda (lançar/remover/close).
    index("comanda_items_comanda_idx").on(t.comandaId),
    // RLS uniforme por tenant (política aplica sem join).
    index("comanda_items_tenant_idx").on(t.tenantId),
  ],
);

export type ComandaItem = typeof comandaItems.$inferSelect;
export type NewComandaItem = typeof comandaItems.$inferInsert;
