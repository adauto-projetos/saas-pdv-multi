import { config } from "dotenv";
import { and, eq, inArray, isNull } from "drizzle-orm";

// Em prod as vars vêm do ambiente do container; em dev, do .env.local
// (mesmo padrão de scripts/verify-prod.ts e scripts/seed-testfull.ts).
config({ path: ".env.local" });

import { db } from "../db";
import { productCategories, products, tenants } from "../db/schema";
import { DEFAULT_PRODUCT_CATEGORIES } from "../lib/validation/product";

// ============================================================================
// seed-product-categories.ts — RN03 (feature 0025F)
// ----------------------------------------------------------------------------
// Roda no boot do container, DEPOIS de `npm run db:setup`/`db:rls` e ANTES de
// `npm run verify:prod` (ver Dockerfile CMD). Para cada tenant PENDENTE
// (`product_categories_seeded_at IS NULL`), numa única transação:
//   1. insere as 7 categorias padrão (DEFAULT_PRODUCT_CATEGORIES — fonte
//      única também consumida pelo onboarding e pelos testes);
//   2. faz o backfill dos produtos legados (`products.category` texto) que
//      batem o nome exato dentro do tenant e ainda não têm `category_id`;
//   3. grava `product_categories_seeded_at = now()`.
//
// O gate pela flag é o que garante que um re-run é no-op (T17) e NUNCA
// ressuscita uma categoria padrão excluída/renomeada pelo dono da loja
// (T19), nem re-vincula um produto que ele já moveu para "Sem categoria" —
// a `category` texto legada não é tocada, só lida.
// ============================================================================

type Executor = Pick<typeof db, "insert" | "select" | "update">;

async function insertDefaultCategories(
  tx: Executor,
  tenantId: string,
): Promise<{ id: string; name: string }[]> {
  return tx
    .insert(productCategories)
    .values(
      DEFAULT_PRODUCT_CATEGORIES.map((c) => ({
        tenantId,
        name: c.name,
        color: c.color,
        position: c.position,
      })),
    )
    .returning({ id: productCategories.id, name: productCategories.name });
}

/**
 * Casa `products.category` (texto legado) com o nome exato de uma categoria
 * recém-criada, dentro do mesmo tenant, só para produtos que ainda não têm
 * `category_id` (nunca sobrescreve um vínculo já existente). Strings que não
 * batem nenhum dos 7 nomes padrão ficam como estão — "Sem categoria" é
 * ausência, não erro (RN04), e o produto segue filtrável (RF08).
 */
async function backfillLegacyProducts(
  tx: Executor,
  tenantId: string,
  categories: { id: string; name: string }[],
): Promise<void> {
  for (const category of categories) {
    await tx
      .update(products)
      .set({ categoryId: category.id })
      .where(
        and(
          eq(products.tenantId, tenantId),
          isNull(products.categoryId),
          eq(products.category, category.name),
        ),
      );
  }
}

/**
 * Seed de UM tenant: 7 padrão + backfill + flag, numa única transação
 * (Gap Fix 1). Checa o próprio gate no início — chamar esta função diretamente
 * (fora do laço de `seedProductCategoriesForAllTenants`) para um tenant já
 * seedado é um no-op seguro, nunca duplica nem ressuscita categoria excluída.
 */
export async function seedProductCategoriesForTenant(
  tenantId: string,
): Promise<{ seeded: boolean }> {
  return db.transaction(async (tx) => {
    const [tenant] = await tx
      .select({ seededAt: tenants.productCategoriesSeededAt })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant || tenant.seededAt) {
      return { seeded: false };
    }

    const categories = await insertDefaultCategories(tx, tenantId);
    await backfillLegacyProducts(tx, tenantId, categories);
    await tx
      .update(tenants)
      .set({ productCategoriesSeededAt: new Date() })
      .where(eq(tenants.id, tenantId));

    return { seeded: true };
  });
}

/**
 * Boot entrypoint: seeda todo tenant PENDENTE (`product_categories_seeded_at
 * IS NULL`). `tenantIds` é opcional — usado pelos testes para restringir o
 * escopo a um tenant específico em vez de tocar o banco inteiro; o CLI (boot
 * de produção) chama sem filtro, cobrindo todos os tenants pendentes.
 */
export async function seedProductCategoriesForAllTenants(
  options: { tenantIds?: string[] } = {},
): Promise<{ seededTenantIds: string[] }> {
  const conditions = [isNull(tenants.productCategoriesSeededAt)];
  if (options.tenantIds) {
    conditions.push(inArray(tenants.id, options.tenantIds));
  }

  const pending = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(and(...conditions));

  const seededTenantIds: string[] = [];
  for (const tenant of pending) {
    const result = await seedProductCategoriesForTenant(tenant.id);
    if (result.seeded) seededTenantIds.push(tenant.id);
  }

  return { seededTenantIds };
}

async function main() {
  console.log("Seed de categorias de produto (0025F) — tenants pendentes...");
  const { seededTenantIds } = await seedProductCategoriesForAllTenants();
  console.log(
    `✓ ${seededTenantIds.length} tenant(s) seedado(s); os demais já estavam prontos.`,
  );
}

// Só roda o boot completo quando o arquivo é executado diretamente (CLI) —
// quando importado (ex.: pelos testes), apenas expõe as funções acima.
const isDirectRun =
  !!process.argv[1] &&
  (process.argv[1].endsWith("seed-product-categories.ts") ||
    process.argv[1].endsWith("seed-product-categories.js"));

if (isDirectRun) {
  void main().then(
    () => process.exit(0),
    (e) => {
      console.error("✗ Falha no seed de categorias:", e);
      process.exit(1);
    },
  );
}
