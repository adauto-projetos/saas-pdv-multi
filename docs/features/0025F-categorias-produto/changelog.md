---
id: CHG0026
type: changelog
date: 2026-07-11
related: [0025F]
---

# CHG0026 — Feature 0025F: Categorias de Produto

## TL;DR

Entrega {{doc:0025F}}: a lista fixa de 7 categorias de produto (igual para todas as lojas) é substituída por categorias por tenant com CRUD completo — criar (inclusive inline no form de produto), renomear, recolorir, reordenar (▲▼) e excluir movendo produtos para "Sem categoria" após aviso com contagem. Todo tenant existente é migrado no deploy (seed das 7 padrão + backfill por nome, gated por flag, em transação única por tenant) e todo tenant novo nasce com as 7 no onboarding — cores hex idênticas às atuais, zero mudança visual. Review 9.3/10 PASSED (33/33 itens de spec, 16/16 RF/RN); 23 contract tests novos; suite de isolamento RLS passa a cobrir 20 tabelas. Sem breaking para o lojista.

## TOC

- [Changes](#changes)
- [Breaking](#breaking)
- [Migration](#migration)
- [Quick Ref](#quick-ref)

## Changes

- feat(db): tabela `product_categories` (tenant FK cascade, unique `(tenant_id, name)`, CHECK de `color` restrito à paleta, índice tenant) + FK `products.category_id` ON DELETE SET NULL + flag `tenants.product_categories_seeded_at` + policy RLS `tenant_isolation` em `db/migrations/0012_categorias_rls.sql` — {{doc:0025F}}
- feat(services): `lib/services/products/category-data.ts` + `category-service.ts` — RN01 nome único por tenant normalizado (case/acento) com ConflictError e unique index como backstop; RN06 "Sem categoria" reservado; RN05 cor automática cíclica `palette[count % len]`; reorder valida conjunto exato de ids e grava positions 0..n-1 — {{doc:0025F}}
- feat(api): 6 server actions em `app/(app)/products/categories/actions.ts` (create/list/update/reorder/count/delete) — escritas com `requireActiveTenant` + `requirePermission("produtos")`, leituras com `requireAnyPermission(["produtos","caixa"])`, `revalidatePath` em /products, /products/categories e /caixa — {{doc:0025F}}
- feat(products): retrofit `categoryId` fim a fim — schemas zod trocam `category` string por `categoryId` uuid nullable (`""`→undefined, `null` explícito limpa o vínculo); `ProductDto.category` vira `{ id, name, color } | null` via LEFT JOIN; guard `assertCategoryInTenant` sob RLS antes de gravar (a FK do Postgres é checada como owner e NÃO passa pela RLS) — {{doc:0025F}}
- feat(migração): `scripts/seed-product-categories.ts` gated por flag — por tenant pendente, 7 padrão + backfill de produtos legados por nome + gravação da flag na MESMA transação; re-run é no-op e categoria padrão excluída não ressuscita; onboarding `createUserWithTenant` insere as 7 + flag na própria transação; `Dockerfile` CMD roda o seed entre `db:setup` e `verify:prod` — {{doc:0025F}}
- feat(ui): rota `/products/categories` (RSC force-dynamic) com `CategoryManager` — chip colorido, renomear/recolorir via `CategoryFormDialog`, reorder ▲▼ com touch target 44px e swap otimista com revert, excluir com AlertDialog "N produtos serão movidos para Sem categoria" (contagem via action antes da confirmação); link "Gerenciar categorias" em /products — {{doc:0025F}}
- feat(ui): `CategorySelect` no ProductForm com criação inline "+ Nova categoria" (DTO retornado entra selecionado no fim da ordem, sem refetch), preservando classes 0023H e layout/save bar 0024H; badge colorida de categoria na `ProductsTable` — {{doc:0025F}}
- feat(caixa): chips dinâmicos por `position` com cor de `CATEGORY_PALETTE` + chip "Sem categoria" ao fim apenas quando existe produto sem categoria (filtro por `category.id`, fim do fallback `?? "Outros"`); `Cart`/`use-cart` espelham o novo shape — {{doc:0025F}}
- feat(caixa): toggle "Categorias" expande/oculta os chips — "Todos" sempre visível, chip do filtro ativo permanece visível recolhido, expandido usa wrap (sem scroll horizontal); pedido do owner pós-plan, coberto por 3 testes próprios — {{doc:0025F}}
- chore(cleanup): consts hardcoded `PRODUCT_CATEGORIES` e `CATEGORY_COLORS` removidas; `DEFAULT_PRODUCT_CATEGORIES` + `CATEGORY_PALETTE` (10 slugs, 7 primeiras = cores antigas 1:1) viram fonte única consumida por seed, onboarding, testes e UI — {{doc:0025F}}
- test: 23 contract tests (specs T01–T23) em 8 arquivos — service de categoria (11), guard cross-tenant (T14), seed/backfill/onboarding/idempotência/no-resurrect (T15–T19), manager/select/form/chips; suite parametrizada de isolamento RLS cobre `product_categories` (20 tabelas) via `seedProductCategory` — {{doc:0025F}}
- chore(db): hardening do review — índice composto `products_tenant_category_idx (tenant_id, category_id)` e CHECK `product_categories_color_valid` (paridade com `products_unit_valid`) — {{doc:0025F}}
- chore(seeds-dev): `seed-testfull.ts` e `seed-test-stores.ts` criam categorias antes e vinculam produtos por `categoryId` — {{doc:0025F}}
- chore(deploy): `scripts/deploy.sh` passa a usar `$HOME/.ssh/pdv_deploy` em vez de `/tmp/pdv_deploy` — mudança pré-existente fora do escopo 0025F, incluída no merge por decisão do owner

## Breaking

none — para o lojista e para qualquer consumidor externo. Duas mudanças de contrato interno, ambas migradas na própria feature: `ProductDto.category` mudou de `string | null` para `{ id, name, color } | null`, e os schemas de produto trocaram `category` por `categoryId` — todos os consumidores (ProductForm, CashierScreen, Cart, ProductsTable, seeds) foram atualizados neste mesmo merge. A coluna `products.category` (text) permanece no banco como deprecated (fonte do backfill e fallback de rollback; o app não a lê nem escreve). Visual do caixa idêntico no deploy: as 7 cores padrão são hex-a-hex as mesmas dos chips antigos.

## Migration

Migração é automática no boot do container (push-only, sem passo manual):

1. `npm run db:setup` (Dockerfile CMD) cria `product_categories`, `products.category_id`, `tenants.product_categories_seeded_at`, índices e CHECKs, e re-aplica as policies RLS (`db:rls`, incluindo `0012_categorias_rls.sql`).
2. `npx tsx scripts/seed-product-categories.ts` roda em seguida: para cada tenant com flag NULL, insere as 7 padrão (position 0–6, cores herdadas), faz o backfill `UPDATE products SET category_id = …` casando `category` text por nome dentro do tenant e grava a flag — tudo numa transação por tenant. Strings que não casam ficam "Sem categoria" (filtráveis via chip, RF08).
3. Verificação pós-deploy: contagem de produtos por categoria antes = depois (success metric de {{doc:0025F}}); re-run do seed é no-op.
4. Rollback: reverter o commit da feature — a coluna `category` text está intacta e volta a ser lida pelo código antigo; a tabela `product_categories` permanece no banco (inofensiva) até um chore de limpeza futuro; nenhuma venda/estoque é tocado (RN07).

## Quick Ref

```json
{
  "id": "0025F",
  "domain": "product-categories",
  "touched": [
    "db/schema/",
    "db/migrations/",
    "db/__tests__/",
    "lib/services/products/",
    "lib/services/tenants/",
    "lib/validation/",
    "types/",
    "app/(app)/products/",
    "app/(app)/caixa/",
    "components/products/",
    "components/caixa/",
    "scripts/"
  ],
  "patterns": [
    "tenant-scoped-crud",
    "rls-isolation-policy",
    "server-actions-revalidatepath",
    "fk-set-null-soft-detach",
    "flag-gated-seed-backfill",
    "palette-slug-color-cycle",
    "cross-tenant-fk-guard"
  ],
  "keywords": [
    "categorias",
    "produto",
    "chips",
    "caixa",
    "paleta",
    "seed",
    "backfill",
    "reorder"
  ]
}
```
