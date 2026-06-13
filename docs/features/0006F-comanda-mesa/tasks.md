---
id: 0006F
type: feature-tasks
slug: comanda-mesa
status: done
created: 2026-06-12
updated: 2026-06-13
related: [0006F]
---

# Tasks: Comanda/Mesa (0006F)

## Metadata

| Field | Value |
|-------|-------|
| Complexity | COMPLEX |
| Total tasks | 16 |
| Services | test, database, backend, frontend |

## Requirements Coverage

- [x] RF01 — Abrir comanda com rótulo livre (várias abertas por tenant)
- [x] RF02 — Lançar item (baixa estoque no lançamento)
- [x] RF03 — Remover item (estorna estoque)
- [x] RF04 — Cancelar comanda (estorna todos, sem venda)
- [x] RF05 — Total parcial ao vivo (informativo, preço corrente)
- [x] RF06 — Fechar → vira venda (snapshot, dialog confirm)
- [x] RF07 — dinheiro→caixa, fiado→a receber, custo→lucro, sem re-baixa
- [x] RF08 — Tela de comandas (abertas + histórico)
- [x] RN01 — Isolamento por tenant (RLS) em comandas e itens
- [x] RN02 — Centavos inteiros; quantidade > 0; total ≥ 0
- [x] RN03 — Estoque baixa ao lançar; estorna remove/cancel; pode negativo
- [x] RN04 — Várias comandas abertas por tenant (sem unique parcial)
- [x] RN05 — Snapshot preço/custo no fechamento; aberta sem preço
- [x] RN06 — Fechada/cancelada imutável; não reabre
- [x] RN07 — Fechar exige ≥1 item; fiado exige cliente
- [x] RN08 — Fechamento não baixa estoque (evita baixa dupla)
- [x] RN09 — Não exige turno; dinheiro vincula sessão se houver
- [x] RN10 — Atribuição ao usuário/tenant do contexto
- [x] RN11 — Observação por item texto livre opcional
- [x] RNF01 — Lista abertas + total parcial rápido (índice + JOIN)
- [x] RNF02 — Fechamento atômico; estorno atômico

## TDD

- [x] T-TEST-01 Contract tests for comanda-service (lifecycle/itens/estoque/close) — `lib/services/comanda/comanda-service.test.ts`
- [x] T-TEST-02 Contract tests for RLS isolation (comandas + comanda_items) — `db/__tests__/comanda-rls.test.ts`
- [x] T-TEST-03 Contract tests for comanda validation schemas (zod) — `lib/validation/comanda.test.ts`

## Execution

- [x] T01 Write comanda validation schemas test
  - Service: test
  - Files: `lib/validation/comanda.test.ts`
  - Deps: -
  - Verify: `npm test -- comanda.test` (red until T10)

- [x] T02 Write comanda service tests (lifecycle/itens/estoque/close)
  - Service: test
  - Files: `lib/services/comanda/comanda-service.test.ts`
  - Deps: -
  - Verify: `npm test -- comanda-service` (red until service exists)

- [x] T03 Write comanda RLS isolation tests
  - Service: test
  - Files: `db/__tests__/comanda-rls.test.ts`
  - Deps: -
  - Verify: `npm test -- comanda-rls` (red until tables + migration)

- [x] T04 Create comandas + comanda_items schema
  - Service: database
  - Files: `db/schema/comandas.ts`, `db/schema/comanda-items.ts`, `db/schema/index.ts`
  - Deps: -
  - Verify: `npm run typecheck`

- [x] T05 Retrofit stock_movements.comanda_id + sales.comanda_id
  - Service: database
  - Files: `db/schema/stock-movements.ts`, `db/schema/sales.ts`
  - Deps: T04
  - Verify: `npm run db:setup` applies comanda_id columns

- [x] T06 Add RLS migration for comandas + comanda_items
  - Service: database
  - Files: `db/migrations/0006_comanda_rls.sql`
  - Deps: T04
  - Verify: `npm run db:rls` then `npm test -- comanda-rls`

- [x] T07 Add seed helpers (comanda + item + price/stock)
  - Service: database
  - Files: `db/__tests__/seed.ts`
  - Deps: T04, T05
  - Verify: `npm test -- comanda-service comanda-rls` seeds resolve

- [x] T08 Comanda DTOs and types
  - Service: backend
  - Files: `types/comanda.ts`
  - Deps: -
  - Verify: `npm run typecheck`

- [x] T09 Comanda validation schemas (zod)
  - Service: backend
  - Files: `lib/validation/comanda.ts`
  - Deps: -
  - Verify: `npm test -- comanda.test`

- [x] T10 Comanda data layer (lifecycle/itens/JOIN products)
  - Service: backend
  - Files: `lib/services/comanda/comanda-data.ts`
  - Deps: T05, T07, T08
  - Verify: `npm run typecheck`

- [x] T11 Add recordComandaExit/Estorno to stock data
  - Service: backend
  - Files: `lib/services/stock/data.ts`
  - Deps: T05
  - Verify: `npm test -- comanda-service` stock movements carry comanda_id

- [x] T12 Retrofit insertSale with comandaId (back-link)
  - Service: backend
  - Files: `lib/services/sales/data.ts`
  - Deps: T05
  - Verify: `npm run typecheck`

- [x] T13 Comanda service: open/add/remove/cancel + reads
  - Service: backend
  - Files: `lib/services/comanda/comanda-service.ts`
  - Deps: T08, T09, T10, T11
  - Verify: `npm test -- comanda-service`

- [x] T14 Comanda service: closeComanda pipeline (mirror finalizeSale, no restock)
  - Service: backend
  - Files: `lib/services/comanda/comanda-service.ts`
  - Deps: T12, T13
  - Verify: `npm test -- comanda-service` close creates sale + caixa/fiado

- [x] T15 Comanda server actions
  - Service: backend
  - Files: `app/(app)/comandas/actions.ts`
  - Deps: T13, T14
  - Verify: `npm run typecheck`

- [x] T16 Comandas page + components + nav
  - Service: frontend
  - Files: `app/(app)/comandas/page.tsx`, `components/comandas/`, `app/(app)/layout.tsx`
  - Deps: T15
  - Verify: `npm run build`; `/comandas` abre/lança/fecha; nav tem Comandas

## Acceptance Checklist

- [x] `openComanda` cria comanda 'aberta' com rótulo livre, `opened_by` do contexto (RF01, RN10)
- [x] Várias comandas abertas simultâneas por tenant sem ConflictError (sem unique parcial) (RN04)
- [x] `addComandaItem` insere item (produto+qtd+observação) e baixa estoque na mesma tx (RF02, RN03, RNF02)
- [x] Movimento de baixa do lançamento carimba `comanda_id`, não `sale_id` (RN03)
- [x] `comanda_items` não grava preço congelado; total parcial usa preço corrente (RN05)
- [x] Estoque pode ficar negativo no lançamento; não bloqueia (RN03)
- [x] `removeComandaItem` remove item e estorna estoque (+qty inverso) atomicamente (RF03, RN03, RNF02)
- [x] `cancelComanda` estorna estoque de todos os itens e marca 'cancelada' sem criar venda (RF04, RN06)
- [x] `getComanda`/`listOpenComandas` calculam `partialTotalCents` = Σ preço atual × qtd via JOIN products (RF05, RN02, RNF01)
- [x] Total parcial reflete mudança de preço do produto e é 0 sem itens (RF05, RN05)
- [x] `closeComanda` cria `sales`+`sale_items` com snapshot de preço lido no close e marca 'fechada' (RF06, RN05)
- [x] `sale_items` recebe `cost_cents_snapshot` lido no close; null quando produto sem custo (RF07, RN05)
- [x] Fechamento NÃO chama `recordSaleExit`; estoque permanece o do lançamento (RF07, RN08)
- [x] Fechar em dinheiro gera entrada de caixa; vincula `session_id` se houver turno aberto, senão null (RF07, RN09)
- [x] Fechar em fiado cria conta a receber e não toca caixa; pix/cartão não tocam caixa (RF07, RN07, RN09)
- [x] Fechar comanda vazia ou fiado sem cliente é rejeitado com erro, sem gravar venda (RN07)
- [x] Comanda fechada/cancelada rejeita add/remove/cancel/reclose (WHERE status='aberta') (RN06)
- [x] `observation` por item persiste, aceita null e não afeta cálculo (RF02, RN11)
- [x] `sales.comanda_id` back-link gravado no fechamento (RF06)
- [x] `listComandaHistory` lista fechadas/canceladas com filtro de período; abertas excluídas (RF08)
- [x] `comandas`/`comanda_items` isoladas por tenant via RLS (cross-tenant retorna 0) (RN01)
- [x] Schemas zod: label não-vazio, quantity finito>0, observation opcional, fiado⇒cliente, payment enum (RF01, RN02, RN07, RN11)
- [x] Tela `/comandas` lista abertas com total parcial, lançar/remover/fechar/cancelar e histórico; nav tem Comandas (RF08, RNF01)

## Quality Gates

- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
