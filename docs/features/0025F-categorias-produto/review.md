# Review: 0025F — Categorias de Produto

> **Date:** 2026-07-11 | **Branch:** feature/0025F-categorias-produto

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` → exit 0 |
| Spec Compliance | ✅ PASSED | 33/33 itens do Acceptance Checklist COMPLIANT; 0 STALE TICK; RF/RN coverage 16/16 |
| Code Review Score | ✅ PASSED | 9.3/10 (frontend 9.0 + backend 9.5) / 2 — threshold ≥ 7 |
| Product Validation | ✅ PASSED | RF: 8/8, RN: 7/7, RNF: 1/1 — todos com evidência file:line; pré-requisitos presentes |
| Validation Gates | ⚠️ KNOWN ISSUES | `npm run lint` → exit 0 (8 warnings pré-existentes) · `npm run typecheck` → exit 0 · `npm test` → 565/566 (1 falha pré-existente em arquivo NÃO tocado, ver Known Issues) · `npm run build` → exit 0 |

| **Overall** | **✅ PASSED** | **Ready for merge** |

> Reviewed at: 2026-07-11
> Reviewed by: /add.review (model: claude-fable-5)

## Spec Compliance Audit

SPEC_AUDIT_STATUS = **COMPLIANT** — 33/33 itens, 16/16 RF/RN cobertos, nenhum tick stale.

| Grupo (itens) | Expected (plan.md) | Found at | Status |
|---|---|---|---|
| 6 actions de categoria | create/list/update/reorder/count/delete + guards + revalidatePath ×3 | `app/(app)/products/categories/actions.ts:42-151` (`/caixa` em :38) | COMPLIANT |
| DTOs (2) | ProductCategoryDto; ProductDto.category `{id,name,color}\|null` via LEFT JOIN | `types/product.ts:40-56`; `lib/services/products/data.ts:212-320` (5 selects) | COMPLIANT |
| Schemas (2) | createProductCategorySchema (1–50 + enum paleta); produto com categoryId nullable | `lib/validation/product.ts:86-92,128-131` | COMPLIANT |
| Service RN01/RN05/RN06 (4) | dup normalizado + ConflictError; cross-tenant ok; nome reservado; cor cíclica `palette[count % len]` | `lib/services/products/category-service.ts:17-68,108-146` | COMPLIANT |
| Guard RN02 (1) | `assertCategoryInTenant` sob RLS em create/update (FK não passa pela RLS) | `lib/services/products/product-service.ts:37-52,68,119` | COMPLIANT |
| Tabela + RLS (1) | unique (tenant_id,name) + policy `tenant_isolation` + suite parametrizada | `db/schema/product-categories.ts:49-52`; `db/migrations/0012_categorias_rls.sql:14-19`; `db/__tests__/tenant-isolation-regression.test.ts:344-356` | COMPLIANT |
| RN04/RN07 (2) | list nunca inclui "Sem categoria"; vendas lançadas intocadas | `category-service.ts` (specs T20/T23 verdes) | COMPLIANT |
| Seed/RN03 (7) | 7 padrão + backfill + flag na MESMA transação; no-resurrect; onboarding; const única; dev seeds; Dockerfile | `scripts/seed-product-categories.ts:84-115`; `lib/services/tenants/onboarding.ts:44-54`; `Dockerfile:33` | COMPLIANT |
| Frontend (8) | Manager 44px + AlertDialog contagem; select inline; ProductForm 0023H/0024H; chips dinâmicos + Sem categoria; rota + link; badge | `components/products/CategoryManager.tsx:89-229`; `ProductForm.tsx:172`; `components/caixa/CashierScreen.tsx:29-120`; `app/(app)/products/page.tsx:45`; `ProductsTable.tsx:58-60` | COMPLIANT |

Adição pós-plan (pedido do owner em sessão): toggle expandir/ocultar chips no caixa ("Todos" fixo, chip ativo visível recolhido) — coberta por 3 testes próprios em `CashierScreen.test.tsx`; não faz parte do contrato original.

## Code Review Summary

Reviewers despachados em paralelo (frontend: 20 arquivos; backend/database: 22 arquivos). **Zero achados CRITICAL/HIGH.** Pivots de `decisions.jsonl` validados como corretos (preprocess preserva `null` p/ limpar categoria; prop threading via CaixaShell).

### Correções aplicadas durante o review (2, ambas LOW — hardening)

| # | Severidade | Arquivo | Correção |
|---|---|---|---|
| 1 | LOW | `db/schema/products.ts` | Índice composto `products_tenant_category_idx (tenant_id, category_id)` — alinha com a convenção de receivables/stock_movements; cobre countProductsByCategoryId e os LEFT JOINs |
| 2 | LOW | `db/schema/product-categories.ts` | `CHECK product_categories_color_valid` restringindo `color` aos 10 slugs da paleta — paridade com `products_unit_valid` (defense-in-depth) |

Ambas aplicadas via `npm run db:setup` (índice + constraint confirmados no Postgres); suite de isolamento re-verificada 3/3.

### Observações não corrigidas (LOW/INFO, justificadas)

- `CashierScreen.tsx` — altura do botão "Categorias" (~34px) herda o padding dos chips pré-existentes; corrigir só o botão criaria inconsistência visual. Follow-up dedicado se desejado.
- `CashierScreen.tsx` — toggle renderiza mesmo com zero categorias (teórico: RN03 sempre semeia 7).
- `CategoryFormDialog.tsx` — grupo de swatches sem fieldset/aria-labelledby (cada swatch tem aria-label próprio; convenção igual ao EmojiPicker existente).
- Página `/products/categories` sem guard de página próprio — mesmo padrão do precedente `financeiro/clientes`; toda escrita é rejeitada server-side por `requirePermission("produtos")`.

### Scores

| Reviewer | Score | Racional |
|---|---|---|
| Frontend | 9.0/10 | Spec-compliant end-to-end, zero críticos; deduções por notas cosméticas que não regridem a feature |
| Backend | 9.5/10 | 16/16 RF/RN com evidência; risco RN02 (FK bypassa RLS) corretamente mitigado e testado; só 2 sugestões LOW de hardening (aplicadas) |
| **Overall** | **9.3/10** | |

## Product Validation

Product Status: **PASSED** — 16/16 requisitos verificados com evidência file:line (tabela completa no relatório do backend reviewer; resumo abaixo).

| ID | Status | Evidência |
|---|---|---|
| RF01–RF08 | COMPLIANT | actions + service + componentes (ver Spec Compliance Audit) |
| RN01 | COMPLIANT | `normalizeCategoryName` + ConflictError + unique index; T11/T12 |
| RN02 | COMPLIANT | RLS 0012 + `assertCategoryInTenant`; T13/T14 |
| RN03 | COMPLIANT | seed flag-gated transacional + onboarding + Dockerfile; T15–T19 |
| RN04 | COMPLIANT | null = ausência; nome reservado; T20 |
| RN05 | COMPLIANT | cor cíclica `palette[count % len]`; T21 |
| RN06 | COMPLIANT | rejeição de "Sem categoria" normalizado; T22 |
| RN07 | COMPLIANT | `sale_items` sem referência a categoria (name_snapshot); T23 |
| RNF01 | COMPLIANT | suite parametrizada cobre `product_categories` (20 tabelas) |

Pré-requisitos: tabela, policy RLS, paleta, permissões `produtos`/`caixa` — todos presentes.

### Known Issues (pré-existentes, fora do escopo 0025F)

- `components/admin/ReleaseDialog.test.tsx:42` — T67 (0013F) date-flaky; falha também no master; arquivo não tocado.
- 8 warnings de lint pré-existentes (`@next/next/no-img-element` ×6; `no-unused-vars` ×2 em `scripts/full-test.mjs`).
