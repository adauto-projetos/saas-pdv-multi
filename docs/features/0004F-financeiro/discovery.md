---
id: 0004F
type: feature-discovery
slug: financeiro
created: 2026-06-11
updated: 2026-06-11
related: [0004F, 0002F, 0001F]
---

## TL;DR

Análise de codebase para {{doc:0004F}}. Fundação madura na `master` (0001F produtos, 0002F venda, 0003F estoque). O Financeiro **reaproveita** dinheiro-em-centavos, `withUserRls`, data layer `Executor`, `ActionResult`, Server Actions e Base UI; e **integra** a venda (forma `fiado` + entrada no caixa). Novo: 5 tabelas (`customers`, `receivables`, `receivable_payments`, `payables`, `payable_payments`, `cash_movements`) + retrofit da venda. É a maior feature até aqui — única (não-epic) por decisão do founder.

## Estado do Codebase

- `master`: 0001F+0002F+0003F. Stack Next 16 + Drizzle + Postgres (Docker) + Zod v4 + shadcn (Base UI).
- Venda (`db/schema/sales.ts`): `payment_method text CHECK in('dinheiro','pix','cartao')`. **Retrofit:** adicionar `'fiado'` + `customer_id` (nullable) na venda; e gerar entrada de caixa quando `dinheiro`.
- Padrões: tabelas com `tenant_id` + RLS `tenant_isolation` (`db/migrations/000N_*_rls.sql`); serviço transacional `withUserRls`; coerção numeric→number; o footgun `db:push` derruba RLS (rodar `db:rls`/`db:setup`).

## Reaproveitamento

| O quê | Onde | Uso na 0004F |
|---|---|---|
| Venda + finalizeSale | `lib/services/sales/sale-service.ts` | Forma `fiado` gera conta a receber; dinheiro gera entrada de caixa (retrofit, na tx da venda) |
| Dinheiro em centavos + format | `lib/format/money.ts` | Valores, saldo, total devedor |
| RLS por transação | `db/rls.ts` (`withUserRls`) | Pagamentos parciais + movimentação de caixa atômicos |
| Padrão de movimentação assinada | `db/schema/stock-movements.ts` (0003F) | `cash_movements` espelha (entrada +, saída −, saldo = soma) |
| Data layer / erros / actions / UI | `lib/services/*`, `app/(app)/*`, `components/*` | Mesmo padrão (telas, dialogs, tabelas) |

## Pré-requisitos

| Pré-requisito | Status |
|---|---|
| Venda com formas de pagamento | ✅ 0002F (estender com `fiado`) |
| Multi-tenancy / RLS, auth, usuário | ✅ 0001F |
| Dinheiro em centavos | ✅ 0001F/0002F |
| Tabelas financeiras + cliente | ⬜ Criar nesta feature |

## Padrões a Estabelecer

- **Pagamento parcial transacional:** inserir o pagamento, recomputar o saldo/status da conta e (se dinheiro) lançar a movimentação de caixa — tudo na MESMA `withUserRls` tx (RN03/RN04/RN08).
- **Saldo do caixa = soma das `cash_movements`** (entrada +, saída −) — espelha o ledger assinado do estoque (0003F).
- **Status derivado** (`aberto`/`parcial`/`quitado`) calculado do total − Σ pagamentos.
- **Retrofit da venda:** `payment_method 'fiado'` (+ `customer_id` obrigatório, gera receivable) e `'dinheiro'` (gera cash_movement de entrada) dentro de `finalizeSale`.
- **Imutabilidade (RN10):** sem update/delete de contas/movimentações; correção por novo lançamento.

## Related Features

| Feature | Relação | Nota |
|---|---|---|
| 0002F — Venda rápida | Estende / integra | Forma `fiado`, `customer_id`, entrada de caixa em vendas à vista |
| 0003F — Estoque | Compartilha padrão | `cash_movements` espelha o ledger assinado de `stock_movements` |
| Lucro/fechamento (#6, Fase 2) | Será consumida por | Usa caixa + contas + margem para o fechamento e o lucro real |

Refs: {{doc:0004F}}, {{doc:0002F}}, {{doc:PRODUCT}}.
