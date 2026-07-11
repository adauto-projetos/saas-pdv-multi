---
id: 0025F
type: feature-plan
created: 2026-07-10
updated: 2026-07-10
related: [0025F]
---

# Plan: 0025F — Categorias de Produto

## TL;DR

Plano técnico para substituir a lista fixa de 7 categorias (`PRODUCT_CATEGORIES` em `lib/validation/product.ts:7-15`) por categorias por tenant com CRUD completo (nome, cor de paleta, ordem manual). Entrega: tabela `product_categories` com RLS + FK `products.category_id` (ON DELETE SET NULL), seed único por tenant (flag `tenants.product_categories_seeded_at`) com backfill dos produtos existentes, 6 server actions novas + retrofit das actions de produto, rota `/products/categories` com 3 componentes novos, e retrofit de ProductForm/CashierScreen preservando 0023H/0024H. 23 contract tests cobrem 100% dos 16 requisitos (RF01–RF08, RN01–RN07, RNF01).

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Test Specification](#test-specification)
- [Database](#database)
- [Backend](#backend)
- [Frontend](#frontend)
- [Gap Fixes](#gap-fixes)
- [Main Flow](#main-flow)
- [Tasks](#tasks)
- [Requirements Coverage](#requirements-coverage)
- [Risks](#risks)
- [Validation](#validation)
- [Quick Reference](#quick-reference)

## Context

{{doc:0025F}} fixou o escopo com o owner (2026-07-10): todo tenant nasce/é migrado com as 7 categorias atuais (com as cores dos chips de hoje), excluir categoria em uso move produtos para "Sem categoria" após aviso com contagem, criação inline no form de produto e gestão completa em superfície própria acessível da tela de produtos. Este plano adiciona por cima: o desenho da tabela/FK e a ordem de migração compatível com push-only, os contratos de actions/schemas/services, o mapa de UI que preserva as correções de {{doc:0023H}}/{{doc:0024H}}, a spec de testes por contrato e a correção de 2 gaps de integração entre os planos de área (seed no-resurrect e backfill re-vinculador).

## Architecture Decisions

| Decision | Rationale | Alternative rejected | Triggering constraint |
|---|---|---|---|
| `products.category_id` uuid FK (ON DELETE SET NULL) em vez de continuar string | Rename reflete em todo lugar sem update em massa (RF02); delete move para "Sem categoria" de graça via FK (RF03/RN04) | Manter `category` text sincronizada por nome — rename quebra vínculo e não tem integridade referencial | RF02/RF03/RN04 |
| Coluna `category` text permanece nesta feature (deprecated, app para de escrever) | É a fonte do backfill RN03 e o fallback de rollback; push-only não tem release faseado | Drop imediato — perde a fonte do backfill e o rollback | Push-only (CLAUDE.md RN01) + migração RN03 |
| Seed 1x por tenant, gated por `tenants.product_categories_seeded_at` | Seed a cada boot com `ON CONFLICT DO NOTHING` recriaria categoria padrão excluída (viola RN03: "após o seed são categorias comuns") e o backfill re-executado re-vincularia produto movido para "Sem categoria" | Seed idempotente a cada boot só com ON CONFLICT — falha o contrato no-resurrect (T19) | RN03 + RF03 + T17/T19 |
| Cor = slug de paleta pré-definida armazenado no banco (`CATEGORY_PALETTE`) | Rename não perde cor; paleta cicla quando categorias > cores (RN05); 7 primeiras cores = `CATEGORY_COLORS` atuais (zero mudança visual no deploy) | Map hardcoded nome→cor — quebra em rename; hex livre — inconsistência visual e input complexo p/ owner | RF01/RN05 + regressão visual 0024H |
| RN01/RN06 normalizados no service (`normalize("NFD")` + lowercase) com unique index `(tenant_id, name)` como backstop | Projeto não tem `unaccent`/`citext`; comparação normalizada no service cobre maiúsculas/acentos com mensagem clara | Índice funcional com extensão `unaccent` — dependência nova sem precedente no schema | RN01/RN06 + stack atual |
| Guard de tenant no `categoryId` do produto: `selectProductCategoryById` sob RLS antes de gravar | FK do Postgres é checada como owner e NÃO passa pela RLS — `categoryId` de outro tenant passaria na constraint | Confiar só na FK — vazaria referência cross-tenant | RN02 (multi-tenancy inviolável) |
| RF05 em rota própria `/products/categories` (não modal) | Precedente `app/(app)/financeiro/clientes/page.tsx` (CRUD auxiliar em página dedicada); mobile sem overlay sobre overlay | Modal sobre a tela de produtos — empilha dialogs no mobile | Mobile-first (0010F) + padrão do projeto |
| Reorder por botões ▲▼ (44px) em vez de drag-and-drop | Touch target garantido, zero dependência nova, simples de operar e manter | Drag-and-drop — lib nova + acessibilidade/touch complexos | Owner beginner + mobile-first |

---

## Test Specification

### Contract Tests (from RFs/RNs)
| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | svc-RF01-create — cria categoria com nome e cor | backend | RF01 | createProductCategory(ctx, {name:"Vinhos", color}) | ActionResult ok com ProductCategoryDto | DTO tem name/color; position = fim da lista |
| T02 | svc-RF02-rename — renomeia categoria existente | backend | RF02 | updateProductCategory(ctx, {id, name:"Cervejas"}) | DTO com nome novo | listProductCategories reflete o novo nome |
| T03 | svc-RF03-count-delete — conta e move produtos | backend | RF03 | count(id) e delete(id) de categoria com 2 produtos | {count:2}; depois {movedCount:2} | products.category_id dos 2 vira NULL (Sem categoria) |
| T04 | ui-RF03-confirm-dialog — aviso com contagem antes | frontend | RF03 | clicar excluir em categoria em uso | AlertDialog "2 produtos serão movidos para Sem categoria" | deleteProductCategoryAction só chamada após confirmar |
| T05 | ui-RF04-inline-create — nova categoria dentro do form | frontend | RF04 | opção "+ Nova categoria" no select + salvar dialog | categoria criada sai selecionada no produto | DTO appended ao fim da lista local, sem sair do fluxo |
| T06 | ui-RF05-manager — superfície de gestão completa | frontend | RF05 | render CategoryManager com ProductCategoryDto[] | lista com renomear, recolorir, reordenar, excluir | controles presentes por item; chip com cor da paleta |
| T07 | svc-RF06-reorder — ordem manual em lote | backend | RF06 | reorderProductCategories(ctx, orderedIds invertidos) | lista na nova ordem, positions 0..n-1 | ids incompletos/estranhos → ValidationError |
| T08 | ui-RF07-chips-dynamic — chips do caixa dinâmicos | frontend | RF07 | CashierScreen com categorias do tenant (props) | chips "Todos" + categorias por position | sem PRODUCT_CATEGORIES hardcoded; cor via CATEGORY_PALETTE |
| T09 | ui-RF07-form-select — select do form dinâmico | frontend | RF07 | ProductForm com prop categories | options do select = categorias do tenant | sem lista fixa; layout/classes 0023H/0024H preservados |
| T10 | ui-RF08-nocat-chip — chip Sem categoria condicional | frontend | RF08 | grid com/sem produto de category null | chip "Sem categoria" no fim / chip ausente | filtro do chip retorna apenas produtos com category null |
| T11 | svc-RN01-dup-reject — nome duplicado rejeitado | backend | RN01 | criar/renomear "bebidas" e "BÉBIDAS" com "Bebidas" existente | ConflictError | mensagem "Já existe uma categoria com esse nome" |
| T12 | svc-RN01-crosstenant-ok — mesmo nome em outro tenant | backend | RN01 | tenant B cria "Bebidas" já existente no tenant A | criação aceita | unicidade é por tenant, não global |
| T13 | db-RN02-rls-isolation — cross-tenant negado (auto) | database | RN02/RNF01 | select/update em product_categories de outro tenant via withUserRls | 0 rows lidas/alteradas | suite parametrizada 0020F auto-cobre; exige seed helper novo |
| T14 | svc-RN02-foreign-category — categoryId de outro tenant | backend | RN02 | createProduct/updateProduct com categoryId do tenant B | ValidationError "Categoria inválida" | produto não gravado (FK não passa por RLS; guard no service) |
| T15 | db-RN03-seed-defaults — 7 padrão em tenant existente | database | RN03 | rodar scripts/seed-product-categories.ts em tenant existente | 7 categorias padrão criadas | nomes exatos, cores 1:1 de CATEGORY_COLORS, position 0-6 |
| T16 | db-RN03-backfill — produtos legados migrados | database | RN03 | produto com category='Bebidas' e category_id NULL | category_id aponta p/ "Bebidas" do próprio tenant | contagem por categoria antes = depois; nenhum produto perde categoria |
| T17 | db-RN03-idempotent — re-run sem efeito | database | RN03 | rodar o seed script 2x seguidas | segunda execução é no-op | ainda 7 categorias, sem duplicatas, category_id inalterado |
| T18 | db-RN03-onboarding — tenant novo nasce com 7 | database | RN03 | createUserWithTenant (onboarding) | tenant novo com as 7 categorias padrão | mesma transação do onboarding; nomes/cores/positions corretos |
| T19 | db-RN03-no-resurrect — padrão excluída não volta | database | RN03 | excluir/renomear categoria padrão e re-rodar o seed | categoria NÃO recriada nem revertida | pós-seed as 7 são categorias comuns (RF02/RF03) |
| T20 | svc-RN04-null-absence — Sem categoria não é registro | backend | RN04 | listProductCategories + produto sem categoria | lista sem "Sem categoria"; ProductDto.category = null | nenhum id/cor/position associado ao estado null |
| T21 | svc-RN05-auto-color-cycle — cor automática e cíclica | backend | RN05 | criar 11 categorias sem informar cor | todas recebem cor da paleta; 11ª repete a 1ª | palette[count % len]; cor duplicada aceita sem erro |
| T22 | svc-RN06-reserved-reject — nome reservado rejeitado | backend | RN06 | criar/renomear para "sem categoria" / "SEM CATEGORÍA" | ValidationError | mensagem de nome reservado; nome comum (T01) segue aceito |
| T23 | svc-RN07-sales-intact — venda lançada intocada | backend | RN07 | venda com item, depois renomear/excluir a categoria do produto | venda e sale_items inalterados | name_snapshot e totais idênticos antes/depois |

### Test File Mapping
| Area | Test File | Test IDs |
|------|-----------|----------|
| backend | lib/services/products/category-service.test.ts (novo) | T01, T02, T03, T07, T11, T12, T20, T21, T22, T23 |
| backend | lib/services/products/product-service.test.ts (estender) | T14 |
| database | db/__tests__/product-categories-seed.test.ts (novo) | T15, T16, T17, T18, T19 |
| database | db/__tests__/tenant-isolation-regression.test.ts (auto; + seedProductCategory em db/__tests__/seed.ts) | T13 |
| frontend | components/products/CategoryManager.test.tsx (novo) | T04, T06 |
| frontend | components/products/CategorySelect.test.tsx (novo) | T05 |
| frontend | components/products/ProductForm.test.tsx (estender) | T09 |
| frontend | components/caixa/CashierScreen.test.tsx (estender) | T08, T10 |

### Coverage vs Requirements
| RF/RN | Test Cases | Covered? |
|-------|------------|----------|
| RF01 | T01 | ✅ |
| RF02 | T02 | ✅ |
| RF03 | T03, T04 | ✅ |
| RF04 | T05 | ✅ |
| RF05 | T06 | ✅ |
| RF06 | T07 (positivo + ids inválidos) | ✅ |
| RF07 | T08, T09 | ✅ |
| RF08 | T10 (chip presente + ausente) | ✅ |
| RN01 | T11 (neg), T12 (pos) | ✅ |
| RN02 | T13 (neg), T14 (neg), T01 (pos, tenant próprio) | ✅ |
| RN03 | T15, T16, T17, T18 (pos), T19 (neg) | ✅ |
| RN04 | T20 (neg), T03 + T10 (pos, estado null filtrável) | ✅ |
| RN05 | T21 (auto + ciclo), T01 (cor explícita) | ✅ |
| RN06 | T22 (neg), T01 (pos, nome comum) | ✅ |
| RN07 | T23 | ✅ |
| RNF01 | T13 (auto-coberto pela suite parametrizada 0020F) | ✅ |

---

## Database

### Entities
| Entity | Table | Key Fields | Reference |
|--------|-------|------------|-----------|
| ProductCategory | product_categories | id, tenant_id FK→tenants (cascade), name, color, position int, created_at, updated_at | Similar: `db/schema/customers.ts` |
| Product (retrofit) | products | + category_id uuid NULL FK→product_categories.id (ON DELETE SET NULL); coluna `category` text existente permanece (deprecated, não lida pelo app após o retrofit) | `db/schema/products.ts:46` |

### Migration
- Create: `product_categories` — id uuid PK, tenant_id FK cascade, name text NOT NULL, color text NOT NULL, position integer NOT NULL default 0, created_at/updated_at timestamp. Índices: `product_categories_tenant_idx` (tenant_id) e unique `product_categories_tenant_name_unique` (tenant_id, name) — guarda exata no banco; RN01 (case/accent-insensitive) e RN06 (nome reservado "Sem categoria") são checados na service layer antes do insert/update, pois o projeto não tem `unaccent`/`citext` configurado (sem precedente em `db/schema/`).
- Alter: `products` — adiciona `category_id uuid NULL REFERENCES product_categories(id) ON DELETE SET NULL`. A coluna `category` (text) NÃO é removida nesta feature (mantida como fallback/rollback); só é lida pelo script de backfill, o app para de escrever nela. Drop fica para chore de limpeza futura (fora de escopo — exige confirmação explícita).
- RLS: novo arquivo `db/migrations/0012_categorias_rls.sql` (próximo número após 0011) — GRANT + ENABLE RLS + policy `tenant_isolation` usando `current_app_tenants()`, padrão single-table de `db/migrations/0011_override_rls.sql`.
- **Ordem crítica (push-only, sem release faseado):**
  1. `db:setup` (push --force) cria `product_categories` e a coluna `products.category_id`; `products.category` permanece intocada (ainda declarada no schema) — preserva a fonte de dados para o backfill.
  2. `npm run db:rls` aplica `0012_categorias_rls.sql`.
  3. Novo script idempotente `scripts/seed-product-categories.ts` (conexão owner `db`, bypassa RLS — mesmo padrão de `db/seeds/founder.ts` e `scripts/verify-prod.ts`): para cada tenant existente, `INSERT ... ON CONFLICT (tenant_id, name) DO NOTHING` das 7 categorias padrão (cores herdadas 1:1 de `CATEGORY_COLORS` em `components/caixa/CashierScreen.tsx:21-29`, position 0-6); depois `UPDATE products SET category_id = ... WHERE category_id IS NULL AND category IS NOT NULL` casando por nome dentro do tenant. Roda a cada boot (idempotente, no-op após a primeira vez) — adicionar ao `CMD` do `Dockerfile:31`, entre `db:setup` e `verify:prod`. **[Superado parcialmente pelo Gap Fix 1: execução por tenant é gated pela flag `product_categories_seeded_at` — ver seção Gap Fixes.]**
  4. Tenants novos: inserir as 7 categorias padrão dentro da própria transação de `createUserWithTenant` (`lib/services/tenants/onboarding.ts:12-40`, já roda no `db` owner) — cobre RN03 sem depender do script de boot.
- Reference: `db/migrations/0011_override_rls.sql`, `scripts/verify-prod.ts`, `db/seeds/founder.ts`, `Dockerfile:31`, `lib/services/tenants/onboarding.ts:12-40`.

### Repository
| Method | Purpose |
|--------|---------|
| insertProductCategory | Cria categoria (RF01); se `color` omitido, aplica próxima cor da paleta cíclica (RN05) |
| selectProductCategories | Lista categorias do tenant ordenadas por `position` (RF05/RF06) |
| selectProductCategoryById | Busca uma categoria por id, filtrada por tenant |
| updateProductCategory | Renomeia/recolore (RF02); valida nome único e não-reservado (RN01/RN06) |
| updateProductCategoryPositions | Reordena em lote a partir de lista de ids (RF06) |
| countProductsByCategory | Conta produtos vinculados — base da mensagem de confirmação (RF03) |
| deleteProductCategory | Exclui categoria; `ON DELETE SET NULL` move produtos para "Sem categoria" (RF03/RN04) |

Reference: `lib/services/finance/customer-data.ts` (data layer) + `lib/services/finance/customer-service.ts` (service com `withUserRls`); retrofit de leitura/escrita de `category_id` em `lib/services/products/data.ts:1-38`.

---

## Backend

Commands/Events/Workers: N/A — projeto usa server actions (Next.js 16 App Router; pipeline `safeParse → requireAuthContext → guards → service → ActionResult`, padrão `app/(app)/products/actions.ts:31`).

### Server Actions

Novo arquivo `app/(app)/products/categories/actions.ts`. Guards: escritas = `requireActiveTenant` + `requirePermission(ctx, "produtos")`; leitura = `requireAnyPermission(ctx, ["produtos", "caixa"])` (chips do caixa, mesmo precedente de `listProductsForCaixaAction`). Escritas fazem `revalidatePath` em `/products`, `/products/categories` e `/caixa`.

| Action | Input (zod) | Output | Purpose |
|--------|-------------|--------|---------|
| createProductCategoryAction | createProductCategorySchema | ActionResult\<ProductCategoryDto\> | RF01/RF04 — cria; retorna DTO p/ seleção inline; entra no fim da ordem |
| listProductCategoriesAction | — | ActionResult\<ProductCategoryDto[]\> | RF05/RF06/RF07 — lista ordenada por `position` |
| updateProductCategoryAction | updateProductCategorySchema | ActionResult\<ProductCategoryDto\> | RF02/RF05 — renomeia e/ou recolore |
| reorderProductCategoriesAction | reorderProductCategoriesSchema | ActionResult\<ProductCategoryDto[]\> | RF06 — ordem manual (lista completa de ids) |
| countProductsInCategoryAction | productCategoryIdSchema | ActionResult\<{ count: number }\> | RF03 — "N produtos serão movidos" pré-confirmação |
| deleteProductCategoryAction | productCategoryIdSchema | ActionResult\<{ id: string; movedCount: number }\> | RF03 — exclui; FK `SET NULL` move produtos p/ Sem categoria |
| createProductAction / updateProductAction (modificar) | createProductSchema / updateProductSchema | ActionResult\<ProductDto\> | Passam a aceitar `categoryId` (uuid nullable) no lugar de `category` string |
| listProductsForCaixaAction (sem mudança de assinatura) | — | ActionResult\<ProductDto[]\> | RF07/RF08 — ProductDto passa a embutir a categoria via join; chip "Sem categoria" é derivado no client (`category === null`) |

### Schemas & DTOs

Schemas em `lib/validation/product.ts` (domínio produto, padrão `lib/validation/finance.ts`); DTOs em `types/product.ts`.

| Schema/DTO | Fields | Validations |
|-----|--------|-------------|
| createProductCategorySchema | name, color? | name trim min(1) max(50); color `z.enum` das chaves de CATEGORY_PALETTE, optional (RN05 no service) |
| updateProductCategorySchema | id, name?, color? | id `z.uuid`; demais como acima, partial |
| reorderProductCategoriesSchema | orderedIds | `z.array(z.uuid()).min(1)` — lista COMPLETA das categorias do tenant |
| productCategoryIdSchema | id | `z.uuid("Categoria inválida")` |
| createProductObject (modificar) | categoryId substitui category | `z.preprocess(emptyToUndefined, z.uuid().nullable().optional())` (`lib/validation/product.ts:43`) |
| CATEGORY_PALETTE (const) | 8–10 slugs → { bg, fg, bd } hex | 7 primeiras = cores atuais de CATEGORY_COLORS (`components/caixa/CashierScreen.tsx:21-29`); exportada client-safe |
| ProductCategoryDto | id, name, color, position, createdAt, updatedAt | color = slug da paleta; datas ISO string |
| ProductDto (retrofit) | `category: string \| null` → `{ id, name, color } \| null` | montado por LEFT JOIN na data layer; `null` = Sem categoria (RN04) |

### Services & Data Layer

`lib/services/products/category-service.ts` + `category-data.ts` (padrão `lib/services/finance/customer-service.ts` / `customer-data.ts`: service envolve `withUserRls(ctx.userId, tx => ...)`; data recebe `Executor` + `tenantId`, devolve DTO). RN01/RN06 no service via helper `normalizeCategoryName` (lowercase + remoção de acento `normalize("NFD")`), comparando contra as categorias do tenant antes de insert/update; unique index `(tenant_id, name)` é o backstop exato (seção Database).

| Function | Layer | Purpose |
|----------|-------|---------|
| createProductCategory(ctx, input) | service | RN01/RN06 → RN05 cor cíclica `palette[count % len]` → position = max+1 |
| listProductCategories(ctx) | service | Lista ordenada por position |
| updateProductCategory(ctx, input) | service | RN01 (excluindo o próprio id) + RN06 no rename; NotFound se id fora do tenant |
| reorderProductCategories(ctx, orderedIds) | service | Valida que ids == conjunto do tenant; grava positions 0..n-1 |
| countProductsInCategory(ctx, id) / deleteProductCategory(ctx, id) | service | RF03 — delete conta antes de excluir e retorna movedCount |
| insertProductCategory / selectProductCategories / selectProductCategoryById / updateProductCategoryRow / updateProductCategoryPositions / countProductsByCategoryId / deleteProductCategoryRow | data | Queries Drizzle puras, filtro `tenant_id` aditivo à RLS, mapper toProductCategoryDto |
| createProduct / updateProduct (modificar) | service | Threading de `categoryId`; **checagem obrigatória**: `selectProductCategoryById` sob RLS antes de gravar — FK do Postgres é checada como owner e NÃO passa pela RLS, então categoryId de outro tenant passaria na constraint |
| insertProduct / updateProductRow / selects (modificar) | data | `Create/UpdateProductData` trocam `category` → `categoryId`; selects ganham LEFT JOIN `product_categories` p/ `ProductDto.category` (`lib/services/products/data.ts:70,148`) |

RN07 (verificado, sem código): `sale_items` guarda `name_snapshot` + `product_id ON DELETE SET NULL` (`db/schema/sale-items.ts:35-38`) e não referencia categoria — excluir/renomear categoria nunca toca vendas lançadas.

### Typed Errors

Classes existentes de `lib/services/errors.ts`; actions traduzem via `toActionError` (nada novo a criar).

| Error | Trigger | User-facing message |
|-------|---------|---------------------|
| ConflictError(msg, "name") | RN01 — nome duplicado no tenant (check normalizado ou `isUniqueViolation` 23505) | "Já existe uma categoria com esse nome" |
| ValidationError(msg, { name }) | RN06 — criar/renomear para "Sem categoria" (normalizado) | "\"Sem categoria\" é um nome reservado" |
| NotFoundError | id inexistente no tenant (update/delete/count) | "Categoria não encontrada" |
| ValidationError | reorder com ids que não batem com o tenant; ou `categoryId` inválido em produto | "Lista de categorias inválida" / "Categoria inválida" |

### Module Structure

- **Create:** `app/(app)/products/categories/actions.ts` · `lib/services/products/category-service.ts` (+ `category-service.test.ts`) · `lib/services/products/category-data.ts`
- **Modify:** `lib/validation/product.ts` (schemas + palette + categoryId; `PRODUCT_CATEGORIES` só sai quando frontend/seed migrarem) · `types/product.ts` · `lib/services/products/product-service.ts` · `lib/services/products/data.ts` · `app/(app)/products/actions.ts`
- Schema/RLS/seed/onboarding: cobertos pela seção Database (não repetir aqui).

Reference: `app/(app)/products/actions.ts` · `app/(app)/financeiro/customers/actions.ts` · `lib/services/finance/customer-service.ts` · `lib/services/finance/customer-data.ts` · `lib/services/products/product-service.ts:193` (listProductsForCaixa) · `lib/services/errors.ts` · `app/(app)/caixa/page.tsx`

---

## Frontend

### Pages
| Route | Page Component | Purpose |
|-------|----------------|---------|
| /products/categories (nova) | `app/(app)/products/categories/page.tsx` — RSC `force-dynamic` | RF05/RF06 — gestão: listar, renomear, recolorir, reordenar, excluir |
| /products (modificar) | `app/(app)/products/page.tsx` | Link "Gerenciar categorias" no header (acesso à RF05) |
| /products/new + /products/[id]/edit (modificar) | `app/(app)/products/new/page.tsx`, `app/(app)/products/[id]/edit/page.tsx` | RSC busca `listProductCategoriesAction()` e injeta `categories` no form |
| /caixa (modificar) | `app/(app)/caixa/page.tsx` | RSC busca categorias + produtos e injeta em `CashierScreen` (RF07/RF08) |

Decisão RF05 = **rota própria** (não modal): precedente direto `app/(app)/financeiro/clientes/page.tsx` (CRUD auxiliar em página dedicada), o backend já aloca `app/(app)/products/categories/actions.ts`, e página plena é melhor no mobile (lista + reorder + dialogs sem empilhar overlay sobre overlay).

### Components
{"CategoryManager":{"location":"components/products/CategoryManager.tsx","status":"new","purpose":"client: lista com chip colorido, reorder ▲▼ (botões 44px, sem drag — mais simples p/ owner beginner), editar, excluir"},"CategoryFormDialog":{"location":"components/products/CategoryFormDialog.tsx","status":"new","purpose":"Dialog criar/editar: nome + paleta 8–10 swatches de CATEGORY_PALETTE (RF01/RN05); reusado pelo manager e pelo select inline"},"CategorySelect":{"location":"components/products/CategorySelect.tsx","status":"new","purpose":"select nativo dinâmico + opção '+ Nova categoria' que abre CategoryFormDialog (RF04); preserva classes 0023H (bg-background, h-9, focus-visible ring) do select atual"},"ProductForm":{"location":"components/products/ProductForm.tsx","status":"modify","purpose":"estado category:string → categoryId:string|null; campo Categoria usa CategorySelect; ordem de campos e save bar 0024H intactas"},"NewProductForm + EditProductForm":{"location":"components/products/NewProductForm.tsx, EditProductForm.tsx","status":"modify","purpose":"threading da prop categories: ProductCategoryDto[] até ProductForm"},"CashierScreen":{"location":"components/caixa/CashierScreen.tsx","status":"modify","purpose":"remove PRODUCT_CATEGORIES/CATEGORY_COLORS; chips por position com cor do DB; chip 'Sem categoria' no fim (RF08); filtro por category.id"},"Cart + use-cart":{"location":"components/caixa/Cart.tsx, use-cart.ts","status":"modify","purpose":"CartItem.category espelha novo shape {id,name,color}|null p/ cor do tile"},"ProductsTable":{"location":"components/products/ProductsTable.tsx","status":"modify","purpose":"badge colorida com nome da categoria na listagem (RF07)"}}

### State & Data Flow
- **Gestão (/products/categories):** RSC aguarda `listProductCategoriesAction()` → prop de `CategoryManager`. Mutações no client com `useTransition` + action (`update/reorder/delete`) → `router.refresh()` (padrão `components/admin/TenantTable.tsx:61`); actions já fazem `revalidatePath` de /products, /products/categories e /caixa (seção Backend). Excluir: `countProductsInCategoryAction` → `AlertDialog` "N produtos serão movidos para Sem categoria" → `deleteProductCategoryAction` → `toast.success` com `movedCount` (RF03). Reorder ▲▼: swap otimista em `useState`, envia lista COMPLETA `orderedIds`, reverte + `toast.error` se `!result.ok` (RF06).
- **Form de produto (new/edit):** página RSC busca categorias e passa prop; `CategorySelect` mantém a lista em `useState` local (ordenada por `position`). Criação inline: `createProductCategoryAction` → DTO retornado é appended à lista local e selecionado (RF04, sem refetch — entra no fim da ordem por `position=max+1` no service). Validação client `safeParse` + `fieldErrors` inline (padrão `ProductForm.tsx:107`).
- **Caixa (/caixa):** RSC busca categorias + produtos; zero cache client. Chips = "Todos" + categorias por `position` + "Sem categoria" ao fim quando `products.some(p => p.category === null)` (RF08); estilo do chip via `CATEGORY_PALETTE[category.color]`; filtro ativo por `category.id` (ou `null` p/ Sem categoria) — some o fallback `?? "Outros"` de `CashierScreen.tsx:76,85` (RN04). RN07: telas abertas refletem no próximo render RSC (revalidatePath já cobre).
- Sem TanStack Query/Zustand em lugar nenhum — `useState`/`useTransition` + server actions + `router.refresh()`, conforme `.codeadd/skills/project-patterns/frontend.md`.

### Types (mirror from backend)
{"ProductCategoryDto":{"fields":"id, name, color (slug da paleta), position, createdAt/updatedAt ISO string","sourceDTO":"ProductCategoryDto (seção Backend) — em types/product.ts"},"ProductCategoryRef":{"fields":"{ id, name, color } — ProductDto.category: ProductCategoryRef | null (null = Sem categoria, RN04)","sourceDTO":"ProductDto retrofit (seção Backend)"},"CreateProductCategoryInput / UpdateProductCategoryInput / ReorderProductCategoriesInput":{"fields":"z.infer dos schemas; name max(50), color enum da paleta, orderedIds uuid[]","sourceDTO":"createProductCategorySchema / updateProductCategorySchema / reorderProductCategoriesSchema (lib/validation/product.ts)"},"CreateProductInput (retrofit)":{"fields":"category:string → categoryId: uuid | null opcional","sourceDTO":"createProductObject retrofit (seção Backend)"},"CATEGORY_PALETTE":{"fields":"const client-safe slug → { bg, fg, bd } hex; 7 primeiras = CATEGORY_COLORS atuais (CashierScreen.tsx:21-29)","sourceDTO":"CATEGORY_PALETTE (seção Backend, lib/validation/product.ts)"}}

Reference: `components/products/ProductForm.tsx:164-175` · `components/caixa/CashierScreen.tsx:21-89` · `components/caixa/use-cart.ts:14` · `components/financeiro/CustomerPicker.tsx` · `app/(app)/financeiro/clientes/page.tsx` · `app/(app)/products/page.tsx` · `components/admin/TenantTable.tsx:61` · `types/product.ts:10`

---

## Gap Fixes

Ajustes de consolidação após validação cruzada dos planos de área — cada item complementa (ou supera, quando indicado) o conteúdo acima:

1. **Seed gated por tenant (supera o passo 3 da Ordem crítica em Database):** `scripts/seed-product-categories.ts` continua no boot (`Dockerfile` CMD), mas pula tenants com `product_categories_seeded_at` preenchida; para tenants pendentes, seed das 7 padrão + backfill de produtos + gravação da flag rodam na MESMA transação. Motivo: seed a cada boot só com `ON CONFLICT` recriaria categoria padrão excluída (T19) e o backfill re-executado re-vincularia produto que o usuário moveu para "Sem categoria" (a coluna `category` text antiga permanece com o valor legado). Onboarding (`createUserWithTenant`) insere as 7 padrão E grava a flag na própria transação (T18).
2. **Coluna nova em `tenants`:** `product_categories_seeded_at timestamp NULL` (snake_case). Sem impacto na suite de isolamento (tabela `tenants` não tem `tenant_id`; flag lida apenas pela conexão owner).
3. **Const compartilhada das 7 padrão:** nomes + slugs de cor viram const única (`DEFAULT_PRODUCT_CATEGORIES`, junto de `CATEGORY_PALETTE` em `lib/validation/product.ts`), consumida por seed script + onboarding + testes T15/T18 — fonte única em vez de duplicar a lista em 3 lugares. `PRODUCT_CATEGORIES` atual só é removida quando ProductForm/CashierScreen/seeds migrarem.
4. **Seeds de dev:** `scripts/seed-testfull.ts` e `scripts/seed-test-stores.ts` criam produtos com categoria string — atualizar para criar categorias antes e vincular por `categoryId` (risco 3 da discovery; sem isso `npm run` desses seeds gera produtos "Sem categoria").

## Main Flow

1. Owner → `/products` → link "Gerenciar categorias" → `/products/categories` (RSC lista via `listProductCategoriesAction`).
2. Owner cria/renomeia/recolore/reordena → server action (guards `produtos`) → service (RN01/RN05/RN06) → data (RLS) → `revalidatePath` em /products, /products/categories, /caixa.
3. Owner exclui → `countProductsInCategoryAction` → AlertDialog "N produtos serão movidos para Sem categoria" → confirma → `deleteProductCategoryAction` → FK SET NULL → toast com `movedCount`.
4. Owner no form de produto → `CategorySelect` → "+ Nova categoria" → `CategoryFormDialog` → `createProductCategoryAction` → DTO volta selecionado no fim da ordem.
5. Operador no `/caixa` → RSC injeta categorias + produtos → chips "Todos" + categorias por `position` + "Sem categoria" ao fim (se houver produto sem categoria) → filtro por `category.id`.
6. Deploy → boot roda `db:setup` → `db:rls` → `seed-product-categories.ts` (tenants pendentes: 7 padrão + backfill + flag) → app sobe com dados migrados.

## Tasks

Quebra de alto nível ordenada por dependência (o checklist executável com TDD vive em `tasks.md`):

- [ ] 1. database: schema `product_categories` + `products.category_id` + `tenants.product_categories_seeded_at` + export em `db/schema/index.ts` — sinal: `db:setup` aplica sem erro — **S**
- [ ] 2. database: `db/migrations/0012_categorias_rls.sql` + `db:rls` — sinal: suite tenant-isolation passa com a tabela nova (T13) — **S**
- [ ] 3. database: `DEFAULT_PRODUCT_CATEGORIES` + `CATEGORY_PALETTE` + `scripts/seed-product-categories.ts` (gated por flag) + onboarding com 7 padrão + Dockerfile CMD — sinal: T15–T19 passam — **M**
- [ ] 4. backend: schemas zod + `category-data.ts` + `category-service.ts` — sinal: T01–T03, T07, T11–T12, T20–T23 passam — **M**
- [ ] 5. backend: `app/(app)/products/categories/actions.ts` (6 actions) — sinal: typecheck + smoke das actions com guards — **S**
- [ ] 6. backend: retrofit produto (`categoryId` em validation/service/data/actions + LEFT JOIN no ProductDto + guard cross-tenant) — sinal: T14 passa; caixa e listagem recebem `category` no DTO — **M**
- [ ] 7. frontend: `CategoryFormDialog` + `CategorySelect` + `CategoryManager` + página `/products/categories` + link em /products — sinal: T04–T06 passam; fluxo completo no mobile — **M**
- [ ] 8. frontend: retrofit `ProductForm`/`NewProductForm`/`EditProductForm` (T09) e `CashierScreen`/`Cart`/`use-cart`/`ProductsTable` (T08, T10) — sinal: testes passam + visual 0023H/0024H preservado — **M**
- [ ] 9. database/dev: atualizar `scripts/seed-testfull.ts` + `scripts/seed-test-stores.ts` p/ `categoryId` — sinal: seeds rodam e produtos saem categorizados — **S**
- [ ] 10. validação final: gates (lint/typecheck/test/build) + checklist manual mobile — sinal: exit 0 nos 4 gates — **S**

Implementation order: `Database (1-3) → Backend (4-6) → Frontend (7-8) → Dev seeds (9) → Gates (10)`.

## Requirements Coverage

| ID | Requirement | Covered? | Feature/Area | Tasks | Tests |
|----|-------------|----------|--------------|-------|-------|
| RF01 | Criar categoria (nome + cor opcional de paleta) | YES | Backend + Frontend | 4, 5, 7 | T01 |
| RF02 | Renomear com reflexo imediato | YES | Backend + Frontend | 4, 5, 7 | T02 |
| RF03 | Excluir com contagem + mover p/ Sem categoria | YES | Database + Backend + Frontend | 1, 4, 5, 7 | T03, T04 |
| RF04 | Criação inline no form de produto | YES | Frontend + Backend | 5, 7, 8 | T05 |
| RF05 | Superfície de gestão completa | YES | Frontend | 7 | T06 |
| RF06 | Ordem manual (select e chips seguem) | YES | Backend + Frontend | 4, 5, 7, 8 | T07 |
| RF07 | Select/chips/exibições gerados do tenant | YES | Backend + Frontend | 6, 8 | T08, T09 |
| RF08 | Chip "Sem categoria" condicional no caixa | YES | Frontend | 8 | T10 |
| RN01 | Nome único por tenant (case/accent-insensitive) | YES | Database + Backend | 1, 4 | T11, T12 |
| RN02 | tenant_id + RLS na tabela nova | YES | Database + Backend | 1, 2, 6 | T13, T14 |
| RN03 | Seed 7 padrão + migração de produtos existentes | YES | Database | 3 | T15–T19 |
| RN04 | "Sem categoria" = ausência (null), não registro | YES | Backend + Frontend | 4, 6, 8 | T20 |
| RN05 | Cor automática da paleta, cíclica | YES | Backend | 4 | T21 |
| RN06 | "Sem categoria" é nome reservado | YES | Backend | 4 | T22 |
| RN07 | Vendas lançadas intocadas | YES | Backend (verificação, sem código novo) | 4 (T23) | T23 |
| RNF01 | Cobertura automática do teste de isolamento | YES | Database | 2 | T13 |

Coverage: **16/16 = 100%** (nenhuma exclusão).

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| Backfill não casa string legada (typo/valor fora da lista fixa) | baixa | produto ficaria sem categoria | UPDATE casa por nome exato dentro do tenant; não-casados ficam "Sem categoria" (RN04) e seguem filtráveis (RF08); T16 compara contagens antes/depois |
| Regressão visual no caixa/form (0023H/0024H) | média | UX mobile quebra em produção | CategorySelect herda as classes do select atual por contrato; T08–T10 + checklist manual mobile na Validation |
| Falha parcial do seed no boot | baixa | tenant sem as 7 padrão / sem backfill | seed + backfill + flag em transação única por tenant; re-run do boot cobre tenants pendentes; T15/T17/T19 |
| categoryId cross-tenant via FK (FK não passa por RLS) | baixa | vazamento de referência entre lojas | guard no service (T14) + RLS na tabela (T13) |
| Seeds de dev desatualizados mascaram bugs locais | média | dev testa cenário irreal (tudo Sem categoria) | Task 9 atualiza os 2 seeds; sinal = produtos categorizados após rodar |

## Validation

- Gates obrigatórios (exit 0): `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`.
- Banco: `docker compose up -d` → `npm run db:setup` → suite com `DATABASE_URL` ativa (a tenant-isolation parametrizada deve incluir `product_categories` automaticamente).
- Testes novos/estendidos T01–T23 (seção Test Specification) passando nos arquivos mapeados.
- Manual mobile: form de produto (ordem de campos, save bar `bottom-16 z-50`), caixa (chips + BottomNav `z-40`), fluxo de exclusão com contagem, criação inline.
- Migração: contagem de produtos por categoria antes/depois do seed idêntica (success metric de {{doc:0025F}}).

## Quick Reference

| Pattern | Codebase reference |
|---|---|
| Entity/schema tenant-scoped | `db/schema/customers.ts` |
| RLS policy single-table | `db/migrations/0011_override_rls.sql` |
| Data layer | `lib/services/finance/customer-data.ts` |
| Service com withUserRls | `lib/services/finance/customer-service.ts` |
| Server actions CRUD | `app/(app)/financeiro/customers/actions.ts` |
| Picker com criação inline | `components/financeiro/CustomerPicker.tsx` |
| Chips + cores do caixa | `components/caixa/CashierScreen.tsx:21-89` |
| Seed idempotente owner | `db/seeds/founder.ts` · `scripts/verify-prod.ts` |
| Padrões por área (JIT) | `bash .codeadd/scripts/pattern-search.sh <área> [tópico]` |
