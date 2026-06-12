import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { products } from "./products";
import { sales } from "./sales";
import { tenants } from "./tenants";

/**
 * Item de uma venda. Guarda SNAPSHOT do produto no momento da venda (RN02):
 * `name_snapshot` + `unit_price_cents` copiados — alteração futura de preço não
 * muda vendas passadas. `product_id` é ON DELETE SET NULL: se o produto for
 * apagado, o histórico da venda sobrevive. `tenant_id` repetido aqui para a RLS
 * ser uniforme (mesma política de `products`, sem join).
 */
export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    nameSnapshot: text("name_snapshot").notNull(),
    unit: text("unit").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    // Snapshot do custo unitário no momento da venda (RN03/RF01). null = produto
    // sem custo cadastrado (RN04): conta como 0 no cálculo de lucro e dispara
    // o aviso de itemsWithoutCost na ProfitSummaryCard.
    costCentsSnapshot: integer("cost_cents_snapshot"),
  },
  (t) => [
    check("sale_items_unit_price_non_negative", sql`${t.unitPriceCents} >= 0`),
    check("sale_items_subtotal_non_negative", sql`${t.subtotalCents} >= 0`),
    check("sale_items_quantity_positive", sql`${t.quantity} > 0`),
    check("sale_items_unit_valid", sql`${t.unit} in ('un', 'kg')`),
    check(
      "sale_items_cost_snapshot_non_negative",
      sql`${t.costCentsSnapshot} IS NULL OR ${t.costCentsSnapshot} >= 0`,
    ),
    index("sale_items_sale_idx").on(t.saleId),
    index("sale_items_tenant_idx").on(t.tenantId),
  ],
);

export type SaleItem = typeof saleItems.$inferSelect;
export type NewSaleItem = typeof saleItems.$inferInsert;
