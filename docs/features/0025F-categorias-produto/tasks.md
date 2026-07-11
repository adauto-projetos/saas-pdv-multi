# Tasks: 0025F — Categorias de Produto

## Metadata

| Field | Value |
|-------|-------|
| Complexity | COMPLEX |
| Total tasks | 21 |
| Services | database, backend, frontend, test, infra |

## Requirements Coverage

- [x] RF01 — Criar categoria com nome e cor opcional de paleta
- [x] RF02 — Renomear categoria com reflexo imediato em todas as superfícies
- [x] RF03 — Excluir categoria com contagem e mover produtos para Sem categoria
- [x] RF04 — Criação inline no formulário de produto sem sair do fluxo
- [x] RF05 — Superfície de gestão completa acessível da tela de produtos
- [x] RF06 — Ordem manual das categorias seguida por select e chips
- [x] RF07 — Select, chips e exibições gerados das categorias do tenant
- [x] RF08 — Chip "Sem categoria" condicional ao final dos chips do caixa
- [x] RN01 — Nome único por tenant (case/accent-insensitive), não global
- [x] RN02 — tenant_id obrigatório + isolamento por RLS na tabela nova
- [x] RN03 — Seed das 7 padrão + migração dos produtos existentes sem perda
- [x] RN04 — "Sem categoria" é ausência (null), não registro cadastrado
- [x] RN05 — Cor automática da paleta, cíclica quando categorias > cores
- [x] RN06 — "Sem categoria" é nome reservado (criar/renomear rejeitado)
- [x] RN07 — Vendas lançadas permanecem intocadas em rename/delete de categoria
- [x] RNF01 — Tabela nova coberta pela suite automática de isolamento entre tenants

## TDD

- [x] T-TEST-01 Contract tests do service de categoria (spec T01–T03, T07, T11–T12, T20–T23) — `lib/services/products/category-service.test.ts`
- [x] T-TEST-02 Contract test guard de categoryId cross-tenant (spec T14) — `lib/services/products/product-service.test.ts`
- [x] T-TEST-03 Contract tests seed/backfill/onboarding/idempotência/no-resurrect (spec T15–T19) — `db/__tests__/product-categories-seed.test.ts`
- [x] T-TEST-04 Isolamento RLS auto-coberto pela suite parametrizada (spec T13) — `db/__tests__/tenant-isolation-regression.test.ts`
- [x] T-TEST-05 Contract tests do manager + dialog de exclusão com contagem (spec T04, T06) — `components/products/CategoryManager.test.tsx`
- [x] T-TEST-06 Contract test da criação inline no select (spec T05) — `components/products/CategorySelect.test.tsx`
- [x] T-TEST-07 Contract test do select dinâmico preservando 0023H/0024H (spec T09) — `components/products/ProductForm.test.tsx`
- [x] T-TEST-08 Contract tests chips dinâmicos + chip Sem categoria (spec T08, T10) — `components/caixa/CashierScreen.test.tsx`

## Execution

- [x] T01 Schema Drizzle `product_categories` + export no index
  - Service: database
  - Files: `db/schema/product-categories.ts`, `db/schema/index.ts`
  - Deps: -
  - Verify: `npm run db:setup` (exit 0, tabela criada com unique `tenant_id, name`)
- [x] T02 FK `products.category_id` + flag `tenants.product_categories_seeded_at`
  - Service: database
  - Files: `db/schema/products.ts`, `db/schema/tenants.ts`
  - Deps: T01
  - Verify: `npm run db:setup` (exit 0; coluna `category` text permanece intocada)
- [x] T03 RLS policy `tenant_isolation` para `product_categories`
  - Service: database
  - Files: `db/migrations/0012_categorias_rls.sql`
  - Deps: T01
  - Verify: `npm run db:rls` (exit 0)
- [x] T04 Helper `seedProductCategory` para suite de isolamento
  - Service: test
  - Files: `db/__tests__/seed.ts`
  - Deps: T01, T03
  - Verify: `npx vitest run db/__tests__/tenant-isolation-regression.test.ts` (spec T13 verde)
- [x] T05 Consts paleta/defaults, schemas zod e DTOs de categoria
  - Service: backend
  - Files: `lib/validation/product.ts`, `types/product.ts`
  - Deps: -
  - Verify: `npm run typecheck` (CATEGORY_PALETTE, DEFAULT_PRODUCT_CATEGORIES, schemas e ProductCategoryDto exportados)
- [x] T06 Seed script gated por flag com backfill transacional
  - Service: database
  - Files: `scripts/seed-product-categories.ts`
  - Deps: T02, T05
  - Verify: `npx vitest run db/__tests__/product-categories-seed.test.ts` (spec T15–T17, T19 verdes)
- [x] T07 Onboarding insere 7 padrão e grava flag
  - Service: backend
  - Files: `lib/services/tenants/onboarding.ts`
  - Deps: T02, T05
  - Verify: `npx vitest run db/__tests__/product-categories-seed.test.ts` (spec T18 verde)
- [x] T08 Dockerfile CMD roda seed entre db:setup e verify:prod
  - Service: infra
  - Files: `Dockerfile`
  - Deps: T06
  - Verify: `grep seed-product-categories Dockerfile` (passo presente entre `db:setup`/`db:rls` e `verify:prod`)
- [x] T09 Data layer `category-data.ts` com queries e mapper
  - Service: backend
  - Files: `lib/services/products/category-data.ts`
  - Deps: T01, T05
  - Verify: `npm run typecheck`
- [x] T10 Service `category-service.ts` com RN01/RN05/RN06 e reorder
  - Service: backend
  - Files: `lib/services/products/category-service.ts`
  - Deps: T09
  - Verify: `npx vitest run lib/services/products/category-service.test.ts` (spec T01–T03, T07, T11–T12, T20–T23 verdes)
- [x] T11 Seis server actions de categoria com guards
  - Service: backend
  - Files: `app/(app)/products/categories/actions.ts`
  - Deps: T10
  - Verify: `npm run typecheck` (6 actions com ActionResult + revalidatePath em /products, /products/categories, /caixa)
- [x] T12 Retrofit produto: categoryId em service, data e actions
  - Service: backend
  - Files: `lib/services/products/product-service.ts`, `lib/services/products/data.ts`, `app/(app)/products/actions.ts`
  - Deps: T05, T09
  - Verify: `npx vitest run lib/services/products/product-service.test.ts` (spec T14 verde; ProductDto.category via LEFT JOIN)
- [x] T13 Componentes `CategoryFormDialog` e `CategorySelect` com criação inline
  - Service: frontend
  - Files: `components/products/CategoryFormDialog.tsx`, `components/products/CategorySelect.tsx`
  - Deps: T11
  - Verify: `npx vitest run components/products/CategorySelect.test.tsx` (spec T05 verde)
- [x] T14 Componente `CategoryManager` com reorder, editar e excluir
  - Service: frontend
  - Files: `components/products/CategoryManager.tsx`
  - Deps: T11, T13
  - Verify: `npx vitest run components/products/CategoryManager.test.tsx` (spec T04, T06 verdes)
- [x] T15 Página `/products/categories` + link Gerenciar categorias
  - Service: frontend
  - Files: `app/(app)/products/categories/page.tsx`, `app/(app)/products/page.tsx`
  - Deps: T14
  - Verify: browser check — SUBSTITUÍDO por leitura do RSC (`listProductCategoriesAction` → `CategoryManager`) + componente renderizado nos testes de CategoryManager; link "Gerenciar categorias" confirmado em `app/(app)/products/page.tsx`
- [x] T16 Retrofit `ProductForm`: categoryId + CategorySelect preservando 0023H/0024H
  - Service: frontend
  - Files: `components/products/ProductForm.tsx`
  - Deps: T13
  - Verify: `npx vitest run components/products/ProductForm.test.tsx` (spec T09 verde)
- [x] T17 Threading da prop categories em New/EditProductForm
  - Service: frontend
  - Files: `components/products/NewProductForm.tsx`, `components/products/EditProductForm.tsx`
  - Deps: T16
  - Verify: `npm run typecheck`
- [x] T18 Páginas new/edit buscam categorias e injetam no form
  - Service: frontend
  - Files: `app/(app)/products/new/page.tsx`, `app/(app)/products/[id]/edit/page.tsx`
  - Deps: T17
  - Verify: browser check — SUBSTITUÍDO por leitura do RSC (`Promise.all` com `listProductCategoriesAction` injetando `categories` no form) + testes renderizados de NewProductForm/EditProductForm/ProductForm confirmando o select populado
- [x] T19 Retrofit `CashierScreen` chips dinâmicos + página caixa
  - Service: frontend
  - Files: `components/caixa/CashierScreen.tsx`, `app/(app)/caixa/page.tsx`
  - Deps: T12
  - Verify: `npx vitest run components/caixa/CashierScreen.test.tsx` (spec T08, T10 verdes)
- [x] T20 Novo shape de category em Cart, use-cart e ProductsTable
  - Service: frontend
  - Files: `components/caixa/Cart.tsx`, `components/caixa/use-cart.ts`, `components/products/ProductsTable.tsx`
  - Deps: T12, T19
  - Verify: `npm run typecheck`
- [x] T21 Seeds de dev criam categorias e vinculam por categoryId
  - Service: database
  - Files: `scripts/seed-testfull.ts`, `scripts/seed-test-stores.ts`
  - Deps: T02, T05
  - Verify: `npx tsx scripts/seed-testfull.ts` (produtos saem com `category_id` preenchido)

## Acceptance Checklist

- [x] Action `createProductCategoryAction` cria categoria com nome e cor opcional e retorna `ProductCategoryDto` com position no fim da lista (RF01, RF04)
- [x] Action `listProductCategoriesAction` retorna categorias ordenadas por `position` sob guard `requireAnyPermission(["produtos","caixa"])` (RF05, RF06, RF07)
- [x] Action `updateProductCategoryAction` renomeia/recolore e faz `revalidatePath` em /products, /products/categories e /caixa (RF02)
- [x] Action `reorderProductCategoriesAction` grava positions 0..n-1 da lista completa; ids divergentes do tenant → ValidationError (RF06)
- [x] Action `countProductsInCategoryAction` retorna `{ count }` de produtos vinculados à categoria (RF03)
- [x] Action `deleteProductCategoryAction` exclui e retorna `{ id, movedCount }`; FK ON DELETE SET NULL move produtos para Sem categoria (RF03, RN04)
- [x] DTO `ProductCategoryDto` expõe `id`, `name`, `color` (slug da paleta), `position`, `createdAt`/`updatedAt` ISO (RF01)
- [x] DTO `ProductDto.category` vira `{ id, name, color } | null` via LEFT JOIN; `null` = Sem categoria (RF07, RN04)
- [x] Schema `createProductCategorySchema` valida name trim 1–50 e color como `z.enum` das chaves de CATEGORY_PALETTE (RF01)
- [x] Schemas de produto aceitam `categoryId` uuid nullable no lugar de `category` string (RF07)
- [x] Service rejeita nome duplicado normalizado (case/acento) no tenant com ConflictError "Já existe uma categoria com esse nome"; unique index `(tenant_id, name)` como backstop (RN01)
- [x] Service aceita mesmo nome em tenants distintos — unicidade por tenant, não global (RN01)
- [x] Service rejeita criar/renomear para "Sem categoria" (normalizado) com ValidationError de nome reservado (RN06)
- [x] Service aplica cor automática `palette[count % len]` quando cor omitida; paleta cicla e cor repetida é aceita (RN05)
- [x] `createProduct`/`updateProduct` validam `categoryId` via `selectProductCategoryById` sob RLS; id de outro tenant → ValidationError "Categoria inválida" (RN02)
- [x] Tabela `product_categories` tem `tenant_id` FK + policy `tenant_isolation` em `0012_categorias_rls.sql`; suite parametrizada de isolamento cobre a tabela via `seedProductCategory` (RN02, RNF01)
- [x] `listProductCategories` nunca inclui "Sem categoria"; estado null não tem id, cor nem position (RN04)
- [x] Renomear/excluir categoria não altera vendas lançadas — `sale_items.name_snapshot` e totais intactos (RN07)
- [x] Seed `scripts/seed-product-categories.ts` cria as 7 padrão (nomes exatos, cores 1:1 de CATEGORY_COLORS, position 0–6) por tenant pendente (RN03)
- [x] Backfill vincula produtos legados por nome dentro do tenant; contagem por categoria antes = depois, nenhum produto perde categoria (RN03)
- [x] Seed gated por `tenants.product_categories_seeded_at`: seed + backfill + flag na mesma transação; re-run é no-op e não ressuscita padrão excluída (RN03)
- [x] Onboarding `createUserWithTenant` insere as 7 padrão e grava a flag na própria transação (RN03)
- [x] Const `DEFAULT_PRODUCT_CATEGORIES` é fonte única consumida por seed script, onboarding e testes (RN03)
- [x] Seeds de dev `seed-testfull.ts` e `seed-test-stores.ts` criam categorias antes e vinculam produtos por `categoryId` (RN03)
- [x] Dockerfile CMD executa o seed entre `db:setup`/`db:rls` e `verify:prod` (RN03)
- [x] `CategoryManager` lista categorias com chip colorido e controles renomear, recolorir, reordenar ▲▼ (44px) e excluir (RF05, RF06)
- [x] AlertDialog de exclusão exibe "N produtos serão movidos para Sem categoria" e só chama a action após confirmação (RF03)
- [x] `CategorySelect` exibe categorias do tenant por position + opção "+ Nova categoria" que abre `CategoryFormDialog`; criada sai selecionada no fim da ordem (RF04, RF06, RF07)
- [x] `ProductForm` usa `CategorySelect` com estado `categoryId`, preservando layout/classes de 0023H/0024H (RF07)
- [x] `CashierScreen` renderiza chips "Todos" + categorias por position com cor de CATEGORY_PALETTE, sem `PRODUCT_CATEGORIES` hardcoded (RF06, RF07)
- [x] Chip "Sem categoria" aparece ao fim apenas quando existe produto com category null e filtra exatamente esses produtos (RF08, RN04)
- [x] Rota `/products/categories` acessível via link "Gerenciar categorias" em `/products` (RF05)
- [x] `ProductsTable` exibe badge colorida com o nome da categoria do produto (RF07)

## Validation Gates

- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures

### Known Issues

- components/admin/ReleaseDialog.test.tsx:42 — T67 (0013F) date-flaky: fixture `validUntil` ancorada em 2026-07-01 apodreceu; falha também no master, arquivo não tocado por 0025F
- 8 warnings de lint pré-existentes (`@next/next/no-img-element` ×6, `no-unused-vars` ×2 em scripts/full-test.mjs) — nenhum em arquivo tocado
