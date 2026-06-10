import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { products } from "./products";
import { sales } from "./sales";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Movimentação de estoque. `quantity` é o **delta assinado** aplicado ao
 * `products.stock_quantity` (entrada +, saída −, ajuste = contagem − atual) — assim
 * a soma audita o estoque e o histórico mostra +/-. `sale_id` referencia a venda de
 * origem quando a saída vem de uma venda (RN08). Isolada por tenant (RN01).
 */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
    reason: text("reason"),
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "stock_movements_type_valid",
      sql`${t.type} in ('entrada', 'saida', 'ajuste')`,
    ),
    // Sinal coerente com o tipo: entrada soma, saída subtrai, ajuste é livre.
    check(
      "stock_movements_quantity_sign",
      sql`${t.type} = 'ajuste' or (${t.type} = 'entrada' and ${t.quantity} > 0) or (${t.type} = 'saida' and ${t.quantity} < 0)`,
    ),
    index("stock_movements_tenant_product_created_idx").on(
      t.tenantId,
      t.productId,
      t.createdAt,
    ),
    index("stock_movements_tenant_idx").on(t.tenantId),
  ],
);

export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
