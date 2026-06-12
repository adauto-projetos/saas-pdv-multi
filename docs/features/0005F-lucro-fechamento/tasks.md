---
id: 0005F
type: feature-tasks
slug: lucro-fechamento
status: draft
created: 2026-06-12
updated: 2026-06-12
related: [0005F]
---

# Tasks: Lucro e Fechamento de Caixa (0005F)

## Metadata

| Field | Value |
|-------|-------|
| Complexity | COMPLEX |
| Total tasks | 15 |
| Services | test, database, backend, frontend |

## Requirements Coverage

- [x] RF01 — Snapshot de custo por item na venda (retrofit finalizeSale)
- [x] RF02 — Tela de lucro do dia (faturamento/custo/lucro/margem%)
- [x] RF03 — Item sem custo sinalizado, nunca omitido
- [x] RF04 — Abrir caixa com saldo inicial
- [x] RF05 — Movimentações de caixa vinculadas à sessão
- [x] RF06 — Fechar caixa: esperado/contado/divergência
- [x] RF07 — Histórico de sessões (turnos)
- [x] RF08 — Indica turno aberto na tela de caixa
- [x] RN01 — Isolamento por tenant (RLS) em sessões e snapshot
- [x] RN02 — Centavos inteiros; lucro pode ser negativo
- [x] RN03 — Custo snapshot imutável
- [x] RN04 — Sem custo → snapshot null, conta 0 + marcado
- [x] RN05 — Lucro = revenue−cost; não desconta sangria/conta
- [x] RN06 — Esperado = opening + Σ dinheiro do turno
- [x] RN07 — Divergência = contado − esperado (sobra/falta)
- [x] RN08 — Sessão imutável após fechada
- [x] RN09 — Uma sessão aberta por tenant; abrir 2ª rejeita
- [x] RN10 — Atribuição ao usuário/tenant do contexto
- [x] RNF01 — Lucro/esperado por agregação direta (sem cache)
- [x] RNF02 — Snapshot gravado na mesma transação da venda

## TDD

- [x] T-TEST-01 Contract tests for sale-service retrofit (cost snapshot + session link) — `lib/services/sales/sale-service.test.ts`
- [x] T-TEST-02 Contract tests for profit-service (lucro/margem/itens sem custo) — `lib/services/profit/profit-service.test.ts`
- [x] T-TEST-03 Contract tests for cash-session-service (abrir/fechar/divergência/histórico) — `lib/services/profit/cash-session-service.test.ts`
- [x] T-TEST-04 Contract tests for RLS isolation (cash_sessions + profit) — `db/__tests__/lucro-rls.test.ts`
- [x] T-TEST-05 Contract tests for profit validation schemas (zod) — `lib/validation/profit.test.ts`

## Execution

- [x] T01 Write profit validation schemas test
  - Service: test
  - Files: `lib/validation/profit.test.ts`
  - Deps: -
  - Verify: `npm test -- profit.test` (red until T07)

- [x] T02 Write profit + cash-session service tests
  - Service: test
  - Files: `lib/services/profit/profit-service.test.ts`, `lib/services/profit/cash-session-service.test.ts`
  - Deps: -
  - Verify: `npm test -- profit/` (red until services exist)

- [x] T03 Write sale-service retrofit + RLS tests
  - Service: test
  - Files: `lib/services/sales/sale-service.test.ts`, `db/__tests__/lucro-rls.test.ts`
  - Deps: -
  - Verify: `npm test -- sale-service lucro-rls` (red until retrofit + table)

- [x] T04 Create cash_sessions schema
  - Service: database
  - Files: `db/schema/cash-sessions.ts`, `db/schema/index.ts`
  - Deps: -
  - Verify: `npm run typecheck`

- [x] T05 Retrofit sale-items + cash-movements columns
  - Service: database
  - Files: `db/schema/sale-items.ts`, `db/schema/cash-movements.ts`
  - Deps: T04
  - Verify: `npm run db:setup` applies cost_cents_snapshot + session_id

- [x] T06 Add RLS migration for cash_sessions
  - Service: database
  - Files: `db/migrations/0005_lucro_rls.sql`
  - Deps: T04
  - Verify: `npm run db:rls` then `npm test -- lucro-rls`

- [x] T07 Add seed helpers (cash session + product cost)
  - Service: database
  - Files: `db/__tests__/seed.ts`
  - Deps: T04, T05
  - Verify: `npm test -- profit/ lucro-rls` seeds resolve

- [x] T08 Profit validation schemas (zod)
  - Service: backend
  - Files: `lib/validation/profit.ts`
  - Deps: -
  - Verify: `npm test -- profit.test`

- [x] T09 Profit DTOs and types
  - Service: backend
  - Files: `types/profit.ts`
  - Deps: -
  - Verify: `npm run typecheck`

- [x] T10 Cash-session data + service layer
  - Service: backend
  - Files: `lib/services/profit/cash-session-data.ts`, `lib/services/profit/cash-session-service.ts`
  - Deps: T05, T07, T09
  - Verify: `npm test -- cash-session-service`

- [x] T11 Profit data + service layer
  - Service: backend
  - Files: `lib/services/profit/profit-data.ts`, `lib/services/profit/profit-service.ts`
  - Deps: T05, T07, T09
  - Verify: `npm test -- profit-service`

- [x] T12 Retrofit finalizeSale (cost snapshot + session link)
  - Service: backend
  - Files: `lib/services/sales/sale-service.ts`, `lib/services/sales/data.ts`
  - Deps: T05, T10
  - Verify: `npm test -- sale-service`

- [x] T13 Retrofit registerCashMovement session link
  - Service: backend
  - Files: `lib/services/finance/cash-service.ts`, `lib/services/finance/cash-data.ts`
  - Deps: T05, T10
  - Verify: `npm test -- cash-service`

- [x] T14 Lucro actions + page + components
  - Service: frontend
  - Files: `app/(app)/lucro/actions.ts`, `app/(app)/lucro/page.tsx`, `components/lucro/`
  - Deps: T08, T09, T11
  - Verify: `npm run build`; open `/lucro` shows faturamento/custo/lucro/margem

- [x] T15 Cash session panel + caixa retrofit + nav
  - Service: frontend
  - Files: `components/financeiro/CashSessionPanel.tsx`, `app/(app)/financeiro/caixa/page.tsx`, `app/(app)/layout.tsx`
  - Deps: T10, T14
  - Verify: `npm run build`; `/financeiro/caixa` mostra abrir/fechar; nav tem Lucro

## Acceptance Checklist

- [x] `finalizeSale` grava `cost_cents_snapshot` por item na mesma transação da venda (RF01, RNF02)
- [x] Produto sem custo → `cost_cents_snapshot` gravado como null (RN04)
- [x] Editar `products.cost_cents` após a venda não altera o lucro passado (RN03)
- [x] `getProfitByPeriod` retorna ProfitDto com revenueCents/costCents/profitCents/marginPercent/itemsWithoutCost/salesCount (RF02, RNF01)
- [x] Período padrão de `getProfitByPeriod` é hoje quando sem filtro (RF02)
- [x] `itemsWithoutCost` > 0 sinaliza itens sem custo; venda nunca omitida do faturamento (RF03, RN04)
- [x] `profitCents` pode ser negativo (prejuízo); revenue/cost são inteiros (RN02)
- [x] Lucro não desconta sangria nem conta a pagar (RN05)
- [x] `marginPercent` é 0 quando faturamento é 0 (sem divisão por zero) (RNF01)
- [x] `openCashSession` cria sessão 'aberta' com saldo inicial, `opened_by` do contexto (RF04, RN10)
- [x] Abrir 2ª sessão com uma aberta rejeita com ConflictError; índice parcial garante no banco (RN09)
- [x] Movimentações de caixa do turno recebem `session_id` da sessão aberta via `selectOpenSessionId` (RF05)
- [x] `closeCashSession` calcula esperado = opening + Σ dinheiro do turno (RF06, RN06)
- [x] Esperado considera só dinheiro; pix/cartão/fiado não entram (RN06)
- [x] `divergenceCents` = contado − esperado; positivo sobra, negativo falta; não bloqueia (RF06, RN07)
- [x] Sessão fechada é imutável; fechar de novo rejeita; sem reabertura (RN08)
- [x] `listSessions` retorna histórico com abertura/fechamento/esperado/contado/divergência/operador (RF07)
- [x] `getOpenSession` retorna a sessão aberta (ou null) para a tela de caixa (RF08)
- [x] CashSessionPanel mostra abrir/fechar e turno aberto na tela `/financeiro/caixa` (RF08)
- [x] `cash_sessions` isolada por tenant via RLS; lucro agrega só vendas do próprio tenant (RN01)
- [x] `openSessionSchema`/`closeSessionSchema` exigem inteiro ≥ 0; `profitFilterSchema` from/to opcionais (RN02, RF02)

## Validation Gates

- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
