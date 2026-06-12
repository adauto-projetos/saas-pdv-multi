---
id: 0006CHG
type: changelog
slug: lucro-fechamento
created: 2026-06-12
related: [0005F, 0002F, 0004F, 0001F]
---

# Changelog: Lucro e Fechamento de Caixa — 0005F

## Summary

Fecha a Fase 2 do roadmap (recurso #6) com 2 frentes: **Lucro do dia** (faturamento − custo dos produtos vendidos = margem real, com % e tratamento de item sem custo) e **Fechamento de caixa por turno** (abrir com fundo de troco, operar, e no fim conferir a gaveta: **esperado** vs **contado** vs **divergência**). O custo de cada item é gravado como **snapshot** na venda (retrofit de {{doc:0002F}} `finalizeSale`), de modo que o lucro histórico nunca muda quando o custo do produto é editado. O caixa contínuo de {{doc:0004F}} ganha o conceito de **sessão/turno** (`session_id` nas movimentações). Lucro é **derivado on-the-fly** (sem tabela de cache); dinheiro em centavos (lucro pode ser negativo = prejuízo); multi-tenant com RLS; sessão imutável após fechada.

## What Changed

### Database
- 1 tabela nova `cash_sessions` (`db/schema/cash-sessions.ts`): abertura (`opening_balance_cents`, `opened_at`, `opened_by`), fechamento (`closed_at`, `closed_by`, `counted_cents`, `expected_cents`, `divergence_cents`), `status` ('aberta'|'fechada'). CHECKs de não-negatividade em saldo/contagem e de status válido. **Partial UNIQUE INDEX** `(tenant_id) WHERE status='aberta'` garante no banco no máximo um turno aberto por tenant (RN09); índice `(tenant_id, opened_at)` para o histórico (RNF01).
- **Retrofit** `sale_items`: coluna `cost_cents_snapshot` (integer nullable) — custo unitário congelado na venda; null = produto sem custo (RN04). CHECK de não-negatividade.
- **Retrofit** `cash_movements`: coluna `session_id` (uuid nullable FK → `cash_sessions`, ON DELETE SET NULL) — vincula a movimentação ao turno aberto (RF05).
- RLS (`0005_lucro_rls.sql`): GRANT + ENABLE RLS + policy `tenant_isolation` em `cash_sessions` (padrão de {{doc:0004F}}). `sale_items`/`cash_movements` já têm RLS — só ganharam colunas.

### Backend
- Data layer + serviços (`lib/services/profit/`): `cash-session-data.ts`/`cash-session-service.ts` (lifecycle do turno) e `profit-data.ts`/`profit-service.ts` (agregação do lucro). Lucro = `SUM(subtotal_cents)` − `SUM(round(COALESCE(cost_cents_snapshot,0)×quantity))` sobre `sale_items`×`sales` por período; `itemsWithoutCost` = `COUNT FILTER (cost_cents_snapshot IS NULL)`. Tudo sob `withUserRls` (RN01).
- `openCashSession` (pré-check + partial unique index → ConflictError, RN09), `closeCashSession` (esperado = opening + Σ movimentos do turno; divergência = contado − esperado; único UPDATE aberta→fechada, RN08), `getOpenSession` (RF08), `listSessions` (RF07).
- **Retrofit** `finalizeSale` ({{doc:0002F}}): grava `cost_cents_snapshot` por item na **mesma tx** (RF01/RN03/RNF02) e carimba `session_id` na entrada de caixa em dinheiro via `selectOpenSessionId` (RF05).
- **Retrofit** `registerCashMovement` ({{doc:0004F}}): suprimento/sangria do turno recebem `session_id` (entram no esperado da gaveta — RN06).
- 5 Server Actions (`app/(app)/lucro/actions.ts`); schemas Zod (`lib/validation/profit.ts`); tipos (`types/profit.ts` — `ProfitDto`, `CashSessionDto`).

### Frontend
- Tela nova `/lucro` (RSC `force-dynamic`): `ProfitFilter` (período, padrão hoje) + `ProfitSummaryCard` (faturamento/custo/lucro verde-vermelho/margem %; aviso de itens sem custo).
- **Retrofit** `/financeiro/caixa`: `CashSessionPanel` (sem turno → "Abrir caixa"; aberto → saldo + "Fechar caixa"), `OpenSessionDialog`, `CloseSessionDialog` (mostra esperado/contado/divergência), `SessionHistory` (histórico de turnos filtrável).
- Link "Lucro" no header (`app/(app)/layout.tsx`).

## Requirements Delivered

- **RF01–RF08:** snapshot de custo por item na venda; tela de lucro do dia (faturamento/custo/lucro/margem%); item sem custo sinalizado e nunca omitido; abrir caixa com saldo inicial; movimentações vinculadas à sessão; fechar com esperado/contado/divergência; histórico de sessões; indicação de turno aberto na tela de caixa.
- **RN01–RN10:** isolamento por tenant (RLS); centavos inteiros com lucro podendo ser negativo; custo snapshot imutável; sem custo → snapshot null contando 0; lucro = revenue−cost sem descontar sangria/conta; esperado = opening + Σ dinheiro do turno; divergência = contado − esperado; sessão imutável após fechada; uma sessão aberta por tenant; atribuição ao usuário/tenant do contexto.
- **RNF01–RNF02:** lucro/esperado por agregação direta (sem `profit_ledger`); snapshot gravado na mesma transação da venda.

Cobertura: 20/20 = 100%. Nenhuma exclusão.

## Tests

175 testes verdes (Vitest) — inclui integração/RLS contra o Postgres local: snapshot de custo na mesma tx, lucro negativo/centavos/imutabilidade, esperado dinheiro-only, divergência sobra/falta, sessão única por tenant e imutável, isolamento de `cash_sessions`/`sale_items` entre tenants. Gates: typecheck 0, lint 0, test 0, build 0.

## Notes & Decisions

- **Lucro derivado on-the-fly** (sem `profit_ledger`): `SUM(subtotal − custo×qtd)` por período nunca dessincroniza (RNF01); custo via **snapshot** em `sale_items` (espelha o snapshot de preço que já existia) torna o lucro histórico imutável (RN03).
- **`selectOpenSessionId`** é o ponto único de integração 0005F↔0004F: tanto `finalizeSale` (entrada de venda) quanto `registerCashMovement` (sangria/suprimento) o chamam para carimbar `session_id`.
- **Esperado da gaveta = só dinheiro**: como `cash_movements` só existem para dinheiro ({{doc:0004F}} RN08), o `SUM(amount_cents WHERE session_id)` já é dinheiro-only (pix/cartão/fiado não entram).
- **Uma sessão aberta por tenant** defendida em duas camadas: pré-check no serviço + partial unique index no banco (última linha contra corrida), convertido em ConflictError.
- **Imutabilidade da sessão**: o único UPDATE permitido é a transição aberta→fechada (`WHERE status='aberta'`); refechar não acha linha; não há reabertura.
- Review: 0 violações, nenhum arquivo auto-corrigido. Os testes de integração/RLS rodaram de verdade (Postgres do Docker subido + `db:setup` aplicando `0005_lucro_rls.sql`).

## Quick Ref

```json
{"id":"0005F","domain":"PDV / lucro e fechamento de caixa (profit, cash session)","touched":["db/schema/","db/migrations/","db/__tests__/","lib/services/profit/","lib/services/sales/","lib/services/finance/","lib/validation/","app/(app)/lucro/","app/(app)/financeiro/","components/lucro/","components/financeiro/","types/"],"patterns":["server-actions","rls-multitenancy","transactional-service","cost-snapshot","derived-aggregation","shift-session","partial-unique-index","retrofit-integration"],"keywords":["lucro","margem","custo-snapshot","fechamento-caixa","turno","sessao","divergencia","esperado-vs-contado"]}
```
