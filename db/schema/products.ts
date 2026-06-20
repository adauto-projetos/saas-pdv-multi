import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { tenants } from "./tenants";

/**
 * Produto. Dinheiro SEMPRE em centavos inteiros (`integer`) — evita drift de float
 * (convenção do CLAUDE.md). `cost_cents` e `markup_percent` são NULLABLE: dá pra
 * cadastrar sem custo, com preço direto (RF04/RN03). `price_is_manual` marca se o
 * preço foi digitado à mão, usado pelo aviso da RF06.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    barcode: text("barcode"),
    unit: text("unit").notNull(),
    costCents: integer("cost_cents"),
    markupPercent: numeric("markup_percent", { precision: 5, scale: 2 }),
    salePriceCents: integer("sale_price_cents").notNull(),
    priceIsManual: boolean("price_is_manual").notNull().default(false),
    // numeric(10,3): suporta `un` (1.000) e `kg` fracionário (0.500), precisão de grama.
    stockQuantity: numeric("stock_quantity", { precision: 10, scale: 3 })
      .notNull()
      .default("0"),
    // Nível mínimo de estoque (opcional) — dispara alerta de estoque baixo (RF06/RN06).
    minStock: numeric("min_stock", { precision: 10, scale: 3 }),
    emoji: text("emoji"),
    category: text("category"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // RN02: custo e preço de venda não negativos.
    check("products_cost_cents_non_negative", sql`${t.costCents} >= 0`),
    check(
      "products_sale_price_cents_non_negative",
      sql`${t.salePriceCents} >= 0`,
    ),
    // RF01: unidade restrita a 'un' | 'kg'.
    check("products_unit_valid", sql`${t.unit} in ('un', 'kg')`),
    // RN01: código de barras único POR tenant; vários sem código não conflitam.
    uniqueIndex("products_tenant_barcode_unique")
      .on(t.tenantId, t.barcode)
      .where(sql`${t.barcode} is not null`),
    // Todas as queries são tenant-scoped: índice no padrão de acesso primário.
    index("products_tenant_id_idx").on(t.tenantId),
  ],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
