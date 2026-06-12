---
id: 0005F
type: feature-plan
slug: lucro-fechamento
status: draft
created: 2026-06-12
updated: 2026-06-12
related: [0005F, 0001F, 0002F, 0004F]
---

## TL;DR

Plano técnico do lucro + fechamento ({{doc:0005F}}): **lucro do dia derivado on-the-fly** (faturamento − custo) a partir de um **snapshot de custo por item** (retrofit em `sale_items` + `finalizeSale`), e **fechamento de caixa por turno** via uma única tabela nova `cash_sessions` (abrir/operar/fechar com esperado vs contado vs divergência). O caixa de {{doc:0004F}} ganha `session_id` nas movimentações. Decisões-chave: **sem tabela `profit_ledger`** (lucro é agregação, RNF01) e **esperado da gaveta = só dinheiro** (herdado de {{doc:0004F}} RN08). Dinheiro em centavos (lucro pode ser negativo), multi-tenant RLS, sessão imutável após fechada.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Test Specification](#test-specification)
- [Database](#database)
- [Backend](#backend)
- [Frontend](#frontend)
- [Consolidation Notes](#consolidation-notes)
- [Risks](#risks)
- [Validation](#validation)
- [Requirements Coverage](#requirements-coverage)
- [Quick Reference](#quick-reference)

## Context

A venda ({{doc:0002F}}) mostra faturamento e o financeiro ({{doc:0004F}}) mostra saldo — falta o **lucro real** e a **conferência da gaveta**. Este plano fecha a Fase 2: grava o custo de cada item na venda (snapshot, espelhando o snapshot de preço que já existe), calcula o lucro do dia por agregação direta (sem tabela de cache), e adiciona o conceito de **turno** que a 0004F adiou de propósito. Reaproveita RLS, ledger assinado, dinheiro-em-centavos, `withUserRls` e o ponto de retrofit do `finalizeSale`.

## Architecture Decisions

| decision | rationale | alternatives rejected | triggering constraint |
|---|---|---|---|
| **Lucro derivado on-the-fly** (sem `profit_ledger`) | `SUM(subtotal − custo×qtd)` sobre `sale_items` por período; nunca dessincroniza | Tabela `profit_ledger` (sugerida na discovery) — coluna de cache que pode divergir, mais retrofit | RNF01 ("sem coluna de cache") |
| **Custo via snapshot** em `sale_items.cost_cents_snapshot` | Lucro histórico imutável; espelha o snapshot de preço (`unit_price_cents`) | Lookup do `products.cost_cents` atual — editar o custo distorceria lucro passado | RN03 (imutabilidade) |
| **Produto sem custo → snapshot `null`** | `null` é o próprio flag (RN04): conta como 0 no cálculo + `itemsWithoutCost>0` marca na UI | Coluna booleana extra "sem custo" — redundante | RN04 |
| **`cash_sessions` (tabela nova) p/ turno** | Fechamento exige "esperado vs contado vs divergência" por turno, auditável | `session_id` solto sem tabela — conferência/divergência ficam frágeis | RF04–RF07, RN09 |
| **Esperado = opening + Σ dinheiro do turno** | `cash_movements` só existem p/ dinheiro (0004F RN08), então o SUM já é dinheiro-only | Recalcular por tipo de pagamento — redundante e propenso a erro | RN06 |
| **Uma sessão aberta por tenant** via partial unique index | Banco é a última linha (race), serviço pré-checa → ConflictError | Só checagem na aplicação — corrida abriria 2 turnos | RN09 |

## Main Flow

Fechamento (caminho crítico):
1. Operador → `/financeiro/caixa` → "Abrir caixa" → informa saldo inicial → `openCashSessionAction` → `openCashSession` (RN09: rejeita se já há aberta).
2. Durante o turno: vendas em dinheiro e sangrias/suprimentos ({{doc:0004F}}) gravam `cash_movements` com `session_id` da sessão aberta (`selectOpenSessionId`).
3. Operador → "Fechar caixa" → informa a contagem da gaveta → `closeCashSessionAction` → `closeCashSession` numa `withUserRls` tx: esperado = opening + Σ(movimentos do turno); divergência = contado − esperado; update único → `'fechada'` (RN08).
4. UI mostra esperado vs contado vs **divergência** (sobra/falta destacada).

Lucro: `finalizeSale` grava `cost_cents_snapshot` por item na mesma tx → tela `/lucro` chama `getProfitByPeriod` (agregação) → mostra faturamento, custo, lucro (verde/vermelho), margem % e aviso de itens sem custo.

## Implementation Order

Database (cash_sessions + retrofit colunas + RLS) → Backend (profit + cash-session services, retrofit finalizeSale/cash-service, actions) → Frontend (/lucro + painel de sessão na tela de caixa). Tests por área seguem o TDD spec. ⚠️ As colunas/tabela devem existir (`npm run db:setup`) ANTES do retrofit do `finalizeSale`, senão as vendas existentes quebram.

---

## Test Specification

> Style: Vitest; `const suite = HAS_DB ? describe : describe.skip` for DB-touching suites (run against Docker Postgres); pure zod suites always run. Money = integer cents; profit may be < 0. ctx = `{ userId, tenantId }`. Seed via `db/__tests__/seed.ts` helpers.
>
> Prereq seed additions (assumed by these contracts, to be added in `db/__tests__/seed.ts`): `seedProduct` accepts `costCents?: number | null`; new helpers `seedCashSession(tenantId, userId, { openingBalanceCents, status? })` and a way to set `cost_cents_snapshot` on seeded sale items (or rely on `finalizeSale` to write it).

### Contract Tests (from RFs/RNs)

| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|---|---|---|---|---|---|---|
| sale-RF01-cost-snapshot | finalizeSale grava `cost_cents_snapshot` por item | sales (retrofit) | RF01 | venda de produto com `costCents=400`, qty 2, dinheiro | sale_items.cost_cents_snapshot = 400 | cada item tem `costCentsSnapshot === 400` |
| sale-RNF02-same-tx | snapshot gravado na MESMA tx da venda | sales (retrofit) | RNF02 | venda válida c/ custo, dinheiro | venda + sale_items (com snapshot) persistidos juntos | venda existe E todo item tem snapshot não-undefined |
| sale-RN04-null-cost-snapshot | produto sem custo → snapshot null | sales (retrofit) | RN04 | venda de produto `costCents=null`, qty 1 | cost_cents_snapshot = null | item: `costCentsSnapshot === null` |
| sale-RF05-session-link | entrada dinheiro recebe `session_id` da sessão aberta | sales (retrofit) | RF05 | abrir sessão → venda dinheiro | cashMovement 'venda' com `sessionId === sessão` | `sessionId === openSession.id` |
| sale-RF05-no-session | venda dinheiro sem turno → `session_id` null | sales (retrofit) | RF05 | (sem sessão) venda dinheiro | cashMovement `sessionId === null` | venda conclui; sessionId null |
| profit-RF02-summary | lucro do período: faturamento/custo/lucro/margem% | profit-service | RF02 | venda 1000×2=2000, custo 400/un=800 | `{revenueCents:2000,costCents:800,profitCents:1200,marginPercent:60}` | campos batem; margin=round(1200/2000*100) |
| profit-RF02-default-today | sem filtro, período = hoje | profit-service | RF02 | venda hoje | agrega só hoje | revenue inclui venda de hoje |
| profit-RF03-items-without-cost | item sem custo sinalizado, nunca omitido | profit-service | RF03 | venda de produto sem custo (1000) | `{itemsWithoutCost:≥1, revenue inclui 1000}` | itemsWithoutCost>0; venda no faturamento |
| profit-RN02-negative | lucro pode ser negativo (prejuízo) | profit-service | RN02 | venda 500, custo 800 | `profitCents === -300` | profitCents<0 (não trava/zera) |
| profit-RN02-cents | valores inteiros em centavos | profit-service | RN02 | venda kg 0.75@590, custo 200/un | revenue/cost inteiros | `Number.isInteger` ambos |
| profit-RN03-snapshot-immutable | editar custo do produto NÃO muda lucro passado | profit-service | RN03 | venda custo 400 → UPDATE products.cost=900 → reconsultar | costCents permanece 800 | lucro inalterado após edição |
| profit-RN04-null-counts-zero | sem custo → conta 0 + itemsWithoutCost>0 | profit-service | RN04 | venda 1000, snapshot null | `{costCents contribui 0, itemsWithoutCost:≥1}` | item soma 0 ao custo; presente |
| profit-RN05-not-sangria | lucro NÃO desconta sangria | profit-service | RN05 | venda(2000/800) + sangria 1000 | `profitCents === 1200` | sangria ignorada |
| profit-RN05-not-payable | lucro NÃO desconta conta a pagar | profit-service | RN05 | venda(1200) + payable 5000 | `profitCents === 1200` | payable não afeta |
| session-RF04-open | abrir cria sessão 'aberta' c/ saldo inicial | cash-session-service | RF04 | `openCashSession({openingBalanceCents:5000})` | `{status:'aberta',openingBalanceCents:5000,openedBy:ctx.userId}` | sessão persistida 'aberta' |
| session-RN10-attribution | sessão usa user/tenant do ctx | cash-session-service | RN10 | `openCashSession({...:1000})` | openedBy=ctx.userId, tenantId=ctx.tenantId | row reflete ctx, não input |
| session-RN09-single-open | abrir 2ª com uma aberta rejeita | cash-session-service | RN09 | abrir; abrir de novo | 2ª `rejects` ConflictError | só 1 'aberta' |
| session-RN09-close-requires-open | fechar exige sessão aberta | cash-session-service | RN09 | (sem aberta) close | `rejects` ValidationError | nada gravado |
| session-RN09-reopen-after-close | após fechar pode abrir nova | cash-session-service | RN09 | abrir→fechar→abrir | 2ª abertura sucede | nova sessão id distinto |
| session-RF06-expected | esperado=opening+Σ dinheiro; divergência | cash-session-service | RF06 | opening 5000 → venda dinheiro 2000 → fechar contando 7000 | `{expectedCents:7000,countedCents:7000,divergenceCents:0,status:'fechada'}` | expected=5000+2000; div=0 |
| session-RN06-money-only | esperado só dinheiro; pix/cartão/fiado fora | cash-session-service | RN06 | opening 5000 → dinheiro 2000 + pix 3000 + fiado 1000 → fechar | `expectedCents === 7000` | só os 2000 em dinheiro |
| session-RN06-supply-and-sangria | suprimento(+) e sangria(−) entram no esperado | cash-session-service | RN06 | opening 5000 → suprimento 1000 → sangria 400 → fechar | `expectedCents === 5600` | esperado reflete sinais |
| session-RN07-divergence-sobra | divergência positiva = sobra | cash-session-service | RN07 | opening 5000 → fechar contando 5100 | `divergenceCents:100` | div>0 (sobra); não bloqueia |
| session-RN07-divergence-falta | divergência negativa = falta | cash-session-service | RN07 | opening 5000 → fechar contando 4900 | `divergenceCents === -100` | div<0 (falta); fecha igual |
| session-RN08-immutable | sessão imutável após fechada | cash-session-service | RN08 | abrir→fechar→fechar de novo | 2ª close rejeitada; campos estáveis | re-leitura idêntica; sem reopen |
| session-RF07-history | histórico lista sessões por período | cash-session-service | RF07 | abrir+fechar 2 → `listSessions({})` | ≥2 CashSessionDto | cada item tem abertura/fechamento/esperado/contado/divergência/operador |
| session-RF08-open-getter | turno aberto exposto p/ tela de caixa | cash-session-service | RF08 | abrir → `getOpenSession` | CashSessionDto aberta (não null) | retorna aberta; após fechar → null |
| profit-RNF01-shape | lucro = agregação direta (DTO completo) | profit-service | RNF01 | qualquer venda do dia | DTO c/ revenue/cost/profit/margin/itemsWithoutCost/salesCount | profit=revenue−cost; margin coerente |
| profit-RNF01-zero-revenue | margem%=0 quando faturamento 0 | profit-service | RNF01 | período sem vendas | `{revenueCents:0,profitCents:0,marginPercent:0,salesCount:0}` | sem divisão por zero |
| rls-RN01-session-isolation | cash_sessions isolada entre tenants | profit-rls | RN01 | sessão em tenant B → `withUserRls(userA)` select | A não vê sessão de B | length 0 |
| rls-RN01-profit-isolation | lucro só agrega vendas do próprio tenant | profit-rls | RN01 | vendas em B → `getProfitByPeriod(ctxA,{})` | A não inclui revenue/custo de B | revenue de A exclui B |
| val-RN02-opening-non-negative | openSessionSchema: saldo ≥0 inteiro | profit-validation | RN02/RF04 | -1 / 0 / 1000 | false / true / true | safeParse conforme |
| val-RN02-counted-non-negative | closeSessionSchema: contagem ≥0 inteiro | profit-validation | RN02/RF06 | -1 / 0 / 5000 | false / true / true | safeParse conforme |
| val-profit-filter-optional | profitFilterSchema: from/to opcionais | profit-validation | RF02 | `{}` / `{from,to}` | ambos true | safeParse true |

### Test File Mapping

| Area | Test File | Test IDs |
|---|---|---|
| sales (retrofit) | `lib/services/sales/sale-service.test.ts` (extend) | sale-RF01-cost-snapshot, sale-RNF02-same-tx, sale-RN04-null-cost-snapshot, sale-RF05-session-link, sale-RF05-no-session |
| profit-service | `lib/services/profit/profit-service.test.ts` (new) | profit-RF02-summary, profit-RF02-default-today, profit-RF03-items-without-cost, profit-RN02-negative, profit-RN02-cents, profit-RN03-snapshot-immutable, profit-RN04-null-counts-zero, profit-RN05-not-sangria, profit-RN05-not-payable, profit-RNF01-shape, profit-RNF01-zero-revenue |
| cash-session-service | `lib/services/profit/cash-session-service.test.ts` (new) | session-RF04-open, session-RN10-attribution, session-RN09-single-open, session-RN09-close-requires-open, session-RN09-reopen-after-close, session-RF06-expected, session-RN06-money-only, session-RN06-supply-and-sangria, session-RN07-divergence-sobra, session-RN07-divergence-falta, session-RN08-immutable, session-RF07-history, session-RF08-open-getter |
| profit-rls | `db/__tests__/lucro-rls.test.ts` (new) | rls-RN01-session-isolation, rls-RN01-profit-isolation |
| profit-validation | `lib/validation/profit.test.ts` (new) | val-RN02-opening-non-negative, val-RN02-counted-non-negative, val-profit-filter-optional |

---

## Database

> Lucro é DERIVADO on-the-fly — nenhuma tabela `profit_ledger` é criada. Lucro do dia = agregação direta sobre `sale_items` × `sales` por período (RNF01). A única tabela nova é `cash_sessions`.

### Entities

| Entity | Table | Key Fields | Reference |
|---|---|---|---|
| Sessão de caixa | `cash_sessions` | `id` uuid pk; `tenant_id` uuid NOT NULL FK tenants cascade; `opening_balance_cents` integer NOT NULL CHECK ≥ 0; `opened_at` timestamptz NOT NULL defaultNow; `opened_by` uuid NOT NULL FK users restrict; `closed_at` timestamptz nullable; `closed_by` uuid nullable FK users restrict; `counted_cents` integer nullable CHECK ≥ 0; `expected_cents` integer nullable; `divergence_cents` integer nullable (±); `status` text NOT NULL default 'aberta' CHECK in ('aberta','fechada') | `db/schema/cash-sessions.ts` (novo) |
| Retrofit: item de venda | `sale_items` | adiciona `cost_cents_snapshot` integer nullable — custo unitário congelado na venda; null = produto sem custo (RN04) | `db/schema/sale-items.ts` |
| Retrofit: movimentação de caixa | `cash_movements` | adiciona `session_id` uuid nullable FK → `cash_sessions` onDelete set null — vincula ao turno aberto (RF05) | `db/schema/cash-movements.ts` |

**Constraints em `cash_sessions`:**
- Partial UNIQUE INDEX `(tenant_id) WHERE status = 'aberta'` — máximo uma sessão aberta por tenant (RN09).
- Index `(tenant_id, opened_at)` para histórico (RNF01).
- Imutabilidade: o único UPDATE permitido é a transição `aberta → fechada` (preenche closed_*, counted, expected, divergence, status). Após fechada, não reabre (RN08).

### Migration

- `db/migrations/0005_lucro_rls.sql` — GRANT + ENABLE RLS + policy `tenant_isolation` para `cash_sessions`, padrão de `db/migrations/0004_financeiro_rls.sql`. `sale_items`/`cash_movements` já têm RLS — só ganham colunas.
- `db:push` cria/altera colunas; `db:rls` aplica o `.sql`. Sempre `npm run db:setup` (push + rls).

### Repository

Localização: `lib/services/profit/cash-session-data.ts` (lifecycle) e `lib/services/profit/profit-data.ts` (agregações). Padrão: Executor/DTOs/mapeadores de `lib/services/finance/cash-data.ts`.

| Method | Purpose |
|---|---|
| `insertCashSession(tx, tenantId, data)` | Cria sessão 'aberta' com `opening_balance_cents`; rejeita se já há aberta (RN09) |
| `selectOpenSession(tx, tenantId)` | Sessão 'aberta' do tenant ou null (RF08) |
| `selectOpenSessionId(tx, tenantId)` | id da sessão 'aberta' ou null — reusado por finalizeSale e registerCashMovement (RF05) |
| `closeCashSession(tx, tenantId, sessionId, data)` | Único UPDATE: closed_*, counted, expected, divergence, status='fechada'; valida tenant + 'aberta' |
| `selectSessionWithExpected(tx, tenantId, sessionId)` | Sessão + esperado on-the-fly: `opening + SUM(cash_movements.amount_cents WHERE session_id)` — espelha `selectCashBalance` |
| `selectSessions(tx, tenantId, period)` | Histórico por intervalo de `opened_at` (RF07) |
| `selectProfitByPeriod(tx, tenantId, from, to)` | Agrega `sale_items` JOIN `sales`: revenue=SUM(subtotal_cents), cost=SUM(COALESCE(cost_cents_snapshot,0)×quantity), items_without_cost=COUNT FILTER (cost_cents_snapshot IS NULL) (RF02/RN04/RN05) |

---

## Backend

> Stack: Next.js 16 Server Actions → `lib/services/profit/*` → Drizzle via `withUserRls`. Money = integer cents; **lucro pode ser <0** (RN02). tenant_id/userId sempre do ctx (RN10).

### Server Actions (app/(app)/lucro/actions.ts)
safeParse → requireAuthContext → service → revalidatePath → ActionResult; erros via `toActionError`.

| Action | Input (zod) | Returns | RF | Purpose |
|---|---|---|---|---|
| `getProfitAction` | `profitFilterSchema` | `ProfitDto` | RF02/RF03 | Lucro do período (padrão hoje); itemsWithoutCost flag |
| `openCashSessionAction` | `openSessionSchema` | `CashSessionDto` | RF04 | Abre turno; ConflictError se já aberta (RN09); revalida /lucro + /financeiro/caixa |
| `closeCashSessionAction` | `closeSessionSchema` | `CashSessionDto` | RF06/RF07 | Fecha turno (esperado/contado/divergência) |
| `getOpenSessionAction` | — | `CashSessionDto \| null` | RF08 | Turno aberto (p/ tela de caixa) |
| `listSessionsAction` | `profitFilterSchema` | `CashSessionDto[]` | RF07 | Histórico de sessões |

### Service Functions (lib/services/profit/)
`profit-service.ts`, `cash-session-service.ts` chamam `profit-data.ts`/`cash-session-data.ts` (Executor = `Pick<Database,"insert"|"select"|"update">`).

| Function | Tx? | Purpose / atomic steps |
|---|---|---|
| `getProfitByPeriod(ctx,{from?,to?})` | withUserRls (read) | Default = hoje (fuso servidor, como `listTodaySales`). ProfitDto: profit=revenue−cost (pode <0), marginPercent=revenue?round(profit/revenue*100):0, itemsWithoutCost, salesCount |
| `openCashSession(ctx,{openingBalanceCents})` | withUserRls tx | insertCashSession 'aberta', opened_by=ctx.userId. RN09: pré-check selectOpenSession→ConflictError; índice parcial = última linha (capturar `isUniqueViolation`) |
| `closeCashSession(ctx,{countedCents})` | withUserRls tx | selectOpenSession (null→ValidationError). expected=opening+Σ(movimentos do turno); divergence=counted−expected; closeCashSession (único UPDATE, RN08) |
| `getOpenSession(ctx)` | withUserRls (read) | selectOpenSession→CashSessionDto\|null (RF08) |
| `listSessions(ctx,{from?,to?})` | withUserRls (read) | selectSessions por `opened_at`, recentes primeiro (RF07) |
| `selectOpenSessionId(tx,tenantId)` *(helper exportado)* | — | id da sessão 'aberta' ou null; reusado por finalizeSale e registerCashMovement (RF05) |

### Validation Schemas (lib/validation/profit.ts)
| Schema | Fields | Key validations |
|---|---|---|
| `openSessionSchema` | `openingBalanceCents` | int, ≥0 |
| `closeSessionSchema` | `countedCents` | int, ≥0 |
| `profitFilterSchema` | `from?`, `to?` | strings opcionais (datas inválidas ignoradas no data layer, como `cashFilterSchema`) |

Exporta `OpenSessionInput`, `CloseSessionInput`, `ProfitFilterInput`.

### DTOs / Types (types/profit.ts)
| Type | Fields | Notes |
|---|---|---|
| `ProfitDto` | revenueCents, costCents, profitCents, marginPercent, itemsWithoutCost, salesCount | profitCents pode <0 (RN02); marginPercent=0 se revenue=0; itemsWithoutCost = itens snapshot null (RF03/RN04) |
| `CashSessionDto` | id, openingBalanceCents, openedAt, openedBy, closedAt, closedBy, countedCents, expectedCents, divergenceCents, status | closed*/counted/expected/divergence null enquanto 'aberta'; datas ISO; status 'aberta'\|'fechada' |
| `CashSessionStatus` | 'aberta' \| 'fechada' | union literal |

### Retrofits (sales + finance)
- **`lib/services/sales/data.ts`** — `SaleItemRow` ganha `costCentsSnapshot: number | null`; `insertSaleItems` persiste em `cost_cents_snapshot`; `toSaleItemDto` mapeia (opcional).
- **`lib/services/sales/sale-service.ts` `finalizeSale`** (RF01/RN03/RNF02) — capturar `costCentsSnapshot: product.costCents` (null se sem custo) por item, na MESMA tx.
- **`finalizeSale`** (RF05) — a entrada de caixa em dinheiro passa `sessionId: await selectOpenSessionId(tx, ctx.tenantId)`.
- **`lib/services/finance/cash-data.ts`** — insert de movimento ganha `sessionId?: string | null`.
- **`lib/services/finance/cash-service.ts` `registerCashMovement`** (RF05) — resolve `sessionId = selectOpenSessionId(tx, ctx.tenantId)` na tx (suprimento/sangria do turno entram no esperado — RN06).

### Module Structure
```
app/(app)/lucro/actions.ts
lib/services/profit/
  profit-service.ts    profit-data.ts
  cash-session-service.ts  cash-session-data.ts
  *.test.ts
lib/validation/profit.ts
types/profit.ts
~ lib/services/sales/{data.ts,sale-service.ts}   (retrofit: cost snapshot + session link)
~ lib/services/finance/{cash-data.ts,cash-service.ts}  (retrofit: session_id)
```

Reference: `lib/services/finance/cash-service.ts`, `lib/services/sales/sale-service.ts`, `app/(app)/financeiro/caixa/actions.ts`, `lib/services/errors.ts`, `db/schema/sale-items.ts`

---

## Frontend

> RSC pages (`force-dynamic`) await get/list actions; mutations call action → `router.refresh()`; filterable lists = client + `useEffect` → action (active-flag cleanup). NO TanStack/Zustand. Money: `MoneyInput` (cents), `centsToBRL`. Lucro/divergência podem ser <0 → `text-destructive`.

### Pages
| Route | Page Component | Purpose |
|---|---|---|
| `/lucro` | `app/(app)/lucro/page.tsx` (RSC, force-dynamic) | Await `getProfitAction()` (padrão hoje); ProfitSummaryCard + ProfitFilter (RF02/RF03) |
| `/financeiro/caixa` (retrofit) | `app/(app)/financeiro/caixa/page.tsx` | Await `getOpenSessionAction()`; CashSessionPanel + SessionHistory junto ao saldo (RF08) |

### Components
{"ProfitFilter":{"location":"components/lucro/","purpose":"client de/até (padrão hoje) → getProfitAction; re-render ProfitSummaryCard"}}
{"ProfitSummaryCard":{"location":"components/lucro/","purpose":"faturamento/custo/lucro(verde-vermelho)/margem%; aviso itemsWithoutCost (RF02/RF03)"}}
{"CashSessionPanel":{"location":"components/financeiro/","purpose":"sem sessão→Abrir; com sessão→abertura/saldo + Fechar (RF04/RF06/RF08)"}}
{"OpenSessionDialog":{"location":"components/financeiro/","purpose":"MoneyInput saldo inicial → openCashSessionAction → refresh (RF04)"}}
{"CloseSessionDialog":{"location":"components/financeiro/","purpose":"MoneyInput contagem → closeCashSessionAction → esperado/contado/divergência (RF06/RF08)"}}
{"SessionHistory":{"location":"components/financeiro/","purpose":"lista turnos filtrável por período (mirror MovementHistory) (RF07)"}}

### Data & Mutations (mirror RSC + Server Action pattern — NO TanStack/Zustand)
{"ProfitFilter":"client component (from/to default hoje); useEffect → getProfitAction({from,to}) active-flag cleanup, mirroring CashStatement.tsx; passa ProfitDto p/ ProfitSummaryCard (server render no 1º paint pela page.tsx)","SessionHistory":"client + useEffect → listSessionsAction({from, to:`${to}T23:59:59`}), loading/error/empty — mirror components/estoque/MovementHistory.tsx","OpenSessionDialog/CloseSessionDialog":"submit → await action; toast.error(res.error) on !ok (ConflictError 'já aberto'); ok → toast.success + reset + router.refresh() — mirror CashMovementDialog.tsx; close re-render esperado/contado/divergência do CashSessionDto retornado","page retrofit":"caixa/page.tsx await getOpenSessionAction() → CashSessionPanel (RSC), mirroring getCashBalanceAction()"}

### Types (mirror from backend DTOs)
{"ProfitDto":{"fields":"revenueCents,costCents,profitCents,marginPercent,itemsWithoutCost,salesCount","sourceDTO":"ProfitDto (types/profit.ts)"}}
{"CashSessionDto":{"fields":"id,openingBalanceCents,openedAt,openedBy,closedAt,closedBy,countedCents,expectedCents,divergenceCents,status","sourceDTO":"CashSessionDto (types/profit.ts)"}}
{"CashSessionStatus":{"fields":"'aberta'|'fechada'","sourceDTO":"CashSessionStatus (types/profit.ts)"}}

### Retrofit
- `app/(app)/financeiro/caixa/page.tsx`: await `getOpenSessionAction()` → `<CashSessionPanel session={...} />` acima do CashBalanceCard; `<SessionHistory />` abaixo do CashStatement (RF07/RF08).
- `app/(app)/layout.tsx`: add `<Link href="/lucro">Lucro</Link>` (entre Financeiro e Configurações).

Reference: `app/(app)/financeiro/caixa/page.tsx`, `components/financeiro/{CashBalanceCard,CashMovementDialog,CashStatement}.tsx`, `components/estoque/MovementHistory.tsx`, `app/(app)/layout.tsx`, `lib/format/money.ts`, `components/ui/MoneyInput.tsx`

---

## Consolidation Notes

- **Esperado da sessão** (`selectSessionWithExpected` no DB / "Σ movimentos do turno" no backend) é o mesmo cálculo: `opening + SUM(cash_movements.amount_cents WHERE session_id)`. Nome único na implementação: `selectSessionWithExpected`/`selectSessionMovementsSum` — usar um helper só.
- **`selectOpenSessionId`** é o ponto de integração entre 0005F e 0004F: tanto o `finalizeSale` (entrada de venda) quanto o `registerCashMovement` (sangria/suprimento) chamam-no p/ carimbar `session_id`. Definido uma vez em `cash-session-data.ts`.
- **`itemsWithoutCost`** (ProfitDto) traduz o flag de `cost_cents_snapshot null` para a UI (RF03/RN04) — a UI mostra o aviso de lucro superestimado.

## Risks

| risk | prob | impact | mitigation |
|---|---|---|---|
| Retrofit do `finalizeSale` antes das colunas existirem | média | vendas existentes quebram | DB primeiro (`npm run db:setup`); testes de venda cobrem o snapshot na mesma tx |
| `db:push` derruba a RLS da `cash_sessions` | alta | vazamento entre tenants | rodar `db:setup`/`db:rls`; `db/__tests__/lucro-rls.test.ts` falha se a policy sumir |
| Corrida abrindo 2 turnos simultâneos | baixa | dois caixas abertos | partial unique index `(tenant_id) WHERE status='aberta'` + ConflictError no serviço |
| Produto sem custo infla o lucro silenciosamente | média | dono confia em lucro errado | `itemsWithoutCost` + aviso visível na ProfitSummaryCard (RN04) |
| Agregação de lucro lenta em dia grande | baixa | tela /lucro acima de ~100ms (RNF01) | index `(tenant_id, created_at)` em sales; volume MVP baixo |

## Validation

- `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` — todos exit 0.
- Banco no ar (`docker compose up -d` → `npm run db:setup`): integração + RLS rodam de verdade.
- Métricas de auditoria (about.md): lucro exibido = Σ(preço−custo) das vendas; esperado da sessão = opening + Σ dinheiro do turno; 100% dos itens de produto com custo têm snapshot.
- Manual: abrir caixa → vender em dinheiro → fechar conferindo a gaveta mostra esperado/contado/divergência; editar o custo de um produto não muda o lucro de uma venda passada.

## Requirements Coverage

| ID | Requirement | Covered? | Area | Tasks |
|----|-------------|----------|------|-------|
| RF01 | Snapshot de custo por item na venda | YES | DB + Backend | retrofit sale_items + finalizeSale |
| RF02 | Tela de lucro do dia (faturamento/custo/lucro/margem%) | YES | Backend + Frontend | getProfitByPeriod, ProfitSummaryCard |
| RF03 | Item sem custo sinalizado, nunca omitido | YES | Backend + Frontend | itemsWithoutCost, aviso na UI |
| RF04 | Abrir caixa com saldo inicial | YES | DB + Backend + Frontend | cash_sessions, openCashSession, OpenSessionDialog |
| RF05 | Movimentações vinculadas à sessão | YES | DB + Backend | session_id, selectOpenSessionId retrofit |
| RF06 | Fechar: esperado/contado/divergência | YES | Backend + Frontend | closeCashSession, CloseSessionDialog |
| RF07 | Histórico de sessões | YES | Backend + Frontend | listSessions, SessionHistory |
| RF08 | Indica turno aberto na tela de caixa | YES | Backend + Frontend | getOpenSession, CashSessionPanel |
| RN01 | Isolamento por tenant (RLS) | YES | DB | 0005_lucro_rls.sql, lucro-rls.test.ts |
| RN02 | Centavos; lucro pode ser negativo | YES | DB + Backend | CHECK ≥0 em saldo/contagem; profit sem clamp |
| RN03 | Custo snapshot imutável | YES | DB + Backend | cost_cents_snapshot congelado na venda |
| RN04 | Sem custo → snapshot null, conta 0 + marcado | YES | Backend + Frontend | COALESCE 0, itemsWithoutCost, aviso |
| RN05 | Lucro = revenue−cost, não desconta sangria/conta | YES | Backend | selectProfitByPeriod só sobre sale_items |
| RN06 | Esperado = opening + Σ dinheiro do turno | YES | Backend | SUM cash_movements por session_id |
| RN07 | Divergência = contado − esperado (sobra/falta) | YES | Backend + Frontend | closeCashSession, destaque na UI |
| RN08 | Sessão imutável após fechada | YES | DB + Backend | único UPDATE de fechamento; sem reopen |
| RN09 | Uma aberta por tenant; abrir 2ª rejeita | YES | DB + Backend | partial unique index + ConflictError |
| RN10 | Atribuição ao usuário/tenant da sessão | YES | Backend | opened_by/closed_by do ctx |
| RNF01 | Lucro/esperado rápidos, agregação direta | YES | DB | índices + SUM on-the-fly, sem profit_ledger |
| RNF02 | Snapshot na mesma tx da venda | YES | Backend | finalizeSale grava snapshot na tx existente |

Coverage: 20/20 = 100%. Nenhuma exclusão.

## Quick Reference

| Pattern | Codebase search |
|---|---|
| Entity / schema | `db/schema/cash-movements.ts`, `db/schema/sale-items.ts` |
| RLS migration | `db/migrations/0004_financeiro_rls.sql`, `db/rls.ts` |
| Repository / data layer | `lib/services/finance/cash-data.ts` (SUM/aggregate) |
| Service transacional | `lib/services/finance/cash-service.ts`, `lib/services/sales/sale-service.ts` (finalizeSale) |
| Server Action | `app/(app)/financeiro/caixa/actions.ts` |
| Validation (zod) | `lib/validation/finance.ts` |
| Page (RSC) | `app/(app)/financeiro/caixa/page.tsx` |
| List + filter | `components/estoque/MovementHistory.tsx` |
| Dialog + mutation | `components/financeiro/CashMovementDialog.tsx` |
| Money format | `lib/format/money.ts` (centsToBRL), `components/ui/MoneyInput.tsx` |
