// @vitest-environment node
import { asc, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { productCategories, products, tenants, users } from "@/db/schema";
import { createUserWithTenant } from "@/lib/services/tenants/onboarding";
import { DEFAULT_PRODUCT_CATEGORIES } from "@/lib/validation/product";
import {
  seedProductCategoriesForAllTenants,
  seedProductCategoriesForTenant,
} from "@/scripts/seed-product-categories";

import { cleanupTenant, createTestUser, HAS_DB, seedTenant } from "./seed";

// Requer o Postgres do Docker (DATABASE_URL). Sem creds, o bloco é pulado.
const suite = HAS_DB ? describe : describe.skip;

async function categoriesOf(tenantId: string) {
  return db
    .select()
    .from(productCategories)
    .where(eq(productCategories.tenantId, tenantId))
    .orderBy(asc(productCategories.position));
}

suite("seed de categorias de produto — RN03 (0025F)", () => {
  let userId = "";
  let tenantId = "";

  afterEach(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (userId) await db.delete(users).where(eq(users.id, userId));
    userId = "";
    tenantId = "";
  });

  it("T15 — seed cria as 7 categorias padrão (nomes, cores e position exatos)", async () => {
    const user = await createTestUser();
    userId = user.userId;
    tenantId = await seedTenant(userId, "Loja Seed T15");

    const result = await seedProductCategoriesForTenant(tenantId);
    expect(result.seeded).toBe(true);

    const rows = await categoriesOf(tenantId);
    expect(rows).toHaveLength(7);
    rows.forEach((row, i) => {
      expect(row.name).toBe(DEFAULT_PRODUCT_CATEGORIES[i].name);
      expect(row.color).toBe(DEFAULT_PRODUCT_CATEGORIES[i].color);
      expect(row.position).toBe(DEFAULT_PRODUCT_CATEGORIES[i].position);
    });

    const [tenantRow] = await db
      .select({ seededAt: tenants.productCategoriesSeededAt })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    expect(tenantRow?.seededAt).not.toBeNull();
  });

  it("T16 — backfill vincula produtos legados por nome, sem perder categoria", async () => {
    const user = await createTestUser();
    userId = user.userId;
    tenantId = await seedTenant(userId, "Loja Seed T16");

    const [bebida] = await db
      .insert(products)
      .values({
        tenantId,
        name: "Cerveja",
        unit: "un",
        salePriceCents: 500,
        stockQuantity: "0",
        category: "Bebidas",
      })
      .returning({ id: products.id });
    const [horti] = await db
      .insert(products)
      .values({
        tenantId,
        name: "Banana",
        unit: "kg",
        salePriceCents: 300,
        stockQuantity: "0",
        category: "Hortifruti",
      })
      .returning({ id: products.id });
    const [semMatch] = await db
      .insert(products)
      .values({
        tenantId,
        name: "Item Estranho",
        unit: "un",
        salePriceCents: 100,
        stockQuantity: "0",
        category: "Categoria Que Não Existe",
      })
      .returning({ id: products.id });
    const [semCategoria] = await db
      .insert(products)
      .values({
        tenantId,
        name: "Produto Sem Categoria",
        unit: "un",
        salePriceCents: 200,
        stockQuantity: "0",
      })
      .returning({ id: products.id });

    await seedProductCategoriesForTenant(tenantId);

    const rows = await categoriesOf(tenantId);
    const bebidasCat = rows.find((c) => c.name === "Bebidas")!;
    const hortiCat = rows.find((c) => c.name === "Hortifruti")!;

    const [bebidaAfter] = await db
      .select({ categoryId: products.categoryId })
      .from(products)
      .where(eq(products.id, bebida.id));
    const [hortiAfter] = await db
      .select({ categoryId: products.categoryId })
      .from(products)
      .where(eq(products.id, horti.id));
    const [semMatchAfter] = await db
      .select({ categoryId: products.categoryId })
      .from(products)
      .where(eq(products.id, semMatch.id));
    const [semCategoriaAfter] = await db
      .select({ categoryId: products.categoryId })
      .from(products)
      .where(eq(products.id, semCategoria.id));

    expect(bebidaAfter?.categoryId).toBe(bebidasCat.id);
    expect(hortiAfter?.categoryId).toBe(hortiCat.id);
    // String legada sem categoria padrão correspondente: fica "Sem categoria"
    // (RN04) — não perde o produto, só não acha vínculo.
    expect(semMatchAfter?.categoryId).toBeNull();
    // Produto que já não tinha `category` nenhuma: continua sem categoria.
    expect(semCategoriaAfter?.categoryId).toBeNull();

    // Contagem por categoria: 1 produto em cada uma das duas batidas, nenhum
    // produto "sumiu" (4 produtos inseridos, 4 continuam existindo).
    const allProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.tenantId, tenantId));
    expect(allProducts).toHaveLength(4);
  });

  it("T17 — rodar o seed 2x seguidas é no-op na segunda execução", async () => {
    const user = await createTestUser();
    userId = user.userId;
    tenantId = await seedTenant(userId, "Loja Seed T17");

    const [product] = await db
      .insert(products)
      .values({
        tenantId,
        name: "Refrigerante",
        unit: "un",
        salePriceCents: 400,
        stockQuantity: "0",
        category: "Bebidas",
      })
      .returning({ id: products.id });

    const first = await seedProductCategoriesForAllTenants({
      tenantIds: [tenantId],
    });
    expect(first.seededTenantIds).toEqual([tenantId]);

    const afterFirst = await categoriesOf(tenantId);
    expect(afterFirst).toHaveLength(7);
    const [productAfterFirst] = await db
      .select({ categoryId: products.categoryId })
      .from(products)
      .where(eq(products.id, product.id));
    const categoryIdAfterFirst = productAfterFirst?.categoryId;
    expect(categoryIdAfterFirst).not.toBeNull();

    const second = await seedProductCategoriesForAllTenants({
      tenantIds: [tenantId],
    });
    // Tenant já seedado: segunda rodada não o seleciona como pendente.
    expect(second.seededTenantIds).toEqual([]);

    const afterSecond = await categoriesOf(tenantId);
    expect(afterSecond).toHaveLength(7); // sem duplicatas
    expect(afterSecond.map((c) => c.name).sort()).toEqual(
      afterFirst.map((c) => c.name).sort(),
    );

    const [productAfterSecond] = await db
      .select({ categoryId: products.categoryId })
      .from(products)
      .where(eq(products.id, product.id));
    expect(productAfterSecond?.categoryId).toBe(categoryIdAfterFirst);
  });

  it("T18 — onboarding (createUserWithTenant) já nasce com as 7 categorias + flag", async () => {
    const email = `onb-cat+${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    const result = await createUserWithTenant(
      email,
      "hash-x",
      "Loja Onboarding Cat",
    );
    userId = result.userId;
    tenantId = result.tenantId;

    const rows = await categoriesOf(tenantId);
    expect(rows).toHaveLength(7);
    rows.forEach((row, i) => {
      expect(row.name).toBe(DEFAULT_PRODUCT_CATEGORIES[i].name);
      expect(row.color).toBe(DEFAULT_PRODUCT_CATEGORIES[i].color);
      expect(row.position).toBe(DEFAULT_PRODUCT_CATEGORIES[i].position);
    });

    const [tenantRow] = await db
      .select({ seededAt: tenants.productCategoriesSeededAt })
      .from(tenants)
      .where(eq(tenants.id, tenantId));
    expect(tenantRow?.seededAt).not.toBeNull();
  });

  it("T19 — excluir/renomear categoria padrão e re-rodar o seed não a resgata", async () => {
    const user = await createTestUser();
    userId = user.userId;
    tenantId = await seedTenant(userId, "Loja Seed T19");

    await seedProductCategoriesForTenant(tenantId);
    const before = await categoriesOf(tenantId);
    const bebidas = before.find((c) => c.name === "Bebidas")!;
    const hortifruti = before.find((c) => c.name === "Hortifruti")!;

    // Owner exclui a categoria padrão "Bebidas" (RF03, ação normal pós-seed).
    await db
      .delete(productCategories)
      .where(eq(productCategories.id, bebidas.id));
    // Owner renomeia "Hortifruti" (RF02).
    await db
      .update(productCategories)
      .set({ name: "Frutas e Verduras" })
      .where(eq(productCategories.id, hortifruti.id));

    // Re-run: tenant já está com a flag setada — deve ser 100% no-op.
    const rerun = await seedProductCategoriesForAllTenants({
      tenantIds: [tenantId],
    });
    expect(rerun.seededTenantIds).toEqual([]);

    const after = await categoriesOf(tenantId);
    expect(after).toHaveLength(6); // 7 - 1 excluída
    expect(after.some((c) => c.name === "Bebidas")).toBe(false);
    expect(after.some((c) => c.name === "Frutas e Verduras")).toBe(true);
    expect(after.some((c) => c.name === "Hortifruti")).toBe(false);
  });
});
