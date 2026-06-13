---
id: 0006F
type: feature-plan
slug: comanda-mesa
status: draft
created: 2026-06-12
updated: 2026-06-13
related: [0006F, 0001F, 0002F, 0003F, 0004F, 0005F]
---

## TL;DR

Plano técnico da comanda/mesa ({{doc:0006F}}): uma **conta aberta** (`comandas` + `comanda_items`, lifecycle `aberta`→`fechada`|`cancelada` espelhando `cash_sessions` da {{doc:0005F}}) que recebe itens ao longo do atendimento — **baixando estoque no lançamento** (RN03, via `recordComandaExit`/`recordComandaEstorno`, ledger assinado da {{doc:0003F}}) — e que no **fechamento** reusa o pipeline de `finalizeSale` ({{doc:0002F}}) **menos a baixa de estoque** (RN08): cria `sales`+`sale_items` com **snapshot de preço/custo lido no close** (RN05), integra caixa/fiado ({{doc:0004F}}) e lucro ({{doc:0005F}}). Várias comandas abertas por tenant (RN04 — sem unique parcial); total parcial **informativo** (preço corrente); multi-tenant RLS; dinheiro em centavos; imutável após fechar/cancelar.

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

A venda de hoje ({{doc:0002F}}) é atômica (carrinho→`finalizeSale` num clique). A comanda é **long-lived**: abre, recebe N itens ao longo do tempo, fecha. Este plano adiciona a camada de conta aberta e faz o fechamento **desembocar no pipeline de venda já existente** (sale+items+caixa/fiado+snapshot de custo), reaproveitando estoque ({{doc:0003F}}), financeiro ({{doc:0004F}}) e lucro ({{doc:0005F}}). Fecha a **Fase 1 (Vender)** do roadmap.

## Architecture Decisions

| decision | rationale | alternatives rejected | triggering constraint |
|---|---|---|---|
| **Comanda = tabela de lifecycle** (`comandas`) espelhando `cash_sessions` | aberta→fechada/cancelada, imutável, auditável | `sale` com status aberto — polui a venda atômica da 0002F | RF01–RF08, RN06 |
| **`comanda_items` sem coluna de preço/custo** | snapshot só no fechamento (RN05); aberta guarda produto+qtd+observação | congelar preço no lançamento — escrita extra, diverge do close | RN05 |
| **Sem unique parcial em status** (≠ `cash_sessions`) | RN04 permite N comandas abertas por tenant | índice parcial de sessão única — bloquearia atendimento paralelo | RN04 |
| **Estoque baixa no lançamento + estorno** (`recordComandaExit/Estorno`) | espelha ledger assinado da 0003F; carimba `comanda_id` (não há sale ainda) | baixar no fechamento — decisão do owner foi lançar | RN03 |
| **Close reusa `finalizeSale` MENOS a baixa de estoque** | estoque já saiu no lançamento; close não pode re-baixar (RN08) | chamar `recordSaleExit` no close — baixa dupla | RN08 |
| **Snapshot de preço/custo lido no close** (`selectProductById` por item) | um só ponto de snapshot, igual `finalizeSale` | snapshot no lançamento — diverge do total informativo | RN05 |

## Main Flow

1. Operador → `/comandas` → "Abrir comanda" (rótulo livre, ex "Mesa 3") → `openComandaAction` → `openComanda` (sem conflito — RN04).
2. Lança item: produto (busca/código de barras) + qtd + observação → `addComandaItemAction` → `addComandaItem` numa tx: insere item + **baixa estoque** (`recordComandaExit`, carimba `comanda_id`). Total parcial ao vivo = Σ(preço atual × qtd) — informativo (RF05/RN05).
3. (Opcional) Remover item → `recordComandaEstorno` (+qty) + delete; Cancelar comanda → estorna todos + status `cancelada`, **sem venda** (RF04/RN06).
4. "Fechar" → dialog mostra **total final** (snapshot) + forma de pagamento (fiado exige cliente) → `closeComandaAction` → `closeComanda` numa única tx (mirror `finalizeSale`): snapshot de preço/custo no close → `insertSale`+`insertSaleItems` → `sales.comanda_id` + comanda `fechada` → `dinheiro`→caixa (vincula sessão se houver — RN09), `fiado`→a receber. **Sem** `recordSaleExit` (RN08).

## Implementation Order

Database (comandas + comanda_items + retrofit `stock_movements.comanda_id`/`sales.comanda_id` + RLS) → Backend (comanda data/service, `recordComandaExit/Estorno` em stock, retrofit close, actions, zod, types) → Frontend (`/comandas` + componentes). Tests por área seguem o TDD spec. ⚠️ Tabelas/colunas devem existir (`npm run db:setup`) ANTES do retrofit do close e do estoque.

---

## Test Specification

> Style: Vitest; `const suite = HAS_DB ? describe : describe.skip` para suites que tocam o banco (Docker Postgres); zod puro sempre roda. Money = inteiro em centavos; `ctx = { userId, tenantId }`. Seed via `db/__tests__/seed.ts`.
>
> **Novos seed helpers** (add a `db/__tests__/seed.ts`): `seedComanda(tenantId, userId, {label?, status?, saleId?})`, `seedComandaItem(tenantId, comandaId, productId, {quantity?, observation?})`, `setProductPrice(productId, salePriceCents)`, `getProductStock(productId)`. Reusa `seedProduct`/`seedCustomer`/`seedCashSession`/`HAS_DB`.

### Contract Tests (from RFs/RNs)

| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|---|---|---|---|---|---|---|
| `comanda-RF01-open` | Abrir com rótulo livre cria 'aberta' | service | RF01 | `openComanda(ctx,{label:"Mesa 3"})` | DTO status='aberta', openedBy=ctx.userId, items:[] | label echoed; partialTotalCents=0 |
| `comanda-RN04-multi-open` | Várias abertas simultâneas (sem conflito) | service | RN04 | open "Mesa 1" então "Mesa 2" | ambas ok, ids distintos | `listOpenComandas.length>=2`; sem ConflictError |
| `comanda-RN10-attribution` | Usa user/tenant do ctx | service | RN10 | `openComanda(ctx,{label:"X"})` | openedBy=ctx.userId | row tenantId=ctx.tenantId |
| `comanda-RF02-add-item` | Lançar item adiciona à comanda | service | RF02 | add `{productId,quantity:2}` | items tem 1 item qty 2 | item presente |
| `comanda-RN03-add-decrements-stock` | Lançar baixa estoque na hora | service/stock | RF02/RN03 | stock=10 → add qty 3 | stock=7 | movimento −qty com `comanda_id` (não `sale_id`) |
| `comanda-RN05-item-no-price` | Item NÃO grava preço congelado | service | RN05 | add → `setProductPrice(9999)` | item.unitPriceCents=9999 (atual) | `comanda_items` sem coluna de preço |
| `comanda-RN11-observation` | Observação gravada, não afeta cálculo | service | RF02/RN11 | add `observation:"sem cebola"` | observation persiste; subtotal igual | total independe da observação |
| `comanda-RN11-observation-null` | Sem observação → null | service | RN11 | add sem observation | observation=null | nullable aceito |
| `comanda-RN03-add-stock-negative` | Estoque pode ficar negativo | service/stock | RN03 | stock=1 → add qty 5 | ok; stock<0 | não bloqueia (mirror sale T11) |
| `comanda-RF03-remove-item` | Remover item de comanda aberta | service | RF03 | add → `removeComandaItem` | items sem o itemId | comanda segue 'aberta' |
| `comanda-RN03-remove-estorna-stock` | Remover estorna estoque | service/stock | RF03/RN03 | stock=10, add 3 (→7), remove | stock=10 | movimento +qty inverso, mesmo `comanda_id` |
| `comanda-RF04-cancel` | Cancelar → 'cancelada', sem venda | service | RF04/RN06 | add 2 itens → cancel | status='cancelada', saleId=null | **nenhuma** `sales` criada |
| `comanda-RN03-cancel-estorna-all` | Cancelar estorna TODOS os itens | service/stock | RF04/RN03 | A qty3 (10→7), B qty2 (5→3) → cancel | stockA=10, stockB=5 | Σ estornos = Σ baixas |
| `comanda-RF05-partial-total` | Parcial = Σ preço atual × qty | service | RF05/RN02 | un 1000×2, kg 590×0.75 | partialTotalCents=2443 | soma do preço corrente; ≥0 |
| `comanda-RF05-partial-reflects-price-change` | Parcial muda com preço do produto | service | RF05/RN05 | add un qty2 (2000) → `setProductPrice(1500)` | partialTotalCents=3000 | recomputa do preço atual |
| `comanda-RF05-partial-empty` | Sem itens → parcial 0 | service | RF05/RN02 | open, 0 itens | partialTotalCents=0 | items vazio |
| `comanda-RF06-close-creates-sale` | Fechar cria venda+itens, 'fechada' | service | RF06 | add un qty2 → close dinheiro | SaleDto total 2000; comanda.saleId set | `sales` com `comanda_id`; closedAt/By set |
| `comanda-RN05-close-snapshot` | sale_items snapshot de preço NO close | service | RF06/RN05 | add un (1000) → `setProductPrice(1500)` → close | sale_item.unitPriceCents=1500 | preço do close, não do lançamento |
| `comanda-RN05-close-cost-snapshot` | Snapshot de custo alimenta lucro | service | RF07/RN05 | costCents=400, qty2 → close | sale_item.costCentsSnapshot=400 | custo no `sale_items` |
| `comanda-RN05-close-null-cost` | Sem custo → snapshot null | service | RF07/RN05 | costCents=null → close | costCentsSnapshot=null | null aceito |
| `comanda-RN08-close-no-restock` | Fechamento NÃO re-baixa estoque | service/stock | RF07/RN08 | stock=10, add 3 (→7), close | stock segue 7 | sem novo movimento 'saida' no close |
| `comanda-RN09-close-cash-caixa` | Dinheiro → entrada de caixa | service | RF07/RN09 | qty2 → close dinheiro | cash_movement entrada/venda 2000 | entrada=total |
| `comanda-RN09-close-cash-session-link` | Dinheiro + turno aberto → vincula sessão | service | RN09 | turno aberto → close dinheiro | cash_movement.sessionId=sessão | entra no esperado da gaveta |
| `comanda-RN09-close-cash-no-session` | Dinheiro sem turno → sem sessão | service | RN09 | sem turno → close dinheiro | sessionId=null; ok | sem bloqueio/aviso |
| `comanda-RN07-close-fiado-receivable` | Fiado+cliente → a receber, sem caixa | service | RF07/RN07 | qty1 → close fiado+customer | receivable venda; 0 cash_movement | a receber criado |
| `comanda-RN07-close-fiado-no-customer` | Fiado sem cliente → rejeita | service | RN07 | close fiado sem customer | `ValidationError`; sem `sales` | comanda segue 'aberta' |
| `comanda-RN07-close-empty` | Fechar comanda vazia → rejeita | service | RN07 | open (0 itens) → close | `ValidationError`; sem `sales` | nada persistido |
| `comanda-RN09-close-pix-no-caixa` | pix/cartão não toca caixa | service | RF07/RN09 | qty1 → close pix | sale criada; 0 cash_movement | sem entrada |
| `comanda-RN06-closed-immutable-add` | Fechada rejeita lançar item | service | RN06 | close → add | erro; sem item | add só em 'aberta' |
| `comanda-RN06-closed-immutable-cancel` | Fechada não cancela | service | RN06 | close → cancel | erro; status 'fechada' | WHERE status='aberta' guarda |
| `comanda-RN06-closed-immutable-reclose` | Fechada não fecha de novo | service | RN06 | close → close | erro; row estável | guarda idempotente |
| `comanda-RN06-cancelled-immutable-add` | Cancelada rejeita lançar item | service | RN06 | cancel → add | erro; sem item | add só em 'aberta' |
| `comanda-RN06-cancelled-immutable-close` | Cancelada não fecha (sem venda) | service | RN06 | cancel → close | erro; sem `sales` | cancelada nunca vira venda |
| `comanda-RF08-list-open` | Lista abertas com total parcial | service | RF08/RNF01 | 2 comandas com itens | ambas, cada uma com partialTotalCents | só 'aberta' |
| `comanda-RF08-list-open-excludes-closed` | Abertas exclui fechadas/canceladas | service | RF08 | open A, close A; open B | lista tem B, não A | terminais fora |
| `comanda-RF08-history` | Histórico lista fechadas/canceladas | service | RF08 | close 1, cancel 1 → history | ambas; label/status/datas/saleId | 'aberta' fora |
| `comanda-RF08-history-period` | Histórico filtra from/to | service | RF08 | history `{from,to}` | só no intervalo | filtro de período |
| `comanda-RNF02-close-atomic` | Fechamento atômico (venda+itens+caixa) | service | RNF02 | add 2 → close dinheiro | sale, sale_items, cash_movement juntos | tx única |
| `comanda-RNF02-remove-atomic` | Estorno ao remover é atômico | service/stock | RNF02/RN03 | add (→7) → remove | item fora E stock 10 juntos | sem estado parcial |
| `rls-RN01-comanda-isolation` | Tenant A não vê comandas de B | rls | RN01 | seedComanda em B; `withUserRls(A)` | length 0 | RLS bloqueia cross-tenant |
| `rls-RN01-comanda-items-isolation` | Tenant A não vê comanda_items de B | rls | RN01 | seedComandaItem em B; `withUserRls(A)` | length 0 | RLS isola filhos |
| `val-RN01-label-required` | label não-vazio | val | RF01/RN02 | `""`,`"  "`,`"Mesa 3"` | false,false,true | `trim().min(1)` |
| `val-RN02-quantity-positive` | quantity finito > 0 | val | RN02/RF02 | `0`,`-1`,`Infinity`,`2` | false×3, true | `.finite().positive()` |
| `val-RN02-ids-uuid` | ids uuid válidos | val | RN02 | comandaId/productId inválidos | false | uuid validation |
| `val-RN11-observation-optional` | observation opcional/trim/limite | val | RN11 | omit / "sem cebola" / over-max | true,true,false | `trim().max(N).optional()` |
| `val-RN07-fiado-requires-customer` | fiado exige customerId | val | RN07 | fiado sem/with customer; dinheiro | false,true,true | `.refine` (mirror sale) |
| `val-RN02-close-payment-enum` | só métodos válidos | val | RN02 | "boleto" vs dinheiro/pix/cartao/fiado | false; 4 true | reusa `paymentMethodSchema` |
| `val-comanda-filter-optional` | from/to/status opcionais | val | RF08 | `{}`,`{from,to}`,`{status}` | todos true | mirror `profitFilterSchema` |

### Test File Mapping

| Area | Test File | Test IDs |
|---|---|---|
| Comanda service (lifecycle/itens/estoque/close) — `HAS_DB` | `lib/services/comanda/comanda-service.test.ts` | todos `comanda-*` |
| RLS — `HAS_DB` | `db/__tests__/comanda-rls.test.ts` | `rls-RN01-comanda-isolation`, `rls-RN01-comanda-items-isolation` |
| Zod (sempre roda) | `lib/validation/comanda.test.ts` | todos `val-*` |
| Seed helpers | `db/__tests__/seed.ts` | `seedComanda`, `seedComandaItem`, `setProductPrice`, `getProductStock` |

Coverage: 8/8 RF, 11/11 RN, 2/2 RNF = 100%.

---

## Database

### Entities

| Entity | Table | Key Fields | Reference |
|--------|-------|------------|-----------|
| Comanda (conta aberta) | `comandas` | `id`, `tenant_id`, `label` (text, rótulo livre), `status` ('aberta'\|'fechada'\|'cancelada'), `opened_by`, `opened_at`, `closed_by`, `closed_at`, `sale_id` (nullable FK→sales, set null) | Mirror: `db/schema/cash-sessions.ts` (lifecycle + imutável) |
| Item de comanda | `comanda_items` | `id`, `tenant_id`, `comanda_id` (FK→comandas cascade), `product_id` (FK→products set null), `quantity` (numeric 10,3 > 0), `observation` (text nullable) | Sem snapshot — RN05; `db/schema/sale-items.ts` |
| Retrofit `stock_movements` | add col `comanda_id` (uuid nullable, sem FK declarada — mirror `cash_movements.receivable_payment_id`) | liga exit/estorno à comanda antes da venda existir | `db/schema/stock-movements.ts` |
| Retrofit `sales` | add col `comanda_id` (uuid nullable FK→comandas set null) | audit: qual venda veio de um fechamento de comanda | `db/schema/sales.ts` |

### Migration

- **CREATE TABLE** `comandas` — uuid PK; tenant_id NOT NULL FK→tenants cascade; label text NOT NULL; status text NOT NULL default 'aberta'; opened_by FK→users restrict; opened_at timestamptz default now(); closed_by FK→users restrict nullable; closed_at timestamptz nullable; sale_id uuid FK→sales set null nullable
  - CHECK `comandas_status_valid`: `status in ('aberta','fechada','cancelada')`
  - INDEX `comandas_tenant_status_idx` (tenant_id, status) — RNF01; INDEX `comandas_tenant_opened_at_idx` (tenant_id, opened_at)
  - **Sem** unique parcial em status — RN04 (várias abertas)
- **CREATE TABLE** `comanda_items` — uuid PK; tenant_id NOT NULL FK→tenants cascade; comanda_id NOT NULL FK→comandas cascade; product_id FK→products set null nullable; quantity numeric(10,3) NOT NULL; observation text nullable
  - CHECK `comanda_items_quantity_positive`: `quantity > 0`; INDEX `(comanda_id)` e `(tenant_id)`
- **ALTER** `stock_movements` ADD `comanda_id` uuid (sem FK — mirror `cash_movements`); estorno compartilha o `comanda_id`, distinto pelo sinal de `quantity`
- **ALTER** `sales` ADD `comanda_id` uuid FK→comandas set null nullable (back-link)
- **RLS**: `db/migrations/0006_comanda_rls.sql` — GRANT + ENABLE RLS + `tenant_isolation` em `comandas` e `comanda_items` (idêntico a `0005_lucro_rls.sql`). `stock_movements`/`sales` já têm RLS.

### Repository (lib/services/comanda/comanda-data.ts)

| Method | Purpose |
|--------|---------|
| `insertComanda(tenantId, userId, label)` | Abrir 'aberta' |
| `selectOpenComandas(tenantId)` | Abertas + itens p/ total parcial (RNF01) |
| `selectComandaById(tenantId, comandaId)` | Comanda + itens (antes de lançar/fechar) |
| `insertComandaItem(tenantId, comandaId, productId, quantity, observation?)` | Lançar item |
| `deleteComandaItem(tenantId, comandaId, itemId)` | Remover (caller estorna estoque na tx) |
| `closeComandaRow(tenantId, comandaId, saleId, closedBy)` | status='fechada', set sale_id + closed_at |
| `cancelComandaRow(tenantId, comandaId, closedBy)` | status='cancelada' + closed_at |
| `selectComandaHistory(tenantId, filter)` | Fechadas/canceladas (RF08) |

Reference: `lib/services/profit/cash-session-data.ts`, `lib/services/finance/cash-data.ts`.

---

## Backend

Next.js 16 Server Actions → services (`lib/services/comanda/`) → data (Drizzle via `withUserRls`). Tenant/user sempre do `ctx` (RN10); centavos (RN02). Mirror `cash-session-service.ts` (lifecycle) + `sale-service.ts` (close atômico).

### Server Actions (app/(app)/comandas/actions.ts)
Shape mirror `financeiro/caixa/actions.ts`: `safeParse` → `requireAuthContext` → service → `revalidatePath("/comandas")` → `ActionResult`; erros via `toActionError`.

| Action | Input (zod) | Returns | RF | Purpose |
|---|---|---|---|---|
| `openComandaAction` | `openComandaSchema` | `ComandaDto` | RF01 | Abre 'aberta' (sem conflito — RN04) |
| `addComandaItemAction` | `addComandaItemSchema` | `ComandaDto` | RF02 | Lança item + baixa estoque (RN03) |
| `removeComandaItemAction` | `removeComandaItemSchema` | `ComandaDto` | RF03 | Remove + estorna estoque |
| `cancelComandaAction` | `comandaIdSchema` | `ComandaDto` | RF04 | Cancela + estorna todos (RN06) |
| `closeComandaAction` | `closeComandaSchema` | `SaleDto` | RF06/07 | Fecha → vira venda (snapshot+caixa/fiado, sem baixa) |
| `getComandaAction` | `comandaIdSchema` | `ComandaDto` | RF05 | Comanda + itens + total parcial ao vivo |
| `listOpenComandasAction` | — | `ComandaDto[]` | RF08 | Abertas com total parcial (RNF01) |
| `listComandaHistoryAction` | `comandaFilterSchema` | `ComandaSummaryDto[]` | RF08 | Histórico fechadas/canceladas |

### Service Functions (lib/services/comanda/comanda-service.ts)

| Function | Tx? | Purpose / atomic steps |
|---|---|---|
| `openComanda(ctx, input)` | tx | `insertComanda` → DTO. Sem open-conflict (RN04) |
| `addComandaItem(ctx, input)` | tx (RNF02) | `selectComandaById` (existe + 'aberta', senão ValidationError); `selectProductById` (NotFound); `insertComandaItem`; **baixa** `recordComandaExit(−qty, comandaId)`; reload |
| `removeComandaItem(ctx, input)` | tx (RNF02) | comanda 'aberta'; item (NotFound); `recordComandaEstorno(+qty, comandaId)`; `deleteComandaItem`; reload |
| `cancelComanda(ctx, input)` | tx | comanda+itens 'aberta'; cada item `recordComandaEstorno(+qty)`; `cancelComandaRow`; **sem venda** (RN06); reload |
| `closeComanda(ctx, input)` | tx — **mirror `finalizeSale`** | ver Retrofits |
| `getComanda(ctx, id)` | read | comanda + itens + total parcial ao vivo (RF05) |
| `listOpenComandas(ctx)` | read | `selectOpenComandas` + totais parciais (RNF01) |
| `listComandaHistory(ctx, filter)` | read | `selectComandaHistory` por período (RF08) |

### Validation Schemas (lib/validation/comanda.ts) — mirror `lib/validation/sale.ts`
| Schema | Fields | Key validations |
|---|---|---|
| `openComandaSchema` | `label` | `z.string().trim().min(1)` (RF01) |
| `addComandaItemSchema` | `comandaId`,`productId`,`quantity`,`observation?` | uuids; `quantity .finite().positive()`; `observation .trim().max(N).optional()` (RN11) |
| `removeComandaItemSchema` | `comandaId`,`itemId` | uuids |
| `comandaIdSchema` | `comandaId` | uuid |
| `closeComandaSchema` | `comandaId`,`paymentMethod`,`customerId?` | `.refine` fiado ⇒ customerId (RN07) |
| `comandaFilterSchema` | `from?`,`to?`,`status?` | opcionais (padrão `cashFilterSchema`) |

### DTOs / Types (types/comanda.ts)
| Type | Fields | Notes |
|---|---|---|
| `ComandaStatus` | `'aberta'\|'fechada'\|'cancelada'` | espelha `CashSessionStatus` |
| `ComandaItemDto` | `id`,`productId`,`name`,`unit`,`unitPriceCents`,`quantity`,`subtotalCents`,`observation` | preço **corrente** — não snapshot (RN05) |
| `ComandaDto` | `id`,`label`,`status`,`openedBy/At`,`closedBy/At`,`saleId`,`partialTotalCents`,`items[]` | total parcial informativo (RF05) |
| `ComandaSummaryDto` | `id`,`label`,`status`,`openedAt`,`closedAt`,`saleId` | linha de histórico (RF08) |
| close retorna `SaleDto` | (reusa `types/sale.ts`) | venda criada no fechamento |

### Retrofits / Integration points
- **`closeComanda` (RF06/07) — reusa `finalizeSale` MENOS a baixa de estoque (RN08):** numa `withUserRls` tx — (1) `selectComandaById`, rejeita se status≠'aberta' (Conflict) ou **0 itens** (ValidationError, RN07); (2) por item `selectProductById` **no close** → `salePriceCents`/`name`/`unit`/`costCents` = snapshot (RN05); soma `totalCents`; (3) `insertSale`+`insertSaleItems` (com `costCentsSnapshot`) — reusa `lib/services/sales/data.ts`; (4) `closeComandaRow` (status='fechada', sale_id, closed_by/at); (5) financeiro: `dinheiro`→`insertCashMovement` com `sessionId=selectOpenSessionId(tx)` (RN09), `fiado`→`recordSaleReceivable` (RN07 garante customerId), pix/cartão não tocam caixa. **NÃO** chama `recordSaleExit` (RN08). Set `sales.comanda_id`.
- **Stock no lançamento/estorno (RN03):** novas funções em `lib/services/stock/data.ts` espelhando `recordSaleExit` mas carimbando `comanda_id`: `recordComandaExit` (−qty) e `recordComandaEstorno` (+qty inverso). `insertMovement` ganha campo opcional `comandaId`. Pode ficar negativo (RN03).
- **Imutabilidade (RN06):** add/remove/cancel só em 'aberta'; UPDATE de cancel/close exige `status='aberta'` no WHERE (idempotência de corrida, como `closeCashSession`).

### Module Structure
```
app/(app)/comandas/actions.ts
lib/services/comanda/{comanda-service.ts, comanda-data.ts, comanda-service.test.ts}
~ lib/services/stock/data.ts        (+recordComandaExit/Estorno; insertMovement +comandaId)
~ lib/services/sales/data.ts        (insertSale +comandaId; reuso no close)
lib/validation/{comanda.ts, comanda.test.ts}
types/comanda.ts
```
Reference: `lib/services/sales/sale-service.ts`, `lib/services/profit/cash-session-service.ts`+`cash-session-data.ts`, `lib/services/stock/data.ts`, `lib/services/finance/receivable-service.ts`+`cash-data.ts`, `app/(app)/financeiro/caixa/actions.ts`, `lib/validation/sale.ts`, `lib/services/errors.ts`.

---

## Frontend

NO TanStack/Zustand. RSC page (`force-dynamic`) carrega via Server Action; mutações chamam action → `router.refresh()` (mirror `OpenSessionDialog`); histórico filtrável via `useEffect`→action com cleanup `active` (mirror `SessionHistory`). Money em centavos via `centsToBRL`. Lançar item espelha `components/caixa/*`; fechar espelha `PaymentDialog`.

### Pages
| Route | Page Component | Purpose |
|---|---|---|
| `/comandas` | `app/(app)/comandas/page.tsx` (RSC) | `listOpenComandasAction` → `ComandasScreen` (abertas + histórico). RF08 |

### Components (components/comandas/)
{"ComandasScreen":{"purpose":"client root: grade de abertas + OpenComandaDialog + histórico (RF08)"}}
{"OpenComandaDialog":{"purpose":"Dialog rótulo livre → openComandaAction → refresh (RF01, mirror OpenSessionDialog)"}}
{"ComandaCard":{"purpose":"uma comanda: label, total parcial, fechar/cancelar (mirror CashSessionPanel)"}}
{"ComandaItemPanel":{"purpose":"lançar+listar itens: BarcodeInput+ProductSearch+qty+observação → add; remover (RF02/03/05)"}}
{"AddItemForm":{"purpose":"produto + QuantityInput + observação → add (RF02)"}}
{"CloseComandaDialog":{"purpose":"confirma: total FINAL + pagamento + CustomerPicker p/ fiado → closeComandaAction (RF06, mirror PaymentDialog)"}}
{"ComandaHistory":{"purpose":"tabela filtrável fechadas/canceladas, useEffect→listComandaHistoryAction (RF08, mirror SessionHistory)"}}

### Data & Mutations (RSC + Server Action — NO TanStack/Zustand)
- `/comandas` (RSC, `force-dynamic`): await `listOpenComandasAction()`; `!ok` → fallback `text-destructive` (mirror `lucro/page.tsx`).
- open/add/remove/cancel/close: action → `toast` → `router.refresh()` (mirror `OpenSessionDialog`). Servidor é a fonte da verdade (sem cache client).
- Detalhe da comanda ativa: `ComandaItemPanel` lê o `ComandaDto` da lista já recarregada; seleção é `useState` (UI). Total parcial = `partialTotalCents` (informativo; `CloseComandaDialog` avisa "valor final no fechamento pode diferir" — RF05/RN05).
- `ComandaHistory`: `useState(from,to)` + `useEffect`→`listComandaHistoryAction`, cleanup `active`, loading/error/empty (`to`→`${to}T23:59:59`).

### Types (mirror backend DTOs)
{"ComandaStatus":{"sourceDTO":"types/comanda.ts"}}
{"ComandaItemDto":{"fields":"id,productId,name,unit,unitPriceCents,quantity,subtotalCents,observation","sourceDTO":"types/comanda.ts (preço corrente, não snapshot)"}}
{"ComandaDto":{"fields":"id,label,status,openedBy/At,closedBy/At,saleId,partialTotalCents,items[]","sourceDTO":"types/comanda.ts"}}
{"ComandaSummaryDto":{"fields":"id,label,status,openedAt,closedAt,saleId","sourceDTO":"types/comanda.ts"}}
{"SaleDto":{"sourceDTO":"types/sale.ts — retorno de closeComandaAction"}}

### Retrofit
- Nav `<Link href="/comandas">Comandas</Link>` em `app/(app)/layout.tsx` (após Caixa).
- Reusa `components/caixa/{BarcodeInput,ProductSearch}`, `components/ui/{QuantityInput,MoneyInput}` p/ lançar; `components/financeiro/CustomerPicker` p/ fiado; `centsToBRL`, sonner `toast`, `ui/{Card,Dialog,AlertDialog,Table,Input,Label,Button,Badge}`.

Reference: `app/(app)/financeiro/caixa/page.tsx`, `components/financeiro/{CashSessionPanel,OpenSessionDialog,SessionHistory}.tsx`, `components/caixa/{CashierScreen,Cart,ProductSearch,BarcodeInput,PaymentDialog}.tsx`, `app/(app)/lucro/page.tsx`, `lib/format/money.ts`.

---

## Consolidation Notes

- **`recordComandaExit`/`recordComandaEstorno`** são o ponto de integração 0006F↔0003F: espelham `recordSaleExit` mas carimbam `comanda_id` (não `sale_id`), pois no lançamento ainda não há venda. `insertMovement` ganha `comandaId?` opcional.
- **`closeComanda` reusa `insertSale`/`insertSaleItems`/`recordSaleReceivable`/`insertCashMovement`/`selectOpenSessionId`** — todo o pipeline de `finalizeSale` exceto `recordSaleExit` (RN08). Snapshot lido no close por `selectProductById` (RN05).
- **Total parcial (RF05)** usa preço corrente do produto — `listOpenComandas`/`getComanda` devem fazer **JOIN** com `products` (não N+1 por `selectProductById`) para o cálculo (RNF01).
- **`partialTotalCents` (DTO)** é informativo; o valor cobrado é o snapshot do close — a UI avisa a possível divergência.

## Risks

| risk | prob | impact | mitigation |
|---|---|---|---|
| Close re-baixar estoque (baixa dupla) | média | estoque errado | RN08 explícito: close não chama `recordSaleExit`; teste `comanda-RN08-close-no-restock` |
| Estorno não roda ao remover/cancelar | média | estoque inflado | estorno na MESMA tx; testes `remove-estorna`/`cancel-estorna-all` |
| `db:push` derruba RLS de `comandas` | alta | vazamento entre tenants | `db:setup`/`db:rls`; `comanda-rls.test.ts` falha se a policy sumir |
| Total parcial N+1 lento (muitos itens) | baixa | `/comandas` lento (RNF01) | JOIN com products em vez de lookup por item; volume MVP baixo |
| Preço muda no meio → parcial ≠ final | média | confusão do operador | RF05/RN05: aviso na UI; cobrança é o snapshot do close |

## Validation

- `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` — todos exit 0.
- Banco no ar (`docker compose up -d` → `npm run db:setup`): integração + RLS rodam de verdade.
- Manual: abrir comanda → lançar itens (estoque baixa) → remover item (estorna) → fechar em dinheiro → vira venda (caixa + lucro); cancelar comanda estorna tudo sem venda.

## Requirements Coverage

| ID | Requirement | Covered? | Area | Tasks |
|----|-------------|----------|------|-------|
| RF01 | Abrir comanda com rótulo livre | YES | DB + Backend + Frontend | comandas, openComanda, OpenComandaDialog |
| RF02 | Lançar item (baixa estoque no lançamento) | YES | DB + Backend + Frontend | comanda_items, addComandaItem, recordComandaExit, AddItemForm |
| RF03 | Remover item (estorna estoque) | YES | Backend + Frontend | removeComandaItem, recordComandaEstorno |
| RF04 | Cancelar comanda (estorna todos, sem venda) | YES | Backend + Frontend | cancelComanda |
| RF05 | Total parcial ao vivo (informativo) | YES | Backend + Frontend | partialTotalCents (JOIN products), ComandaItemPanel |
| RF06 | Fechar → vira venda (snapshot, dialog confirm) | YES | Backend + Frontend | closeComanda, CloseComandaDialog |
| RF07 | dinheiro→caixa, fiado→a receber, custo→lucro, sem re-baixa | YES | Backend | closeComanda integração |
| RF08 | Tela de comandas (abertas + histórico) | YES | Backend + Frontend | listOpenComandas, listComandaHistory, ComandasScreen |
| RN01 | Isolamento por tenant (RLS) | YES | DB | 0006_comanda_rls.sql, comanda-rls.test.ts |
| RN02 | Centavos inteiros; total ≥ 0 | YES | DB + Backend | CHECK qty>0; zod cents |
| RN03 | Estoque baixa ao lançar; estorna remove/cancel; pode negativo | YES | Backend | recordComandaExit/Estorno |
| RN04 | Várias comandas abertas por tenant | YES | DB + Backend | sem unique parcial; openComanda sem conflito |
| RN05 | Snapshot preço/custo no fechamento; aberta sem preço | YES | DB + Backend | comanda_items sem preço; close snapshot |
| RN06 | Fechada/cancelada imutável | YES | DB + Backend | WHERE status='aberta'; sem reopen |
| RN07 | Fechar ≥1 item; fiado exige cliente | YES | Backend | closeComanda guard + zod refine |
| RN08 | Fechamento não baixa estoque | YES | Backend | close não chama recordSaleExit |
| RN09 | Não exige turno; dinheiro vincula sessão se houver | YES | Backend | selectOpenSessionId no close |
| RN10 | Atribuição ao usuário/tenant do contexto | YES | Backend | opened_by/closed_by do ctx |
| RN11 | Observação texto livre opcional | YES | DB + Backend + Frontend | comanda_items.observation, zod optional |
| RNF01 | Lista abertas + parcial rápido | YES | DB | índice (tenant_id,status); JOIN products |
| RNF02 | Fechamento atômico; estorno atômico | YES | Backend | tudo em withUserRls tx |

Coverage: 21/21 (8 RF + 11 RN + 2 RNF) = 100%. Nenhuma exclusão.

## Quick Reference

| Pattern | Codebase search |
|---|---|
| Entity / schema (lifecycle) | `db/schema/cash-sessions.ts`, `db/schema/sale-items.ts` |
| RLS migration | `db/migrations/0005_lucro_rls.sql`, `db/rls.ts` |
| Data layer (lifecycle/ledger) | `lib/services/profit/cash-session-data.ts`, `lib/services/stock/data.ts` |
| Service transacional (close) | `lib/services/sales/sale-service.ts` (`finalizeSale`), `lib/services/profit/cash-session-service.ts` |
| Server Action | `app/(app)/financeiro/caixa/actions.ts` |
| Validation (zod) | `lib/validation/sale.ts` |
| Page (RSC) + lista | `app/(app)/financeiro/caixa/page.tsx`, `components/financeiro/SessionHistory.tsx` |
| Lançar item / pagamento UX | `components/caixa/{Cart,ProductSearch,BarcodeInput,PaymentDialog}.tsx` |
| Money format | `lib/format/money.ts`, `components/ui/MoneyInput.tsx` |
