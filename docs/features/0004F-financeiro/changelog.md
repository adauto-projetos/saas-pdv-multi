---
id: 0005CHG
type: changelog
slug: financeiro
created: 2026-06-11
related: [0004F, 0002F, 0003F]
---

# Changelog: Financeiro — 0004F

## Summary

Entrega o **controle financeiro** do SAAS PDV.multi em 3 frentes integradas: **Caixa** (dinheiro físico entrando/saindo, com saldo corrente e extrato), **Contas a Receber / Fiado** (cadastro de cliente, dívidas de venda `fiado` ou avulsas, com pagamentos parciais e status derivado) e **Contas a Pagar** (despesas com categoria, vencimento e pagamentos parciais). A venda (0002F) ganhou a forma de pagamento `fiado` (gera conta a receber e exige cliente) e passou a lançar automaticamente uma **entrada no caixa** quando paga em dinheiro (retrofit). Dinheiro em centavos, multi-tenant com RLS, pagamentos atômicos. Recurso #5 do roadmap (Fase 2 — Controlar).

## What Changed

### Database
- 6 tabelas novas: `customers`, `receivables`, `receivable_payments`, `payables`, `payable_payments`, `cash_movements` (ledger assinado — entrada +, saída −, CHECK de sinal; FKs de origem `sale_id`/`receivable_payment_id`/`payable_payment_id`). Todas com `tenant_id` para RLS e dinheiro em `integer` (centavos).
- **Retrofit** `sales`: coluna `customer_id` (nullable FK) + CHECK `payment_method` ampliado para incluir `'fiado'`.
- RLS (`0004_financeiro_rls.sql`): policy `tenant_isolation` nas 6 tabelas novas. Índices por `tenant_id` + data/status (RNF01).

### Backend
- Data layer + serviços transacionais (`lib/services/finance/`): `cash`, `customer`, `receivable`, `payable` (+ `derive.ts` para status/vencido). Pagamento parcial/total numa única `withUserRls` tx: checa saldo (RN03) antes de qualquer insert, grava o pagamento e — só se `dinheiro` — lança a movimentação de caixa e o back-link (RNF02/RN08).
- **Retrofit** `finalizeSale` (0002F): na mesma tx, `fiado` gera receivable (origem venda, exige `customer_id`) e `dinheiro` gera entrada de caixa; `pix`/`cartão` não tocam o caixa.
- 13 Server Actions (`app/(app)/financeiro/{caixa,customers,receber,pagar}/actions.ts`); schemas Zod (`lib/validation/finance.ts`); tipos (`types/finance.ts`).

### Frontend
- 4 telas em `/financeiro/*`: **caixa** (saldo + suprimento/sangria + extrato filtrável), **clientes** (cadastro + total em aberto), **receber** e **pagar** (listas filtráveis, vencidas destacadas, dialog de pagamento parcial compartilhado).
- 13 componentes (`components/financeiro/`) + wrappers `ReceberView`/`PagarView` que sincronizam lista após criar/pagar; link "Financeiro" no header.
- **Retrofit** checkout (`components/caixa/`): forma `fiado` na grade de pagamento exige um cliente (`CustomerPicker`) antes de finalizar (RN07).

## Requirements Delivered

- **RF01–RF14:** entrada/saída manual e saldo/extrato do caixa, venda em dinheiro → caixa, cadastro de cliente, venda fiado → conta a receber, conta a receber avulsa, recebimento parcial, total em aberto por cliente, conta a pagar com categoria/vencimento, pagamento parcial, listas filtráveis, destaque de vencidas.
- **RN01–RN10 + RNF01–RNF02:** isolamento por tenant (RLS), centavos não-negativos, pagamento ≤ saldo, status derivado, saldo = Σ movimentações, atribuição ao usuário/tenant da sessão, fiado exige cliente, só dinheiro movimenta o caixa, cliente do tenant com nome obrigatório, registros imutáveis (correção por novo lançamento), índices de performance, atomicidade financeira em tx única.

## Tests

144 testes verdes (Vitest) — inclui integração/RLS contra o Postgres local (isolamento entre tenants, atomicidade de pagamento, CHECK de sinal) e a regressão da venda com o retrofit fiado/dinheiro. Gates: typecheck 0, lint 0, build 0.

## Notes & Decisions

- **Status derivado na leitura** (`aberto`/`parcial`/`quitado`) de `total − Σ pagamentos`, sem coluna em cache — pagamentos são imutáveis (RN10), então o saldo nunca dessincroniza.
- **Caixa como ledger assinado** espelha `stock_movements` (0003F): saldo = `SUM(amount_cents)`, auditável.
- **Rota `/financeiro/*`** separada do checkout (`/caixa` é o PDV da 0002F) para evitar colisão.
- Correções da review: bug do status para conta de 0 centavos; `getCustomerOwedTotal` lança `NotFoundError` (evita sondagem de UUID entre tenants); `router.refresh()` após pagamento (saldo do caixa não ficava stale); acessibilidade de labels.
- Constraint `payment_method` no banco estava desatualizada (push não recria CHECK) — recriada para aceitar `fiado`.

## Quick Ref

```json
{"id":"0004F","domain":"PDV / financeiro (cash, receivables, payables)","touched":["db/schema/","db/migrations/","lib/services/finance/","lib/services/sales/","lib/validation/","app/(app)/financeiro/","components/financeiro/","components/caixa/","types/"],"patterns":["server-actions","rls-multitenancy","transactional-service","signed-ledger","derived-status","retrofit-integration"],"keywords":["financeiro","caixa","fiado","contas-a-receber","contas-a-pagar","cliente","pagamento-parcial","vencimento"]}
```
