---
id: 0004F
type: feature-tasks
slug: financeiro
created: 2026-06-11
updated: 2026-06-11
related: [0004F]
---

# Tasks: 0004F Financeiro

## Metadata

| Field | Value |
|-------|-------|
| Complexity | COMPLEX |
| Total tasks | 24 |
| Services | test, database, backend, frontend |

## Requirements Coverage

- [x] RF01 — Entrada manual no caixa (suprimento)
- [x] RF02 — Saída manual do caixa (sangria)
- [x] RF03 — Saldo corrente do caixa
- [x] RF04 — Extrato filtrável do caixa por período
- [x] RF05 — Venda em dinheiro gera entrada de caixa
- [x] RF06 — Cadastra cliente (nome obrigatório, telefone opcional)
- [x] RF07 — Venda fiado gera conta a receber e exige cliente
- [x] RF08 — Conta a receber avulsa
- [x] RF09 — Recebimento parcial/total de conta a receber
- [x] RF10 — Total em aberto por cliente e lista de contas a receber
- [x] RF11 — Conta a pagar com categoria e vencimento
- [x] RF12 — Pagamento parcial/total de conta a pagar
- [x] RF13 — Lista de contas a pagar (filtro status/categoria)
- [x] RF14 — Vencimento e destaque de contas vencidas
- [x] RN01 — Isolamento por tenant (RLS)
- [x] RN02 — Valores em centavos, não negativos
- [x] RN03 — Pagamento não excede o saldo devedor
- [x] RN04 — Status derivado do saldo (aberto/parcial/quitado)
- [x] RN05 — Saldo do caixa = soma das movimentações
- [x] RN06 — Atribuição ao usuário/tenant da sessão
- [x] RN07 — Venda fiado exige cliente
- [x] RN08 — Só dinheiro movimenta o caixa
- [x] RN09 — Cliente pertence ao tenant, nome obrigatório
- [x] RN10 — Contas, movimentações e pagamentos imutáveis
- [x] RNF01 — Listas e extrato rápidos via índices por tenant
- [x] RNF02 — Atomicidade financeira (pagamento numa única transação)

## TDD

- [x] T-TEST-01 Contract tests caixa (entrada/saída/saldo/extrato/sessão) — `lib/services/finance/cash-service.test.ts`
- [x] T-TEST-02 Contract tests cliente (cadastro/busca/nome obrigatório) — `lib/services/finance/customer-service.test.ts`
- [x] T-TEST-03 Contract tests contas a receber (recebimento/saldo/status/atomicidade) — `lib/services/finance/receivable-service.test.ts`
- [x] T-TEST-04 Contract tests contas a pagar (pagamento/saldo/status/atomicidade) — `lib/services/finance/payable-service.test.ts`
- [x] T-TEST-05 Contract test CHECK de sinal em cash_movements — `db/__tests__/cash-movements-constraints.test.ts`
- [x] T-TEST-06 Contract tests RLS financeiro (4 tabelas isoladas por tenant) — `db/__tests__/finance-rls.test.ts`
- [x] T-TEST-07 Contract tests validação finance (zod centavos/método/nome/categoria) — `lib/validation/finance.test.ts`
- [x] T-TEST-08 Contract tests retrofit venda fiado/dinheiro (caixa/receivable) — `lib/services/sales/sale-service.test.ts`
- [x] T-TEST-09 Contract tests validação venda fiado (refine customerId) — `lib/validation/sale.test.ts`

## Execution

- [x] T01 Escrever testes de validação finance e venda
  - Service: test
  - Files: `lib/validation/finance.test.ts`, `lib/validation/sale.test.ts`
  - Deps: -
  - Verify: `npm test -- finance.test sale.test` (vermelho até schemas)
- [x] T02 Escrever testes de serviço de caixa e cliente
  - Service: test
  - Files: `lib/services/finance/cash-service.test.ts`, `lib/services/finance/customer-service.test.ts`
  - Deps: -
  - Verify: `npm test -- cash-service customer-service` (vermelho)
- [x] T03 Escrever testes de receivable e payable
  - Service: test
  - Files: `lib/services/finance/receivable-service.test.ts`, `lib/services/finance/payable-service.test.ts`
  - Deps: -
  - Verify: `npm test -- receivable-service payable-service` (vermelho)
- [x] T04 Escrever testes de constraint, RLS e retrofit venda
  - Service: test
  - Files: `db/__tests__/cash-movements-constraints.test.ts`, `db/__tests__/finance-rls.test.ts`
  - Deps: -
  - Verify: `npm test -- cash-movements-constraints finance-rls` (skip sem DB)
- [x] T05 Criar schema cash_movements e customers
  - Service: database
  - Files: `db/schema/cash-movements.ts`, `db/schema/customers.ts`
  - Deps: -
  - Verify: `npm run db:push` aplica sem erro
- [x] T06 Criar schema receivables e receivable_payments
  - Service: database
  - Files: `db/schema/receivables.ts`, `db/schema/receivable-payments.ts`
  - Deps: T05
  - Verify: `npm run db:push` aplica FKs sem erro
- [x] T07 Criar schema payables e payable_payments
  - Service: database
  - Files: `db/schema/payables.ts`, `db/schema/payable-payments.ts`
  - Deps: T05
  - Verify: `npm run db:push` aplica sem erro
- [x] T08 Retrofit sales: customer_id e CHECK fiado
  - Service: database
  - Files: `db/schema/sales.ts`
  - Deps: T05
  - Verify: `npm run db:push`; CHECK aceita 'fiado'
- [x] T09 Migration RLS e índices das 6 tabelas
  - Service: database
  - Files: `db/migrations/0004_financeiro_rls.sql`
  - Deps: T05, T06, T07
  - Verify: `npm run db:rls`; `npm test -- finance-rls` verde
- [x] T10 Tipos e DTOs financeiros
  - Service: backend
  - Files: `types/finance.ts`
  - Deps: -
  - Verify: `npm run typecheck`
- [x] T11 Schemas de validação finance (zod)
  - Service: backend
  - Files: `lib/validation/finance.ts`
  - Deps: T10
  - Verify: `npm test -- finance.test` verde
- [x] T12 Retrofit validação venda: paymentMethod fiado + refine
  - Service: backend
  - Files: `lib/validation/sale.ts`
  - Deps: -
  - Verify: `npm test -- sale.test` verde
- [x] T13 Serviço de caixa (movimento/saldo/extrato)
  - Service: backend
  - Files: `lib/services/finance/cash-service.ts`, `lib/services/finance/cash-data.ts`
  - Deps: T05, T10, T11
  - Verify: `npm test -- cash-service` verde
- [x] T14 Serviço de cliente (cadastro/busca)
  - Service: backend
  - Files: `lib/services/finance/customer-service.ts`, `lib/services/finance/customer-data.ts`
  - Deps: T05, T10, T11
  - Verify: `npm test -- customer-service` verde
- [x] T15 Serviço de contas a receber (recebimento atômico)
  - Service: backend
  - Files: `lib/services/finance/receivable-service.ts`, `lib/services/finance/receivable-data.ts`
  - Deps: T06, T13
  - Verify: `npm test -- receivable-service` verde
- [x] T16 Serviço de contas a pagar (pagamento atômico)
  - Service: backend
  - Files: `lib/services/finance/payable-service.ts`, `lib/services/finance/payable-data.ts`
  - Deps: T07, T13
  - Verify: `npm test -- payable-service` verde
- [x] T17 Retrofit finalizeSale: fiado→receivable, dinheiro→caixa
  - Service: backend
  - Files: `lib/services/sales/sale-service.ts`
  - Deps: T13, T15
  - Verify: `npm test -- sale-service` verde
- [x] T18 Server actions caixa e clientes
  - Service: backend
  - Files: `app/(app)/financeiro/caixa/actions.ts`, `app/(app)/financeiro/customers/actions.ts`
  - Deps: T13, T14
  - Verify: `npm run typecheck`
- [x] T19 Server actions receber e pagar
  - Service: backend
  - Files: `app/(app)/financeiro/receber/actions.ts`, `app/(app)/financeiro/pagar/actions.ts`
  - Deps: T15, T16
  - Verify: `npm run typecheck`
- [x] T20 Componentes de caixa (saldo, dialog, extrato)
  - Service: frontend
  - Files: `components/financeiro/CashBalanceCard.tsx`, `components/financeiro/CashMovementDialog.tsx`, `components/financeiro/CashStatement.tsx`
  - Deps: T18
  - Verify: `npm run build`
- [x] T21 Componentes de cliente e PaymentDialog compartilhado
  - Service: frontend
  - Files: `components/financeiro/CustomerForm.tsx`, `components/financeiro/CustomerList.tsx`, `components/financeiro/PaymentDialog.tsx`
  - Deps: T18, T19
  - Verify: `npm run build`
- [x] T22 Componentes de contas a receber e pagar
  - Service: frontend
  - Files: `components/financeiro/ReceivableList.tsx`, `components/financeiro/PayableList.tsx`, `components/financeiro/CustomerPicker.tsx`
  - Deps: T19
  - Verify: `npm run build`
- [x] T23 Páginas financeiras (caixa/clientes/receber/pagar) e nav
  - Service: frontend
  - Files: `app/(app)/financeiro/caixa/page.tsx`, `app/(app)/financeiro/receber/page.tsx`, `app/(app)/layout.tsx`
  - Deps: T20, T21, T22
  - Verify: `npm run build`; rotas renderizam
- [x] T24 Retrofit checkout: forma fiado exige cliente
  - Service: frontend
  - Files: `components/caixa/CashierScreen.tsx`, `components/caixa/PaymentDialog.tsx`
  - Deps: T17, T22
  - Verify: `npm run build`; confirmar bloqueado sem cliente no fiado

## Acceptance Checklist

- [x] `registerCashMovement` insere entrada manual com sinal positivo e origin='manual' (RF01)
- [x] Action `registerCashInflowAction` recebe `cashMovementSchema` e retorna `CashMovementDto` (RF01)
- [x] `registerCashMovement` saída insere amount negativo, type='saida' (RF02)
- [x] Action `registerCashOutflowAction` registra sangria (RF02)
- [x] `getCashBalance` retorna `CashBalanceDto` com `SUM(amount_cents)` do tenant (RF03)
- [x] `listCashMovements` retorna extrato filtrado por período, ordem desc por createdAt (RF04)
- [x] `finalizeSale` em dinheiro insere cash_movement origin='venda' com sale_id (RF05)
- [x] `createCustomer` insere cliente com name preservado, retorna `CustomerDto` (RF06)
- [x] `listCustomers` busca por nome só no tenant da sessão (RF06)
- [x] `finalizeSale` fiado insere receivable origin='venda' com sale_id e customerId (RF07)
- [x] `CustomerPicker` exigido na CashierScreen quando método='fiado' (RF07)
- [x] `createReceivable` cria conta avulsa com origin='avulsa', paidCents=0 (RF08)
- [x] `recordReceivablePayment` baixa saldo e recomputa status, retorna `ReceivableDto` (RF09)
- [x] `PaymentDialog` envia valor + método (dinheiro/pix/cartao) para recebimento (RF09)
- [x] `getCustomerOwedTotal` soma remaining de contas abertas/parciais do cliente (RF10)
- [x] `listReceivables` filtra por status/cliente e expõe `customerName` (RF10)
- [x] `createPayable` cria conta com category e dueDate, status='aberto' (RF11)
- [x] `recordPayablePayment` baixa saldo de conta a pagar, recomputa status (RF12)
- [x] `listPayables` filtra por status/categoria (RF13)
- [x] `ReceivableDto`/`PayableDto` expõem `overdue` true para conta vencida em aberto (RF14)
- [x] Migration `0004_financeiro_rls.sql` habilita RLS tenant_isolation nas 6 tabelas (RN01)
- [x] CHECK e zod rejeitam valores negativos/zero em centavos (RN02)
- [x] `recordReceivablePayment`/`recordPayablePayment` rejeitam amount > saldo restante (RN03)
- [x] `listReceivables`/`listPayables` derivam status de total − Σ pagamentos (RN04)
- [x] CHECK de sinal: entrada>0, saída<0 em cash_movements; saldo = Σ (RN05)
- [x] Services usam tenant/usuário de `requireAuthContext`, nunca do input (RN06)
- [x] `finalizeSaleSchema` refine rejeita fiado sem customerId (RN07)
- [x] Recebimento/pagamento pix/cartão não inserem cash_movement (RN08)
- [x] `customers` tem RLS por tenant; `createCustomerSchema` exige name min 1 (RN09)
- [x] Services financeiros só inserem — sem update/delete de contas/pagamentos (RN10)
- [x] Índices por tenant + data/status criados na migration (RNF01)
- [x] Pagamento + cash_movement gravados numa única `withUserRls` tx; rollback total no erro (RNF02)

## Validation Gates

- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
