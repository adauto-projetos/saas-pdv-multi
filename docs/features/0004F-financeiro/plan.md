---
id: 0004F
type: feature-plan
slug: financeiro
status: draft
created: 2026-06-11
updated: 2026-06-11
related: [0004F, 0002F, 0003F]
---

## TL;DR

Plano técnico do controle financeiro ({{doc:0004F}}): 6 tabelas novas (`customers`, `receivables`, `receivable_payments`, `payables`, `payable_payments`, `cash_movements`) + retrofit da venda (`fiado` + `customer_id` + entrada de caixa). Três frentes — Caixa, Contas a Receber/Fiado, Contas a Pagar — sobre o stack atual (Next 16 Server Actions → `lib/services/finance/*` → Drizzle via `withUserRls`). Decisão-chave: **status derivado na leitura** (não armazenado) e **pagamento atômico** (payment + status + movimento de caixa numa única transação). Tudo multi-tenant com RLS, dinheiro em centavos. Maior feature até aqui; não-epic por decisão do founder.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Test Specification](#test-specification)
- [Database](#database)
- [Backend](#backend)
- [Frontend](#frontend)
- [Consolidation Notes (gaps filled)](#consolidation-notes-gaps-filled)
- [Risks](#risks)
- [Validation](#validation)
- [Requirements Coverage](#requirements-coverage)
- [Quick Reference](#quick-reference)

## Context

A venda ({{doc:0002F}}) registra faturamento, mas não há controle de dinheiro nem de dívidas. Este plano adiciona, sobre a fundação madura (0001F produtos, 0002F venda, 0003F estoque), a camada financeira: cadastro de clientes, contas a receber (fiado de venda + avulsas), contas a pagar com categoria/vencimento, e um caixa físico como ledger assinado. Reaproveita dinheiro-em-centavos, `withUserRls`, data layer por área, `ActionResult` e Base UI; integra a venda via retrofit (`fiado` gera receivable e exige cliente; `dinheiro` gera entrada de caixa).

## Architecture Decisions

| decision | rationale | alternatives rejected | triggering constraint |
|---|---|---|---|
| Status (`aberto`/`parcial`/`quitado`) **derivado na leitura** | Pagamentos são imutáveis (RN10); derivar de `total − Σ pagamentos` nunca diverge de uma coluna em cache | Coluna `status` mutável — pode dessincronizar se um insert direto burlar o serviço | RN04 + RN10 (imutabilidade) |
| `cash_movements` como **ledger assinado** (entrada +, saída −, saldo = Σ) | Espelha `stock_movements` (0003F) já validado; auditável por `SUM` | Tabela com coluna de saldo corrente — exige update a cada lançamento, quebra imutabilidade | RN05 + RN08 |
| Pagamento numa **única `withUserRls` tx** (payment + status + cash_movement) | Sem dinheiro "perdido": ou grava tudo, ou nada | Gravar payment e depois o caixa em chamadas separadas — risco de meia-gravação | RNF02 (atomicidade) |
| Rota financeira em **`/financeiro/*`**, serviços em **`lib/services/finance/*`** | `app/(app)/caixa` já é a tela de checkout/PDV (0002F CashierScreen) — colisão de nome | Reusar `/caixa` — sobrescreveria o checkout | Convenção de placement (CLAUDE.md) |
| `customer_id` obrigatório no `fiado` validado **no serviço/zod**, não no banco | CHECK condicional cross-coluna no Postgres é possível mas complexo; o serviço já valida | NOT NULL incondicional — quebraria vendas não-fiado | RN07 |

## Main Flow

Recebimento de fiado (caminho crítico):
1. Operador → abre `/financeiro/receber`, escolhe uma conta a receber em aberto.
2. Operador → `PaymentDialog`: informa valor + método (`dinheiro`|`pix`|`cartao`).
3. `recordReceivablePaymentAction` → `requireAuthContext` → `safeParse` → `recordReceivablePayment` (service).
4. Service numa tx `withUserRls`: trava receivable → calcula saldo restante → rejeita se `amount > saldo` (RN03) → insere `receivable_payments` → se `dinheiro`: insere `cash_movements` (+entrada) e grava `cash_movement_id` (RN08) → retorna `ReceivableDto` com status recomputado (RN04).
5. Client → `toast` + `router.refresh()` recarrega a lista (saldo e status atualizados).

Venda fiado (retrofit): `CashierScreen` escolhe `fiado` → exige cliente (`CustomerPicker`, RN07) → `finalizeSale` na mesma tx insere venda+itens+baixa estoque → `recordSaleReceivable` (origin='venda'). Venda `dinheiro` → `recordCashEntryFromSale` (+entrada).

## Implementation Order

Database → Backend → Frontend (depois testes por área seguem o TDD spec). Dentro do backend: `cash-service` e `customer-service` antes de `receivable`/`payable` (que dependem do caixa para a perna dinheiro); retrofit da venda por último (depende de receivable + cash prontos).

---

## Test Specification

> Vitest. Integração (`HAS_DB ? describe : describe.skip`) toca banco real via `withUserRls`; pulada sem `DATABASE_URL`. Validação (zod `safeParse`) roda sempre. RLS em `db/__tests__/`. Dinheiro em centavos (inteiro). Contratos: entra input → sai DTO/erro; nunca asserta implementação interna.

### Contract Tests (from RFs/RNs)

| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| cash-RF01-inflow | Entrada manual gera movimento | backend | RF01 | registerCashMovement(ctx,{amountCents:5000,description:"suprimento"}) | CashMovementDto type='entrada', origin='manual' | amountCents=+5000, type='entrada', origin='manual' |
| cash-RF02-outflow | Saída manual gera movimento | backend | RF02 | registerCashMovement(ctx,{amountCents:3000,type:saida,description:"sangria"}) | CashMovementDto type='saida' | amountCents=-3000 (sinal), type='saida' |
| cash-RF03-balance | Saldo corrente exposto | backend | RF03 | getCashBalance(ctx) após +5000 e -3000 | CashBalanceDto | balanceCents=2000 |
| cash-RF04-statement | Extrato filtrável por período | backend | RF04 | listCashMovements(ctx,{from,to}) | CashMovementDto[] desc por createdAt | todos createdAt dentro de [from,to], ordem desc |
| cash-RF04-empty | Extrato vazio fora do período | backend | RF04 | listCashMovements(ctx,{from:futuro}) | [] | length=0 |
| cash-RF05-sale-cash | Venda dinheiro gera entrada caixa | backend | RF05/RN08 | finalizeSale(ctx,{...,paymentMethod:'dinheiro'}) | cash_movement origin='venda', sale_id setado | entrada com amountCents=+total, saleId=sale.id |
| cash-RN05-sum | Saldo = Σ entradas − Σ saídas | backend | RN05 | série de movimentos conhecidos | CashBalanceDto | balanceCents = Σ(amountCents) |
| cash-RN08-pix-no-cash | Venda pix não toca caixa | backend | RN08 | finalizeSale(ctx,{...,paymentMethod:'pix'}) | nenhum cash_movement origin='venda' | saldo inalterado, 0 movimentos p/ saleId |
| cash-RN02-neg | Rejeita valor negativo/zero | backend | RN02 | registerCashMovement(ctx,{amountCents:-1}) | ValidationError | rejects ValidationError |
| cash-sign-check | CHECK sinal: entrada>0, saida<0 | database | RN02/RN05 | insert cash_movement type='entrada' amount<0 | erro de constraint | insert rejeitado pelo banco |
| cust-RF06-create | Cadastra cliente nome+telefone | backend | RF06/RN09 | createCustomer(ctx,{name:"João",phone:"119..."}) | CustomerDto | id setado, name="João", phone preserv. |
| cust-RN09-name-req | Rejeita cliente sem nome | backend | RN09 | createCustomerSchema.safeParse({name:""}) | success=false | safeParse rejeita |
| cust-RF06-list-search | Lista/busca clientes por nome | backend | RF06 | listCustomers(ctx,{search:"Jo"}) | CustomerDto[] | só clientes do tenant cujo name casa "Jo" |
| recv-RF07-fiado-sale | Venda fiado gera conta a receber | backend | RF07 | finalizeSale(ctx,{...,paymentMethod:'fiado',customerId}) | receivable origin='venda', sale_id | totalCents=sale.total, customerId, origin='venda' |
| recv-RN07-fiado-nocust | Fiado sem cliente não finaliza | backend | RN07 | finalizeSaleSchema.safeParse({paymentMethod:'fiado'}) sem customerId | success=false | refine rejeita |
| recv-RN07-fiado-nocash | Venda fiado não entra no caixa | backend | RN08 | finalizeSale fiado | 0 cash_movements p/ saleId | saldo inalterado |
| recv-RF08-avulsa | Conta a receber avulsa | backend | RF08 | createReceivable(ctx,{customerId,totalCents:10000,dueDate}) | ReceivableDto origin='avulsa' | totalCents=10000, paidCents=0, status='aberto' |
| recv-RF09-partial | Recebimento parcial baixa saldo | backend | RF09/RN04 | recordReceivablePayment(ctx,{accountId,amountCents:4000,method:'dinheiro'}) sobre total 10000 | ReceivableDto | paidCents=4000, remainingCents=6000, status='parcial' |
| recv-RF09-full | Recebimento total quita | backend | RF09/RN04 | pagamento restante = remainingCents | ReceivableDto | remainingCents=0, status='quitado' |
| recv-RF09-cash | Recebimento dinheiro entra no caixa | backend | RF09/RN08 | recordReceivablePayment(method:'dinheiro',amount:4000) | cash_movement entrada origin='recebimento' | saldo +4000, payment.cashMovementId setado |
| recv-RF09-pix-nocash | Recebimento pix não toca caixa | backend | RF09/RN08 | recordReceivablePayment(method:'pix') | nenhum cash_movement | saldo inalterado, cashMovementId null |
| recv-RN03-over | Recebimento > saldo é rejeitado | backend | RN03 | recordReceivablePayment(amount:99999) sobre saldo 6000 | ValidationError | rejects, nenhum payment inserido |
| recv-RN03-exact | Recebimento = saldo é aceito | backend | RN03 | recordReceivablePayment(amount=remainingCents) | ReceivableDto status='quitado' | aceita, remainingCents=0 |
| recv-RF10-owed-total | Total em aberto por cliente | backend | RF10 | getCustomerOwedTotal(ctx,customerId) com 2 contas abertas | CustomerOwedDto | totalOwedCents = Σ remainingCents abertas/parciais |
| recv-RF10-list-filter | Lista filtrada por status/cliente | backend | RF10 | listReceivables(ctx,{status:'aberto',customerId}) | ReceivableDto[] | só contas do cliente com status='aberto' |
| recv-RN04-derive | Status derivado do saldo | backend | RN04 | listReceivables sobre conta sem/parcial/total pagto | ReceivableDto[] | status ∈ aberto(0)/parcial(<total)/quitado(=total) |
| pay-RF11-create | Conta a pagar com categoria/venc | backend | RF11 | createPayable(ctx,{description,totalCents:8000,category:"luz",dueDate}) | PayableDto | category="luz", status='aberto', paidCents=0 |
| pay-RF11-cat-req | Rejeita conta a pagar sem categoria | backend | RF11/RN02 | createPayableSchema.safeParse({category:""}) | success=false | safeParse rejeita |
| pay-RF12-partial | Pagamento parcial baixa saldo | backend | RF12/RN04 | recordPayablePayment(ctx,{accountId,amount:3000,method:'dinheiro'}) sobre 8000 | PayableDto | paidCents=3000, remaining=5000, status='parcial' |
| pay-RF12-cash-out | Pagamento dinheiro sai do caixa | backend | RF12/RN08 | recordPayablePayment(method:'dinheiro',amount:3000) | cash_movement saida origin='pagamento' | saldo −3000, amountCents negativo |
| pay-RF12-cartao-nocash | Pagamento cartão não toca caixa | backend | RF12/RN08 | recordPayablePayment(method:'cartao') | nenhum cash_movement | saldo inalterado |
| pay-RN03-over | Pagamento > saldo é rejeitado | backend | RN03 | recordPayablePayment(amount:99999) sobre 5000 | ValidationError | rejects, nada inserido |
| pay-RF13-list-filter | Lista filtrada status/categoria | backend | RF13 | listPayables(ctx,{status:'parcial',category:"luz"}) | PayableDto[] | só contas categoria='luz' status='parcial' |
| trans-RF14-recv-overdue | Receber vencida é destacada | backend | RF14 | listReceivables com dueDate<hoje e saldo>0 | ReceivableDto overdue=true | overdue=true p/ aberta vencida |
| trans-RF14-recv-paid | Quitada não é vencida | backend | RF14 | listReceivables conta quitada dueDate<hoje | ReceivableDto | overdue=false (saldo=0) |
| trans-RF14-pay-overdue | Pagar vencida é destacada | backend | RF14 | listPayables com dueDate<hoje saldo>0 | PayableDto overdue=true | overdue=true |
| atom-RNF02-recv-rollback | Pagto inválido não deixa resíduo | backend | RNF02/RN03 | recordReceivablePayment amount>saldo | ValidationError | 0 novos payments E 0 novos cash_movements (tudo revertido) |
| atom-RNF02-recv-allornothing | Pagto+caixa numa tx | backend | RNF02 | recordReceivablePayment(method:'dinheiro') OK | payment + cash_movement ambos persistidos | count payments+1 E cash_movements+1; cashMovementId vincula |
| atom-RNF02-pay-allornothing | Pagar: pagto+saída numa tx | backend | RNF02 | recordPayablePayment(method:'dinheiro') OK | payment + cash_movement saida | ambos persistidos, vinculados |
| immut-RN10-no-update-recv | Receivable não tem update/delete | backend | RN10 | service só expõe inserts | API sem updateReceivable/deleteReceivable | correção só por novo lançamento |
| immut-RN10-payment-final | Pagamento registrado é imutável | backend | RN10 | re-leitura após pagto | payment original inalterado | mesmo amount/method/createdAt |
| owner-RN06-session | Movimento usa tenant/usuário da sessão | backend | RN06 | registerCashMovement(ctx) | CashMovementDto | userId=ctx.userId, tenantId=ctx.tenantId (não do input) |
| rls-RN01-cash | Tenant A não vê caixa de B | database | RN01 | withUserRls(A) select cash_movements id de B | [] | length=0 |
| rls-RN01-recv | Tenant A não vê receivables de B | database | RN01 | withUserRls(A) select receivable de B | [] | length=0 |
| rls-RN01-cust | Tenant A não vê clientes de B | database | RN01 | withUserRls(A) select customer de B | [] | length=0 |
| rls-RN01-pay | Tenant A não vê payables de B | database | RN01 | withUserRls(A) select payable de B | [] | length=0 |
| val-RN02-cash | cashMovementSchema rejeita não-positivo | frontend | RN02 | safeParse({amountCents:0}) | success=false | rejeita |
| val-RN02-recv | createReceivableSchema rejeita total<0 | frontend | RN02 | safeParse({totalCents:-1}) | success=false | rejeita |
| val-RN02-payment | recordPaymentSchema exige amount>0 | frontend | RN02/RN03 | safeParse({amountCents:0,method}) | success=false | rejeita |
| val-method-enum | recordPaymentSchema valida method | frontend | RF09/RF12 | safeParse({method:'boleto'}) | success=false | só dinheiro/pix/cartao |
| val-fiado-refine | finalizeSaleSchema exige customer p/ fiado | frontend | RN07 | safeParse({paymentMethod:'fiado'}) sem customerId | success=false | refine rejeita |
| val-fiado-ok | finalizeSaleSchema aceita fiado+customer | frontend | RF07 | safeParse({paymentMethod:'fiado',customerId:uuid}) | success=true | aceita |

### Test File Mapping

| Area | Test File | Test IDs |
|------|-----------|----------|
| backend (cash) | `lib/services/finance/cash-service.test.ts` | cash-RF01-inflow, cash-RF02-outflow, cash-RF03-balance, cash-RF04-statement, cash-RF04-empty, cash-RN05-sum, cash-RN02-neg, owner-RN06-session |
| backend (sale retrofit→cash/recv) | `lib/services/sales/sale-service.test.ts` (estende) | cash-RF05-sale-cash, cash-RN08-pix-no-cash, recv-RF07-fiado-sale, recv-RN07-fiado-nocash |
| backend (customer) | `lib/services/finance/customer-service.test.ts` | cust-RF06-create, cust-RF06-list-search |
| backend (receivable) | `lib/services/finance/receivable-service.test.ts` | recv-RF08-avulsa, recv-RF09-partial, recv-RF09-full, recv-RF09-cash, recv-RF09-pix-nocash, recv-RN03-over, recv-RN03-exact, recv-RF10-owed-total, recv-RF10-list-filter, recv-RN04-derive, trans-RF14-recv-overdue, trans-RF14-recv-paid, atom-RNF02-recv-rollback, atom-RNF02-recv-allornothing, immut-RN10-no-update-recv, immut-RN10-payment-final |
| backend (payable) | `lib/services/finance/payable-service.test.ts` | pay-RF11-create, pay-RF12-partial, pay-RF12-cash-out, pay-RF12-cartao-nocash, pay-RN03-over, pay-RF13-list-filter, trans-RF14-pay-overdue, atom-RNF02-pay-allornothing |
| database (constraint) | `db/__tests__/cash-movements-constraints.test.ts` | cash-sign-check |
| database (RLS) | `db/__tests__/finance-rls.test.ts` | rls-RN01-cash, rls-RN01-recv, rls-RN01-cust, rls-RN01-pay |
| frontend (validation) | `lib/validation/finance.test.ts` | cust-RN09-name-req, pay-RF11-cat-req, val-RN02-cash, val-RN02-recv, val-RN02-payment, val-method-enum |
| frontend (sale validation) | `lib/validation/sale.test.ts` (estende) | val-fiado-refine, val-fiado-ok |

---

## Database

### Entities

| Entity | Table | Key Fields | Reference |
|--------|-------|------------|-----------|
| Cliente | `customers` | `tenant_id` (FK, NOT NULL), `name` text NOT NULL, `phone` text nullable, `created_at` | Similar: `db/schema/products.ts` |
| Conta a Receber | `receivables` | `tenant_id`, `customer_id` FK NOT NULL, `total_cents` int NOT NULL ≥ 0, `description` text, `due_date` date nullable, `origin` CHECK in('venda','avulsa'), `sale_id` uuid nullable FK → sales, `user_id` FK, `created_at` | Similar: `db/schema/sales.ts` |
| Pagamento de Recebível | `receivable_payments` | `tenant_id`, `receivable_id` FK NOT NULL, `amount_cents` int NOT NULL > 0, `method` CHECK in('dinheiro','pix','cartao'), `cash_movement_id` uuid nullable FK → cash_movements, `user_id` FK, `created_at` | Similar: `db/schema/stock-movements.ts` |
| Conta a Pagar | `payables` | `tenant_id`, `description` text NOT NULL, `total_cents` int NOT NULL ≥ 0, `due_date` date nullable, `category` text NOT NULL, `user_id` FK, `created_at` | Similar: `db/schema/sales.ts` |
| Pagamento de Contas a Pagar | `payable_payments` | `tenant_id`, `payable_id` FK NOT NULL, `amount_cents` int NOT NULL > 0, `method` CHECK in('dinheiro','pix','cartao'), `cash_movement_id` uuid nullable FK → cash_movements, `user_id` FK, `created_at` | Similar: `db/schema/stock-movements.ts` |
| Movimentação de Caixa | `cash_movements` | `tenant_id`, `amount_cents` int NOT NULL (entrada +, saída −), `type` CHECK in('entrada','saida'), `description` text, `origin` CHECK in('venda','recebimento','pagamento','manual'), `sale_id` / `receivable_payment_id` / `payable_payment_id` nullable FKs, `user_id` FK, `created_at` | Espelha: `db/schema/stock-movements.ts` (ledger assinado + CHECK de sinal) |

**Retrofit `sales`:** adicionar coluna `customer_id` uuid nullable FK → customers (`ON DELETE RESTRICT`) e ampliar o CHECK `sales_payment_method_valid` para incluir `'fiado'`.

**Status derivado (decisão):** `aberto` / `parcial` / `quitado` são calculados na consulta (`total_cents − Σ amount_cents dos payments`) — sem coluna armazenada. Como os pagamentos são imutáveis (RN10), o saldo nunca diverge por atualização esquecida.

**CHECK de sinal em `cash_movements`** (espelhando `stock_movements`): `(type = 'entrada' AND amount_cents > 0) OR (type = 'saida' AND amount_cents < 0)`.

### Migration

- **Novos arquivos schema:** `db/schema/customers.ts`, `receivables.ts`, `receivable-payments.ts`, `payables.ts`, `payable-payments.ts`, `cash-movements.ts`
- **Retrofit:** `db/schema/sales.ts` — coluna `customer_id` nullable FK + ampliar CHECK `payment_method` para `'fiado'`
- **`db:push`:** gerar snapshot Drizzle (mudanças acima)
- **Novo RLS:** `db/migrations/0004_financeiro_rls.sql` — GRANT + ENABLE RLS + `tenant_isolation` policy para as 6 tabelas; mesmo padrão de `db/migrations/0003_stock_rls.sql`. ⚠️ rodar `db:rls`/`db:setup` após qualquer `db:push`.
- **Indexes (RNF01):** `customers`(tenant_id),(tenant_id,name); `receivables`(tenant_id,customer_id),(tenant_id,due_date); `payables`(tenant_id,due_date),(tenant_id,category); `cash_movements`(tenant_id,created_at); `receivable_payments`/`payable_payments`(tenant_id,receivable_id)/(tenant_id,payable_id)
- Reference: `db/migrations/0003_stock_rls.sql`

### Repository

| Method | Purpose |
|--------|---------|
| `createCustomer` | Insere cliente (tenant da sessão, RN09) |
| `listCustomers` | Lista clientes do tenant, busca por nome |
| `createReceivable` | Cria conta a receber (origem venda ou avulsa) |
| `listReceivables` | Lista contas com saldo devedor calculado e filtro status/cliente |
| `getTotalOwedByCustomer` | Soma saldo devedor de TODAS as contas abertas/parciais de um cliente (RF10) |
| `recordReceivablePayment` | Insere payment + cash_movement (se dinheiro) na mesma tx `withUserRls` (RNF02) |
| `createPayable` | Cria conta a pagar |
| `listPayables` | Lista contas com saldo devedor calculado e filtro status/categoria |
| `recordPayablePayment` | Insere payment + cash_movement (se dinheiro) na mesma tx `withUserRls` (RNF02) |
| `createCashMovement` | Insere movimentação manual (suprimento/sangria) |
| `getCashBalance` | Retorna `SUM(amount_cents)` das cash_movements do tenant (RN05) |
| `listCashMovements` | Extrato por período (RF04), ordenado por `created_at` desc |

Reference: `lib/services/stock/data.ts`, `lib/services/sales/data.ts`, `lib/services/sales/sale-service.ts`

---

## Backend

> Stack: Server Actions → services (`lib/services/finance/`) → Drizzle, tudo via `withUserRls`. tenant da sessão (RN06), nunca do input. Cada action: `requireAuthContext` → `safeParse` → service → `revalidatePath` → `ActionResult` (`toActionError` no catch). Mesmo padrão de `app/(app)/caixa/actions.ts`.

### Server Actions (app/(app)/financeiro/*/actions.ts)
| Action | Type | Input (zod) | Returns | RF | Purpose |
|--------|------|-------------|---------|----|---------|
| registerCashInflowAction | ServerAction | cashMovementSchema | ActionResult<CashMovementDto> | RF01 | Entrada manual (suprimento/recebimento avulso) |
| registerCashOutflowAction | ServerAction | cashMovementSchema | ActionResult<CashMovementDto> | RF02 | Saída manual (sangria) |
| getCashBalanceAction | ServerAction | — | ActionResult<CashBalanceDto> | RF03/RN05 | Saldo corrente (Σ movimentações) |
| listCashMovementsAction | ServerAction | cashFilterSchema | ActionResult<CashMovementDto[]> | RF04 | Extrato filtrável por período |
| createCustomerAction | ServerAction | createCustomerSchema | ActionResult<CustomerDto> | RF06/RN09 | Cadastra cliente (nome obrig.) |
| listCustomersAction | ServerAction | customerQuerySchema | ActionResult<CustomerDto[]> | RF06/RF10 | Lista/busca clientes |
| createReceivableAction | ServerAction | createReceivableSchema | ActionResult<ReceivableDto> | RF08 | Conta a receber avulsa |
| listReceivablesAction | ServerAction | receivableQuerySchema | ActionResult<ReceivableDto[]> | RF10/RF14 | Lista c/ saldo+status+vencido, filtro |
| getCustomerOwedTotalAction | ServerAction | customerIdSchema | ActionResult<CustomerOwedDto> | RF10 | Total em aberto de TODAS as contas do cliente |
| recordReceivablePaymentAction | ServerAction | recordPaymentSchema | ActionResult<ReceivableDto> | RF09 | Recebimento parcial/total (+caixa se dinheiro) |
| createPayableAction | ServerAction | createPayableSchema | ActionResult<PayableDto> | RF11 | Conta a pagar (categoria, vencimento) |
| listPayablesAction | ServerAction | payableQuerySchema | ActionResult<PayableDto[]> | RF13/RF14 | Lista c/ saldo+status+vencido, filtro |
| recordPayablePaymentAction | ServerAction | recordPaymentSchema | ActionResult<PayableDto> | RF12 | Pagamento parcial/total (−caixa se dinheiro) |

### Service Functions (lib/services/finance/)
| Function | Tx? | Purpose / atomic steps |
|----------|-----|------------------------|
| registerCashMovement (cash-service) | yes | Insere `cash_movements` manual; sinal por type (RN08); origin='manual' |
| getCashBalance (cash-service) | yes | `SUM(amount_cents)` do tenant (RN05) |
| listCashMovements (cash-service) | yes | Extrato por período desc (RF04) |
| createCustomer / listCustomers (customer-service) | yes | CRUD cliente, busca por nome (RN09) |
| createReceivable (receivable-service) | yes | Insere receivable (origin='avulsa') |
| listReceivables / getCustomerOwedTotal (receivable-service) | yes | Lista c/ saldo derivado (total−Σpag), status RN04, flag vencido RF14; total por cliente RF10 |
| recordReceivablePayment (receivable-service) | **yes** | RNF02: 1) trava receivable, calcula saldo restante; reject se amount>saldo (RN03); 2) insere `receivable_payments`; 3) se method='dinheiro' (RN08) insere `cash_movements` (entrada +, origin='recebimento') e grava `cash_movement_id`; 4) retorna receivable c/ status recomputado (RN04) |
| createPayable / listPayables (payable-service) | yes | Cria/lista c/ saldo+status+vencido (RF11/13/14) |
| recordPayablePayment (payable-service) | **yes** | RNF02: igual a recordReceivablePayment, mas `cash_movements` saída (−, origin='pagamento') |
| recordSaleReceivable (receivable-service/data) | tx-bound | Chamado por finalizeSale: insere receivable origin='venda', sale_id (retrofit) |
| recordCashEntryFromSale (cash-service/data) | tx-bound | Chamado por finalizeSale: insere `cash_movements` entrada, origin='venda', sale_id |

> Imutabilidade (RN10): services só inserem; sem update/delete de contas/movimentações.

### Validation Schemas (lib/validation/finance.ts)
| Schema | Fields | Key validations |
|--------|--------|-----------------|
| cashMovementSchema | amountCents, description | int positivo (RN02); description obrig. |
| cashFilterSchema | from?, to? | datas ISO opcionais |
| createCustomerSchema | name, phone? | name min 1 (RN09); phone opcional |
| customerQuerySchema | search? | string trim opcional |
| createReceivableSchema | customerId, totalCents, description?, dueDate? | uuid; int≥0 (RN02); date opcional |
| receivableQuerySchema | status?, customerId? | enum aberto/parcial/quitado; uuid opcional |
| createPayableSchema | description, totalCents, category, dueDate? | description+category obrig.; int≥0 |
| payableQuerySchema | status?, category? | enum status; category opcional |
| recordPaymentSchema | accountId, amountCents, method | uuid; int positivo (RN02); method enum dinheiro/pix/cartao |
| customerIdSchema / accountIdSchema | id | uuid |

### DTOs / Types (types/finance.ts)
| Type | Fields | Notes |
|------|--------|-------|
| CustomerDto | id, name, phone, createdAt | |
| CustomerOwedDto | customerId, name, totalOwedCents | Σ saldo aberto/parcial (RF10) |
| CashMovementDto | id, amountCents, type, description, origin, saleId, receivablePaymentId, payablePaymentId, userId, createdAt | sinal assinado |
| CashBalanceDto | balanceCents | RN05 |
| AccountStatus | 'aberto'\|'parcial'\|'quitado' | derivado (RN04) |
| ReceivableDto | id, customerId, customerName, totalCents, paidCents, remainingCents, status, origin, saleId, dueDate, overdue, createdAt | saldo+status+vencido derivados; `customerName` p/ exibição (ver Consolidation Notes) |
| PayableDto | id, description, category, totalCents, paidCents, remainingCents, status, dueDate, overdue, createdAt | idem |
| PaymentDto | id, accountId, amountCents, method, cashMovementId, createdAt | |

### Sales Retrofit (lib/services/sales/sale-service.ts + lib/validation/sale.ts)
- `paymentMethodSchema`: adicionar `'fiado'`. `finalizeSaleSchema`: adicionar `customerId: z.uuid().optional()`; refine — se `paymentMethod==='fiado'` então `customerId` obrigatório (RN07).
- `finalizeSale`: na MESMA tx, após inserir venda+itens+baixa de estoque — se `'fiado'`: `recordSaleReceivable` (receivable origin='venda', total=totalCents, sale_id, customerId); se `'dinheiro'`: `recordCashEntryFromSale` (cash entrada, origin='venda', sale_id) (RF05/RF07). pix/cartão: nada (RN08). `insertSale` passa a gravar `customer_id`. `SaleDto` ganha `customerId`.

### Module Structure
```
lib/services/finance/
  cash-service.ts      cash-data.ts
  customer-service.ts  customer-data.ts
  receivable-service.ts  receivable-data.ts
  payable-service.ts   payable-data.ts
  *.test.ts (RNF02 atomicidade, RN03/04/08 — banco real)
lib/validation/finance.ts
types/finance.ts
app/(app)/financeiro/
  caixa/actions.ts  customers/actions.ts
  receber/actions.ts  pagar/actions.ts
```

Reference: `lib/services/sales/sale-service.ts`, `lib/services/stock/{stock-service,data}.ts`, `lib/services/errors.ts`, `db/rls.ts`, `app/(app)/caixa/actions.ts`, `lib/validation/sale.ts`

---

## Frontend

> Stack: RSC + Server Actions (sem TanStack/Zustand). Páginas server (`force-dynamic`) chamam list actions e renderizam lista + dialog; mutações chamam a action direto no client, `toast` (sonner) + `router.refresh()`. Listas filtráveis = client com `useEffect` chamando a list action (espelha `MovementHistory`). Dinheiro via `MoneyInput`; cliente via combobox de busca (espelha `ProductSearch`). Vencidas destacadas com `Badge` destrutivo. Centavos formatados com `centsToBRL`.

### Pages
| Route | Page Component | Purpose |
|-------|----------------|---------|
| /financeiro/caixa | CaixaPage | Saldo corrente + dialogs suprimento/sangria + extrato filtrável |
| /financeiro/clientes | ClientesPage | Cadastro de cliente + lista com total em aberto |
| /financeiro/receber | ReceberPage | Lista contas a receber (filtro status/cliente) + avulsa + recebimento |
| /financeiro/pagar | PagarPage | Lista contas a pagar (filtro status/categoria) + nova + pagamento |

### Components
{"CashBalanceCard":{"location":"components/financeiro/","purpose":"Card do saldo corrente (RF03)"}}
{"CashMovementDialog":{"location":"components/financeiro/","purpose":"Suprimento/sangria: valor+descrição, tipo (RF01/RF02)"}}
{"CashStatement":{"location":"components/financeiro/","purpose":"Extrato filtrável por período, tabela assinada (RF04)"}}
{"CustomerForm":{"location":"components/financeiro/","purpose":"Cadastra cliente nome+telefone (RF06)"}}
{"CustomerList":{"location":"components/financeiro/","purpose":"Lista clientes + total em aberto por cliente (RF10)"}}
{"CustomerPicker":{"location":"components/financeiro/","purpose":"Combobox de busca de cliente (RF07/RF08)"}}
{"ReceivableList":{"location":"components/financeiro/","purpose":"Lista filtrável status/cliente, vencidas destacadas (RF10/RF14)"}}
{"NewReceivableForm":{"location":"components/financeiro/","purpose":"Conta a receber avulsa: cliente, valor, desc, venc (RF08)"}}
{"PayableList":{"location":"components/financeiro/","purpose":"Lista filtrável status/categoria, vencidas destacadas (RF13/RF14)"}}
{"NewPayableForm":{"location":"components/financeiro/","purpose":"Conta a pagar: desc, valor, categoria, venc (RF11)"}}
{"PaymentDialog":{"location":"components/financeiro/","purpose":"Recebimento/pagamento parcial: valor+método; reusada p/ ambos (RF09/RF12)"}}

### Data & Mutations (mirror existing RSC + Server Action pattern — NO TanStack/Zustand)
{"lists":"Page server component chama a list action e passa data ao componente de lista — espelha app/(app)/estoque/page.tsx (listLowStockAction). Listas com filtro vivem em client component com useState+useEffect chamando a list action a cada mudança de filtro — espelha components/estoque/MovementHistory.tsx","mutations":"Client component chama a server action direto (createCashInflow/Outflow, createCustomer, createReceivable, recordReceivablePayment, createPayable, recordPayablePayment), toast de sucesso/erro e router.refresh() para recarregar a RSC — espelha components/estoque/StockMovementDialog.tsx","balance":"getCashBalanceAction no server component da CaixaPage"}

### Types (mirror from backend DTOs)
{"CustomerDto":{"fields":"id,name,phone,createdAt","sourceDTO":"CustomerDto"}}
{"CustomerOwedDto":{"fields":"customerId,name,totalOwedCents","sourceDTO":"CustomerOwedDto"}}
{"CashMovementDto":{"fields":"id,amountCents,type,description,origin,saleId,receivablePaymentId,payablePaymentId,userId,createdAt","sourceDTO":"CashMovementDto"}}
{"CashBalanceDto":{"fields":"balanceCents","sourceDTO":"CashBalanceDto"}}
{"AccountStatus":{"fields":"'aberto'|'parcial'|'quitado'","sourceDTO":"AccountStatus"}}
{"ReceivableDto":{"fields":"id,customerId,customerName,totalCents,paidCents,remainingCents,status,origin,saleId,dueDate,overdue,createdAt","sourceDTO":"ReceivableDto"}}
{"PayableDto":{"fields":"id,description,category,totalCents,paidCents,remainingCents,status,dueDate,overdue,createdAt","sourceDTO":"PayableDto"}}
{"PaymentMethod":{"fields":"'dinheiro'|'pix'|'cartao' (reusa de types/sale via validation)","sourceDTO":"recordPaymentSchema.method"}}

> Local: `types/finance.ts` (espelha plan-backend `types/finance.ts`). Datas como string (JSON); enums como union (sem import do backend).

### Checkout Retrofit
- CashierScreen/PaymentDialog (caixa): adicionar método `'fiado'` à grade de formas; ao escolher `fiado`, exigir um cliente via CustomerPicker (botão confirmar bloqueado sem cliente — RF07/RN07).
- `handleConfirm` passa a aceitar e enviar `customerId` no payload de `finalizeSaleAction` quando `method==='fiado'`; demais métodos inalterados (dinheiro vira entrada de caixa no backend, sem mudança de UI).
- `PaymentMethod` (types/sale.ts) já reflete o schema; ganha `'fiado'` ao backend estender `paymentMethodSchema`.

### Nav
- Adicionar entrada "Financeiro" em app/(app)/layout.tsx apontando para /financeiro/caixa (sub-rotas caixa/clientes/receber/pagar).

Reference: `app/(app)/estoque/page.tsx`, `components/estoque/{MovementHistory,StockMovementDialog,LowStockList}.tsx`, `components/caixa/{CashierScreen,PaymentDialog,ProductSearch}.tsx`, `components/ui/MoneyInput.tsx`, `app/(app)/caixa/actions.ts`, `app/(app)/layout.tsx`, `lib/format/money.ts`, `types/sale.ts`

---

## Consolidation Notes (gaps filled)

- **`ReceivableDto.customerName`** adicionado (DB + Backend DTOs + Frontend types): a `ReceivableList` exibe a quem pertence cada conta; sem isso a UI precisaria de um segundo `listCustomers` para mapear nome — `listReceivables` faz o join e devolve `customerName`. (Frontend tinha sinalizado a lacuna.)
- **`recordPaymentSchema` é compartilhado** por receber e pagar (campo genérico `accountId`); a action decide o serviço correto. O `PaymentDialog` é único e recebe o tipo de conta como prop. Contratos de backend e frontend já alinhados.
- **`PaymentMethod`** (`dinheiro|pix|cartao`) é o mesmo enum em pagamentos de conta e formas de venda; `'fiado'` é forma de venda mas **não** é método de pagamento de conta (não aparece em `recordPaymentSchema`).

## Risks

| risk | prob | impact | mitigation |
|---|---|---|---|
| `db:push` derruba RLS das 6 tabelas novas | alta | vazamento entre tenants | Rodar `npm run db:setup`/`db:rls` sempre; testes `db/__tests__/finance-rls.test.ts` falham se a policy sumir |
| Retrofit da venda quebra fluxo 0002F existente | média | checkout para de finalizar | Testes estendem `sale-service.test.ts`; pix/cartão devem permanecer inalterados (asserts de "0 cash_movements") |
| Pagamento não-atômico deixa dinheiro órfão | média | divergência saldo×Σ (métrica = 0) | Tudo numa `withUserRls` tx; `atom-RNF02-*` asserta rollback total e vínculo `cashMovementId` |
| Status derivado fica lento em lista grande | baixa | extrato/lista acima de ~100ms (RNF01) | Indexes `(tenant_id, receivable_id)`/`(tenant_id, payable_id)` para o `SUM`; volume MVP é baixo |

## Validation

- `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` — todos exit 0 (gates de CLAUDE.md).
- Banco no ar (`docker compose up -d` → `npm run db:setup`): testes de integração + RLS rodam de verdade (não pulados).
- Métricas de auditoria (about.md Success Metrics) com divergência 0: saldo do caixa vs Σ `cash_movements`; saldo devedor vs (total − Σ pagamentos); 100% das vendas `fiado` com `customer_id`.
- Checagem manual: finalizar venda `fiado` (exige cliente) gera receivable; venda `dinheiro` gera entrada de caixa; recebimento parcial em dinheiro baixa saldo e soma no caixa; pagamento em pix não toca o caixa.

## Requirements Coverage

| ID | Requirement | Covered? | Area | Tasks |
|----|-------------|----------|------|-------|
| RF01 | Entrada manual no caixa (suprimento) | YES | Backend + Frontend | cash-service, registerCashInflowAction, CashMovementDialog |
| RF02 | Saída manual do caixa (sangria) | YES | Backend + Frontend | registerCashOutflowAction, CashMovementDialog |
| RF03 | Saldo corrente do caixa | YES | Backend + Frontend | getCashBalance, CashBalanceCard |
| RF04 | Extrato filtrável do caixa | YES | Backend + Frontend | listCashMovements, CashStatement |
| RF05 | Venda dinheiro gera entrada de caixa | YES | DB + Backend | retrofit finalizeSale, recordCashEntryFromSale |
| RF06 | Cadastra cliente | YES | DB + Backend + Frontend | customers, createCustomer, CustomerForm |
| RF07 | Venda fiado gera conta a receber + exige cliente | YES | DB + Backend + Frontend | retrofit sales, recordSaleReceivable, CustomerPicker |
| RF08 | Conta a receber avulsa | YES | Backend + Frontend | createReceivable, NewReceivableForm |
| RF09 | Recebimento parcial/total | YES | Backend + Frontend | recordReceivablePayment, PaymentDialog |
| RF10 | Total em aberto por cliente + lista | YES | Backend + Frontend | getCustomerOwedTotal, listReceivables, CustomerList, ReceivableList |
| RF11 | Conta a pagar (categoria, vencimento) | YES | DB + Backend + Frontend | payables, createPayable, NewPayableForm |
| RF12 | Pagamento parcial/total de conta a pagar | YES | Backend + Frontend | recordPayablePayment, PaymentDialog |
| RF13 | Lista de contas a pagar (filtro) | YES | Backend + Frontend | listPayables, PayableList |
| RF14 | Vencimento e destaque de vencidas | YES | Backend + Frontend | overdue flag, Badge destrutivo |
| RN01 | Isolamento por tenant (RLS) | YES | DB | 0004_financeiro_rls.sql, finance-rls.test.ts |
| RN02 | Valores em centavos, não negativos | YES | DB + Backend | CHECKs, zod schemas |
| RN03 | Pagamento ≤ saldo devedor | YES | Backend | recordReceivablePayment/recordPayablePayment guards |
| RN04 | Status derivado do saldo | YES | Backend | listReceivables/listPayables derivation |
| RN05 | Saldo do caixa = Σ movimentações | YES | DB + Backend | getCashBalance, signed ledger |
| RN06 | Atribuição ao usuário/tenant da sessão | YES | Backend | requireAuthContext em todas as actions |
| RN07 | Fiado exige cliente | YES | Backend + Frontend | finalizeSaleSchema refine, CustomerPicker |
| RN08 | Só dinheiro movimenta o caixa | YES | Backend | conditional cash_movement insert |
| RN09 | Cliente pertence ao tenant, nome obrigatório | YES | DB + Backend | customers RLS, createCustomerSchema |
| RN10 | Contas/movimentações/pagamentos imutáveis | YES | Backend | services só inserem (sem update/delete) |
| RNF01 | Listas/extrato rápidos (~100ms) | YES | DB | indexes por tenant + data/status |
| RNF02 | Atomicidade financeira (tx única) | YES | Backend | withUserRls tx em pagamentos e retrofit |

Coverage: 26/26 = 100%. Nenhuma exclusão.

## Quick Reference

| Pattern | Codebase search |
|---|---|
| Entity / schema | `db/schema/sales.ts`, `db/schema/stock-movements.ts` |
| RLS migration | `db/migrations/0003_stock_rls.sql`, `db/rls.ts` |
| Repository / data layer | `lib/services/stock/data.ts`, `lib/services/sales/data.ts` |
| Service transacional | `lib/services/sales/sale-service.ts` (finalizeSale) |
| Server Action | `app/(app)/caixa/actions.ts` |
| Validation (zod) | `lib/validation/sale.ts` |
| Page (RSC) | `app/(app)/estoque/page.tsx` |
| List + dialog + filter | `components/estoque/{MovementHistory,StockMovementDialog,LowStockList}.tsx` |
| Money format | `lib/format/money.ts` (centsToBRL), `components/ui/MoneyInput.tsx` |
