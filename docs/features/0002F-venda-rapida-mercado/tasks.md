# Tasks: 0002F — Venda Rápida (Mercado)

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 17 |
| Services | database, backend, frontend, test |

> Apoia-se 100% na fundação da 0001F (RLS, auth, dinheiro em centavos, padrões de Server Actions/UI). Nenhuma tarefa de scaffolding.

## Requirements Coverage

- [x] RF01 — Adicionar produto por código de barras
- [x] RF02 — Buscar produto por nome
- [x] RF03 — Item por peso (kg): subtotal = preço × peso
- [x] RF04 — Editar quantidade e remover item do carrinho
- [x] RF05 — Subtotal por item + total da venda ao vivo
- [x] RF06 — Finalizar com forma de pagamento (rótulo)
- [x] RF07 — Registrar a venda e baixar o estoque
- [x] RF08 — Cancelar/limpar a venda em andamento
- [x] RF09 — Listar as vendas do dia atual
- [x] RF10 — Foco automático no código + Enter adiciona
- [x] RN01 — Vendas isoladas por tenant (RLS)
- [x] RN02 — Preço é snapshot do produto na venda
- [x] RN03 — Não finalizar venda com carrinho vazio
- [x] RN04 — Quantidade/peso > 0
- [x] RN05 — Estoque pode ficar negativo (sem bloquear)
- [x] RN06 — Total em centavos (inteiro)
- [x] RN07 — Forma de pagamento de lista fixa (enum)
- [x] RN08 — Venda atribuída ao usuário logado
- [x] RNF01 — Adição/total percebidos como instantâneos

## TDD

- [x] T01 Lookup por código retorna produto (RF01) — `lib/services/sales/lookup.test.ts`
- [x] T02 Lookup código inexistente → null (RF01) — `lib/services/sales/lookup.test.ts`
- [x] T03 Busca por nome retorna lista (RF02) — `lib/services/sales/lookup.test.ts`
- [x] T04 Subtotal por peso (kg) round (RF03) — `lib/services/sales/sale-service.test.ts`
- [x] T05 Total = soma dos subtotais (RF05/RN06) — `lib/services/sales/sale-service.test.ts`
- [x] T06 Finalizar grava venda + itens (RF07) — `lib/services/sales/sale-service.test.ts`
- [x] T07 Finalizar baixa o estoque (RF07) — `lib/services/sales/sale-service.test.ts`
- [x] T08 Preço é snapshot do servidor (RN02) — `lib/services/sales/sale-service.test.ts`
- [x] T09 Carrinho vazio não finaliza (RN03) — `lib/validation/sale.test.ts`
- [x] T10 Quantidade ≤ 0 rejeitada (RN04) — `lib/validation/sale.test.ts`
- [x] T11 Estoque pode ficar negativo (RN05) — `lib/services/sales/sale-service.test.ts`
- [x] T12 Forma de pagamento inválida rejeitada (RN07) — `lib/validation/sale.test.ts`
- [x] T13 Venda atribuída ao usuário (RN08) — `lib/services/sales/sale-service.test.ts`
- [x] T14 Tenant A não vê venda de B (RN01) — `db/__tests__/sales-rls.test.ts`
- [x] T15 Vendas do dia (RF09) — `lib/services/sales/sale-service.test.ts`
- [x] T16 tenantId vem da sessão (RN01) — `lib/services/sales/sale-service.test.ts`
- [x] T17 Carrinho add/editar/remover (RF04/RF08) — `components/caixa/Cart.test.tsx`
- [x] T18 Foco + Enter adiciona (RF10) — `components/caixa/BarcodeInput.test.tsx`
- [x] T19 Diálogo de pagamento finaliza (RF06) — `components/caixa/PaymentDialog.test.tsx`

## Execution

- [x] T01 Schema `sales` + `sale_items` (Drizzle) + barrel
  - Service: database · Files: `db/schema/sales.ts`, `db/schema/sale-items.ts`, `db/schema/index.ts`
  - Deps: - · Verify: `npm run db:generate` inclui CHECK (total/subtotal>=0, quantity>0, payment_method enum) + índices

- [x] T02 Aplicar schema no banco
  - Service: database · Files: `db/migrations/0000_*` (regerado)
  - Deps: T01 · Verify: `npm run db:push` cria `sales`/`sale_items` no Postgres local

- [x] T03 RLS de vendas
  - Service: database · Files: `db/migrations/0002_sales_rls.sql`, `scripts/apply-rls.ts`
  - Deps: T02 · Verify: `npm run db:rls` cria policy `tenant_isolation` em sales + sale_items (TO app_user)

- [x] T04 Lookup de produto (código + nome)
  - Service: backend · Files: `lib/services/products/data.ts`
  - Deps: T02 · Verify: `selectProductByBarcode`, `searchProductsByName` filtram por tenant; `npx tsc --noEmit`

- [x] T05 Data layer de vendas
  - Service: backend · Files: `lib/services/sales/data.ts`
  - Deps: T02 · Verify: insertSale/insertSaleItems/decrementProductStock/selectSalesOfDay; numeric→number coerido

- [x] T06 Zod schemas de venda
  - Service: backend · Files: `lib/validation/sale.ts`, `lib/validation/sale.test.ts`
  - Deps: T05 · Verify: `npx vitest run lib/validation/sale.test.ts` (T09, T10, T12)

- [x] T07 Tipos de venda
  - Service: backend · Files: `types/sale.ts`
  - Deps: - · Verify: `npx tsc --noEmit`; SaleDto/SaleItemDto/PaymentMethod

- [x] T08 Serviço de venda transacional
  - Service: backend · Files: `lib/services/sales/sale-service.ts`, `lib/services/sales/lookup.ts`, `*.test.ts`
  - Deps: T04, T05, T06, T07 · Verify: `npx vitest run lib/services/sales` (T04,T05,T06,T07,T08,T11,T13,T15,T16 + lookup T01,T02,T03)

- [x] T09 Server actions do caixa
  - Service: backend · Files: `app/(app)/caixa/actions.ts`
  - Deps: T08 · Verify: `npx tsc --noEmit`; tenantId/userId via requireAuthContext

- [x] T10 Teste de RLS de vendas
  - Service: test · Files: `db/__tests__/sales-rls.test.ts`
  - Deps: T03, T08 · Verify: `npx vitest run db/__tests__/sales-rls.test.ts` (T14)

- [x] T11 Hook do carrinho
  - Service: frontend · Files: `components/caixa/use-cart.ts`
  - Deps: T07 · Verify: add/updateQty/remove/clear + total derivado; sem persistência

- [x] T12 Entrada por código + busca por nome
  - Service: frontend · Files: `components/caixa/BarcodeInput.tsx`, `components/caixa/ProductSearch.tsx`, `components/caixa/BarcodeInput.test.tsx`
  - Deps: T09, T11 · Verify: `npx vitest run components/caixa/BarcodeInput.test.tsx` (T18)

- [x] T13 Carrinho + resumo
  - Service: frontend · Files: `components/caixa/Cart.tsx`, `components/caixa/CartSummary.tsx`, `components/caixa/Cart.test.tsx`
  - Deps: T11 · Verify: `npx vitest run components/caixa/Cart.test.tsx` (T17)

- [x] T14 Diálogo de pagamento
  - Service: frontend · Files: `components/caixa/PaymentDialog.tsx`, `components/caixa/PaymentDialog.test.tsx`
  - Deps: T09, T13 · Verify: `npx vitest run components/caixa/PaymentDialog.test.tsx` (T19)

- [x] T15 Página de caixa
  - Service: frontend · Files: `app/(app)/caixa/page.tsx`
  - Deps: T12, T13, T14 · Verify: `npm run build`; fluxo bipar→carrinho→finalizar

- [x] T16 Vendas do dia
  - Service: frontend · Files: `app/(app)/vendas/page.tsx`, `components/caixa/TodaySalesList.tsx`
  - Deps: T09 · Verify: `npm run build`; lista as vendas de hoje (RF09)

- [x] T17 Navegação (Caixa/Vendas no header)
  - Service: frontend · Files: `app/(app)/layout.tsx`
  - Deps: T15, T16 · Verify: `npm run build`; links Caixa e Vendas no menu

## Acceptance Checklist

- [x] `sales` tem `tenant_id`, `user_id`, `total_cents integer`, `payment_method` CHECK `in('dinheiro','pix','cartao')` (RF06, RN07)
- [x] `sale_items` tem `tenant_id` (p/ RLS), `product_id ON DELETE SET NULL`, `name_snapshot`, `unit_price_cents`, `quantity numeric(10,3)`, `subtotal_cents` (RN02)
- [x] CHECK `total_cents>=0`, `subtotal_cents>=0`, `unit_price_cents>=0`, `quantity>0` (RN04, RN06)
- [x] RLS policy `tenant_isolation` em `sales` e `sale_items` bloqueia acesso cross-tenant (RN01)
- [x] `finalizeSale` resolve preço/nome/unidade do produto no servidor (snapshot), ignorando preço do cliente (RN02)
- [x] `finalizeSale` insere venda + itens e baixa estoque na MESMA transação `withUserRls` (RF07)
- [x] `finalizeSale` calcula `subtotal = Math.round(unitPriceCents × quantity)` e `total = Σ subtotais` (RF03, RF05, RN06)
- [x] Venda não finaliza com `items` vazio (RN03) e rejeita `quantity ≤ 0` (RN04)
- [x] Estoque pode ficar negativo; a venda não é bloqueada por falta de estoque (RN05)
- [x] `sale.user_id` e `tenant_id` vêm da sessão (requireAuthContext), nunca do input (RN08, RN01)
- [x] `lookupProductByBarcode` e `searchProducts` filtram por tenant e usam índice (RF01, RF02, RNF01)
- [x] `listTodaySales` retorna apenas as vendas do dia atual do tenant (RF09)
- [x] `BarcodeInput` mantém foco e adiciona com Enter, refocando o campo (RF10)
- [x] `Cart` permite editar quantidade e remover item; total atualiza ao vivo (RF04, RF05)
- [x] `CartSummary` permite cancelar (limpa carrinho) sem gravar (RF08)
- [x] `PaymentDialog` escolhe a forma e dispara `finalizeSaleAction` (RF06)
- [x] Página `/caixa` cobre o fluxo e `/vendas` lista o dia; links no header (RF09)

## Quality Gates

- [x] `npm run typecheck` exit 0
- [x] `npm run lint` exit 0
- [x] `npm test` — todos verdes (Postgres local no ar)
- [x] `npm run build` exit 0
