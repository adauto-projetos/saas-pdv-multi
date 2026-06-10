# Tasks: 0003F — Estoque

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 17 |
| Services | database, backend, frontend, test |

> Apoia-se na fundação 0001F (produtos/RLS) + 0002F (venda). Inclui um **retrofit** do `finalizeSale` (registrar saída).

## Requirements Coverage

- [x] RF01 — Entrada de estoque (qtd + motivo)
- [x] RF02 — Ajuste por contagem real
- [x] RF03 — Venda registra movimentação de saída (retrofit 0002F)
- [x] RF04 — Movimento grava tipo/qtd/motivo/data/usuário
- [x] RF05 — Histórico por produto, filtrável
- [x] RF06 — Nível mínimo por produto
- [x] RF07 — Tela de estoque baixo
- [x] RF08 — Realce de estoque negativo na lista de produtos
- [x] RN01 — Movimentações isoladas por tenant (RLS)
- [x] RN02 — stock_quantity é a fonte; ajuste + log na mesma transação
- [x] RN03 — qtd entrada/saída > 0; contagem ≥ 0
- [x] RN04 — Movimento atribuído ao usuário logado
- [x] RN05 — Estoque pode ficar negativo
- [x] RN06 — min_stock opcional; sem min não alerta
- [x] RN07 — Quantidades em numeric(10,3) por unidade
- [x] RN08 — Saída de venda referencia sale_id

## TDD

- [x] T01 Entrada sobe estoque + grava log (RF01) — `lib/services/stock/stock-service.test.ts`
- [x] T02 Entrada qtd ≤ 0 rejeitada (RN03) — `lib/validation/stock.test.ts`
- [x] T03 Ajuste acerta estoque pela contagem (RF02) — `lib/services/stock/stock-service.test.ts`
- [x] T04 Ajuste contagem negativa rejeitada (RN03) — `lib/validation/stock.test.ts`
- [x] T05 Venda registra saída + baixa (RF03/RN08) — `lib/services/sales/sale-service.test.ts`
- [x] T06 Movimento ajusta estoque na mesma tx (RN02) — `lib/services/stock/stock-service.test.ts`
- [x] T07 Movimento grava tipo/qtd/motivo/usuário (RN04) — `lib/services/stock/stock-service.test.ts`
- [x] T08 Histórico retorna movimentos do produto (RF05) — `lib/services/stock/stock-service.test.ts`
- [x] T09 Histórico filtra por tipo (RF05) — `lib/services/stock/stock-service.test.ts`
- [x] T10 Define min_stock do produto (RF06) — `lib/services/stock/stock-service.test.ts`
- [x] T11 Lista estoque baixo (≤ min) (RF07) — `lib/services/stock/stock-service.test.ts`
- [x] T12 Produto sem min não dispara alerta (RN06) — `lib/services/stock/stock-service.test.ts`
- [x] T13 Estoque pode ficar negativo (RN05) — `lib/services/stock/stock-service.test.ts`
- [x] T14 Movimentação isolada por tenant (RN01) — `db/__tests__/stock-rls.test.ts`
- [x] T15 tenant/user vêm da sessão (RN01/RN04) — `lib/services/stock/stock-service.test.ts`
- [x] T16 Quantidade respeita numeric(10,3) (RN07) — `lib/services/stock/stock-service.test.ts`
- [x] T17 Dialog de movimentação valida e envia (RF01/RF02) — `components/estoque/StockMovementDialog.test.tsx`
- [x] T18 Lista de estoque baixo renderiza (RF07) — `components/estoque/LowStockList.test.tsx`
- [x] T19 min_stock editável no ProductForm (RF06) — `components/products/ProductForm.test.tsx`
- [x] T20 ProductsTable realça negativo (RF08) — `components/products/ProductsTable.test.tsx`

## Execution

- [x] T01 Schema: `min_stock` em products + tabela `stock_movements` + barrel
  - Service: database · Files: `db/schema/products.ts`, `db/schema/stock-movements.ts`, `db/schema/index.ts`
  - Deps: - · Verify: `npm run db:generate` inclui CHECK do type + índices + coluna min_stock

- [x] T02 Aplicar schema no banco
  - Service: database · Files: `db/migrations/0000_*`
  - Deps: T01 · Verify: `npm run db:push` cria `stock_movements` + `products.min_stock`

- [x] T03 RLS de movimentações
  - Service: database · Files: `db/migrations/0003_stock_rls.sql`
  - Deps: T02 · Verify: `npm run db:rls` cria policy `tenant_isolation` em stock_movements (TO app_user)

- [x] T04 Estender data layer de produtos
  - Service: backend · Files: `lib/services/products/data.ts`, `types/product.ts`
  - Deps: T02 · Verify: adjustProductStock(±)/setProductMinStock/selectLowStockProducts; `minStock` em ProductDto/toProductDto

- [x] T05 Data layer de estoque
  - Service: backend · Files: `lib/services/stock/data.ts`
  - Deps: T02 · Verify: insertMovement/selectMovements(filtros)/recordSaleExit; numeric→number coerido; filtra tenant

- [x] T06 Zod schemas de estoque
  - Service: backend · Files: `lib/validation/stock.ts`, `lib/validation/stock.test.ts`
  - Deps: T05 · Verify: `npx vitest run lib/validation/stock.test.ts` (T02, T04)

- [x] T07 Tipos de estoque
  - Service: backend · Files: `types/stock.ts`
  - Deps: - · Verify: `npx tsc --noEmit`; StockMovementDto/MovementType

- [x] T08 Serviço de estoque
  - Service: backend · Files: `lib/services/stock/stock-service.ts`, `*.test.ts`
  - Deps: T04, T05, T06, T07 · Verify: `npx vitest run lib/services/stock` (T01,T03,T06,T07,T08,T09,T10,T11,T12,T13,T15,T16)

- [x] T09 Retrofit: venda registra saída
  - Service: backend · Files: `lib/services/sales/sale-service.ts`, `lib/services/sales/sale-service.test.ts`
  - Deps: T05 · Verify: `npx vitest run lib/services/sales` (T05 + regressão da 0002F verde); usa `recordSaleExit` na mesma tx

- [x] T10 Server actions do estoque
  - Service: backend · Files: `app/(app)/estoque/actions.ts`
  - Deps: T08 · Verify: `npx tsc --noEmit`; tenant/user via requireAuthContext

- [x] T11 Teste de RLS de movimentações
  - Service: test · Files: `db/__tests__/stock-rls.test.ts`
  - Deps: T03, T08 · Verify: `npx vitest run db/__tests__/stock-rls.test.ts` (T14)

- [x] T12 Campo min_stock no ProductForm
  - Service: frontend · Files: `components/products/ProductForm.tsx`, `components/products/ProductForm.test.tsx`
  - Deps: T04 · Verify: `npx vitest run components/products/ProductForm.test.tsx` (T19)

- [x] T13 Realce de estoque negativo
  - Service: frontend · Files: `components/products/ProductsTable.tsx`, `components/products/ProductsTable.test.tsx`
  - Deps: T04 · Verify: `npx vitest run components/products/ProductsTable.test.tsx` (T20)

- [x] T14 Dialog de movimentação + seletor de produto
  - Service: frontend · Files: `components/estoque/StockMovementDialog.tsx`, `components/estoque/ProductPicker.tsx`, `components/estoque/StockMovementDialog.test.tsx`
  - Deps: T10 · Verify: `npx vitest run components/estoque/StockMovementDialog.test.tsx` (T17)

- [x] T15 Tela de estoque baixo
  - Service: frontend · Files: `app/(app)/estoque/page.tsx`, `components/estoque/LowStockList.tsx`, `components/estoque/LowStockList.test.tsx`
  - Deps: T10, T14 · Verify: `npx vitest run components/estoque/LowStockList.test.tsx` (T18); `npm run build`

- [x] T16 Histórico de movimentações
  - Service: frontend · Files: `app/(app)/estoque/[id]/page.tsx`, `components/estoque/MovementHistory.tsx`
  - Deps: T10 · Verify: `npm run build`; lista movimentos com filtro (RF05)

- [x] T17 Navegação (Estoque no header)
  - Service: frontend · Files: `app/(app)/layout.tsx`
  - Deps: T15 · Verify: `npm run build`; link Estoque no menu

## Acceptance Checklist

- [x] `stock_movements` tem `tenant_id`, `product_id`, `type` CHECK `in('entrada','saida','ajuste')`, `quantity numeric(10,3)`, `reason`, `sale_id` FK→sales SET NULL, `user_id`, `created_at` (RF04, RN08)
- [x] `products.min_stock numeric(10,3)` NULLABLE (RF06, RN06)
- [x] Índices `stock_movements(tenant_id, product_id, created_at)` e `(tenant_id)` (RF05, RNF perf)
- [x] RLS policy `tenant_isolation` em `stock_movements` (TO app_user) bloqueia cross-tenant (RN01)
- [x] `recordEntry` insere movimento `entrada`(+qty) e ajusta `stock_quantity` na MESMA `withUserRls` tx (RF01, RN02)
- [x] `recordAdjustment` calcula delta = contagem − atual, grava `ajuste` e seta `stock_quantity` = contagem (RF02)
- [x] `recordSaleExit` (chamado pelo `finalizeSale`) grava `saida`(−qty, sale_id) e ajusta, na tx da venda (RF03, RN08)
- [x] Zod rejeita entrada/saída ≤ 0 e contagem < 0 (RN03); `.finite()`
- [x] Movimento atribui `user_id` da sessão e grava `type`/`reason`; tenant da sessão (RN04, RN01)
- [x] `listMovements` retorna histórico do produto desc, com filtro por tipo/período (RF05)
- [x] `setMinStock` grava `min_stock` (aceita null) (RF06)
- [x] `listLowStock` retorna produtos com `stock_quantity ≤ min_stock` e `min_stock` não-nulo (RF07, RN06)
- [x] Estoque pode ficar negativo; saída não é bloqueada por falta de estoque (RN05)
- [x] Quantidades preservam `numeric(10,3)` (kg fracionário) (RN07)
- [x] `ProductForm` permite editar `min_stock` (RF06)
- [x] `ProductsTable` realça visualmente `stock_quantity < 0` (RF08)
- [x] `StockMovementDialog` registra entrada/ajuste; `EstoquePage` lista estoque baixo; `/estoque/[id]` mostra histórico; link no header (RF01,RF02,RF05,RF07)

## Quality Gates

- [x] `npm run typecheck` exit 0
- [x] `npm run lint` exit 0
- [x] `npm test` — todos verdes (Postgres local no ar)
- [x] `npm run build` exit 0
