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

/**
 * Categoria de produto, criada e gerenciada pelo próprio tenant (feature
 * 0025F). `color` guarda o slug de uma paleta pré-definida (CATEGORY_PALETTE
 * em lib/validation/product.ts) — nunca hex livre, então rename não perde cor
 * (RN05). `position` é a ordem manual que select/chips seguem (RF06).
 *
 * Unicidade de `name` é POR tenant (RN01), mesmo precedente do código de
 * barras ({{doc:0001F}}). O índice único abaixo é o backstop exato no banco;
 * a comparação sem diferenciar maiúsculas/acentos (e o nome reservado "Sem
 * categoria", RN06) é validada na service layer, pois o projeto não tem
 * `unaccent`/`citext` configurado.
 */
export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Todas as queries são tenant-scoped: índice no padrão de acesso primário.
    index("product_categories_tenant_idx").on(t.tenantId),
    // RN01: nome único POR tenant — backstop exato (case/acento no service).
    uniqueIndex("product_categories_tenant_name_unique").on(
      t.tenantId,
      t.name,
    ),
    // RN05: slug restrito à CATEGORY_PALETTE (lib/validation/product.ts) —
    // lista duplicada aqui de propósito (schema não importa camada externa),
    // mesmo trade-off de products_unit_valid ('un'|'kg' vs productUnitSchema).
    check(
      "product_categories_color_valid",
      sql`${t.color} in ('azul', 'verde', 'ambar', 'laranja', 'rosa', 'ciano', 'cinza', 'roxo', 'vermelho', 'lima')`,
    ),
  ],
);

export type ProductCategory = typeof productCategories.$inferSelect;
export type NewProductCategory = typeof productCategories.$inferInsert;
