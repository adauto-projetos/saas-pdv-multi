---
id: 0005PAST
type: past-features
slug: lucro-fechamento
created: 2026-06-11
---

# Past Features Analysis: Lucro e Fechamento de Caixa (0005F)

## TL;DR

0005F consumes data from 0001F (product cost/markup), 0002F (sales totals + items), and 0004F (cash movements + session structure). Extends 0004F with **cash session concept** (abertura/fechamento por turno). Reuses patterns: signed-ledger, RLS, derived-status, transactional-service, centavos.

---

## Matches

### 0001F — Produto + Markup (CONSUMES)
- **Domain:** Product data; cost and pricing
- **Relationship:** CONSUMES — reads `products.cost_cents` and `markup_percent` to calculate COGS and profit
- **Shared files touched:** `db/schema/` (products table: cost_cents, sale_price_cents)
- **Patterns reused:** RLS per tenant, centavos integer, multi-tenant isolation via `tenant_id`
- **Key decisions:** Cost and sale price are snapshots in `products` at product creation; both subject to future changes (out of 0001F scope) → 0005F must read snapshot from sale_items or reconstruct from product historical cost at sale time
- **Iterations:** 2 iterations (add + review fix); 34 tests green
- **Relevance:** Critical dependency. 0005F calculates profit = `sale_items.unit_price_cents - (product.cost_cents × quantity)` or uses historical cost. Architecture choice: snapshot cost at sale time (like price in 0002F) or look up current cost? **Action:** Confirm with 0002F retrofit pattern — likely cost snapshot in `sale_items` analogous to `unit_price_cents`.

### 0002F — Venda Rápida (Mercado) (CONSUMES)
- **Domain:** Sales, checkout, transactions
- **Relationship:** CONSUMES — reads `sales.total_cents`, `sale_items.*`, and `sales.payment_method` to route cash entry logic
- **Shared files touched:** `db/schema/sales.ts`, `db/migrations/`, `lib/services/sales/`, `lib/validation/sale.ts`
- **Patterns reused:** 
  - RLS isolation per tenant via `withUserRls`, `app_user` role
  - Transactional service: all-or-nothing semantics, atomic reads/writes
  - Server actions as interface between UI and backend
  - Centavos as integer (no float), CHECK constraints for non-negativity
  - Price snapshot: `sale_items.unit_price_cents` captures price at sale time (immutable after sale)
  - Retrofit integration: venda→saida (0003F), venda→fiado ou caixa (0004F)
- **Key decisions:** 
  - Price never trusts client; captured on server (snapshot, RN02)
  - Estoque baixa mesmo se negativo; aviso pertence a 0003F
  - Forma de pagamento é enum CHECK na DB: `'dinheiro'|'pix'|'cartao'|'fiado'` (0004F retrofit)
  - Venda atribuída ao usuário logado; sem edição pós-criação (audit trail)
- **Iterations:** 2 iterations (add + review); 78 tests (39 RLS/integration)
- **Relevance:** **High — direct data dependency.** 0005F must:
  - Read `sales.total_cents`, `sales.payment_method`, `sales.created_at`
  - Read `sale_items.quantity` and `unit_price_cents` to reconstruct line-item detail
  - Route cash entry only if `payment_method = 'dinheiro'`
  - Calculate COGS per line = `unit_price_cents - product.cost_cents` (need cost snapshot decision)
  - Aggregate by day for "lucro real do dia"
  - **Action:** Define whether cost is snapshot in `sale_items` (like price) or reconstructed from `products` historical cost. If snapshot, retrofit 0002F to include `cost_cents_snapshot`.

### 0003F — Estoque (SHARES-PATTERN)
- **Domain:** Inventory, stock movements, ledger
- **Relationship:** SHARES-PATTERN + optional CONSUMES — 
  - **Shares:** Signed-delta ledger pattern (`stock_movements` = 0003F, `cash_movements` = 0004F, profit log = 0005F)
  - **Optional consumes:** If 0005F needs cost valuation (R$ value of COGS), reads `stock_movements` + product cost to calculate cost of goods sold from purchase entry (deferred from 0003F, now in 0005F scope)
- **Shared files touched:** `db/schema/stock-movements.ts`, `lib/services/stock/stock-service.ts`, `lib/services/sales/sale-service.ts` (retrofit `recordSaleExit`)
- **Patterns reused:**
  - **Signed-delta ledger:** balance = SUM(delta), type-based sign enforcement (CHECK), immutable records, audit trail
  - RLS, centavos, multi-tenant isolation
  - Transactional service with `withUserRls`
  - Retrofit integration: venda 0002F → salida 0003F
  - Derived fields: current balance = SUM(movements)
  - Filtering by type + period
- **Key decisions:**
  - Movimento immutable; correção por novo lançamento (não edição)
  - Ajuste **seta** o estoque (não soma delta) para evitar float-arredondamento em `numeric(10,3)`
  - Saída referencia `sale_id` para rastreio
- **Iterations:** 2 iterations (add + review); 99 tests (inclui retrofit + RLS)
- **Relevance:** **Medium — pattern reuse, not data dependency.** 0005F adopts the same ledger pattern for cash sessions and profit calculations. 0003F's decision to avoid float drift (ajuste seta, não soma) informs 0005F's rounding strategy for centavos. Architecture validation: **cash session as ledger** (saldo = SUM(movimentações de caixa + lucro do turno))?

### 0004F — Financeiro (EXTENDS / CONSUMES)
- **Domain:** Finance, cash, receivables, payables
- **Relationship:** EXTENDS + CONSUMES —
  - **Consumes:** 0005F reads `cash_movements` (ledger), `receivables`/`payables` status to derive cash balance
  - **Extends:** 0005F adds **cash session structure** (abertura/fechamento per turno) explicitly deferred in 0004F scope ("Abertura/fechamento de caixa por turno fica para a feature #6")
- **Shared files touched:** `db/schema/cash-movements.ts`, `lib/services/finance/`, `db/migrations/0004_financeiro_rls.sql`, `app/(app)/financeiro/caixa/`
- **Patterns reused:**
  - Signed-ledger: `cash_movements` with type-based sign (`entrada +`, `saída −`), CHECK constraint, saldo = SUM(amount_cents)
  - RLS isolation per tenant
  - Derived status: account status = `aberto|parcial|quitado` from balance
  - Transactional service: payment + status update + cash entry in single `withUserRls` tx
  - Immutable records (audit trail); correction by compensating entry
  - Server actions, Zod schemas
  - Multi-tenant isolation, centavos integer
- **Key decisions:**
  - Cash balance = SUM(amount_cents) of `cash_movements`, no separate `balance` column (prevents sync drift)
  - Status derived at read time from `total − Σ pagamentos`, not cached
  - Só dinheiro movimenta caixa: venda dinheiro → entrada, fiado → receivable (sem caixa), pix/cartão → status update só
  - Pagamentos parciais na mesma tx (atomicidade financeira)
  - Imutabilidade: registros não se editam, correção por novo lançamento
- **Iterations:** 2 iterations (add + retrofit checkout + review); 144 tests (RLS, atomicidade, sign CHECK, retrofit fiado/dinheiro)
- **Relevance:** **Critical — direct dependency + architectural extension.** 0005F must:
  - Consume `cash_movements` to calculate saldo de caixa = SUM(amount_cents)
  - Implement **cash session** (new table `cash_sessions` or extension of `cash_movements` with session_id)
  - Track abertura (saldo_inicial), total de entradas, total de saídas, lucro do dia, saldo_esperado = saldo_inicial + entradas − saídas + lucro, divergência = saldo_real − saldo_esperado
  - **Action:** Define cash session schema — separate table or ledger annotation? Likely separate `cash_sessions` table with FK to `cash_movements` for session-scoped aggregation. Retrofit 0004F cash register screens if needed.

---

## No Match / Excluded
- (No features excluded; all 4 predecessors are direct or pattern dependencies)

---

## Reaproveitamento (Patterns & Conventions)

| Pattern / Convention | Origem | Uso em 0005F |
|---|---|---|
| **Signed-delta ledger** | 0003F (`stock_movements`) + 0004F (`cash_movements`) | `profit_ledger` table (lucro por venda) + `cash_sessions` table (saldo por turno); saldo = SUM(delta) |
| **RLS multitenancy** | 0001F, 0002F, 0003F, 0004F | All 0005F tables: `profit_ledger.tenant_id` FK, `cash_sessions.tenant_id` FK; isolate by `current_app_user()` GUC via `withUserRls` |
| **Centavos integer** | 0002F, 0003F, 0004F | Profit calc: `profit_cents = sale_items.unit_price_cents − (product.cost_cents × quantity)`, lucro_cents in ledger |
| **Transactional service** | 0002F, 0003F, 0004F | Services: `profit-service.ts` (calc lucro p/venda), `cash-session-service.ts` (abertura/conferência/fechamento); tudo numa tx `withUserRls` |
| **Immutable records** | 0003F, 0004F | Profit ledger e cash session são imutáveis; correção por novo lançamento (desempenho/auditoria) |
| **Derived fields (no cache)** | 0004F (status) | Lucro total dia = SUM(profit_ledger.profit_cents WHERE created_at BETWEEN hoje 00:00 AND 23:59); saldo sessão = SUM(cash_movements) filtrando por sessão |
| **Retrofit integration** | 0002F→0003F, 0002F→0004F, 0004F→0002F | Venda (0002F): no `finalizeSale`, além de gerar `saída` (0003F) e `fiado|caixa` (0004F), **também gera `profit_ledger` entry** (novo) |
| **Server actions + Zod** | 0002F, 0003F, 0004F | `app/(app)/lucro/actions.ts`: `getProfit`, `openCashSession`, `closeCashSession`, `recordCashCount` com schemas em `lib/validation/profit.ts` |
| **CHECK constraints** | 0002F, 0003F, 0004F | Ledger sign CHECK: `amount_cents != 0 OR type IN (...)`, profit_cents pode ser negativo (prejuízo) |
| **Filtering by type + period** | 0003F, 0004F | Lucro: por dia; cash session: por turno (date + shift_code ou timestamp range) |

---

## Lacunas / Novo

**Schema decisions:**
- [ ] **Cost snapshot:** Retrofit 0002F `sale_items` com `cost_cents_snapshot`? Ou reconstruir de `products.cost_cents` ao calcular lucro? (Escolha: provavelmente snapshot, como preço.)
- [ ] **Profit ledger table:** `profit_ledger(id, tenant_id, sale_id FK, profit_cents, created_at, user_id)` — gravar por venda ou só agregado por dia?
- [ ] **Cash session schema:** Nova tabela `cash_sessions(id, tenant_id, user_id, opened_at, closed_at, opening_balance_cents, expected_balance_cents, actual_count_cents, divergence_cents, notes, status)` com FK opcionais a `cash_movements` para escopo?

**Patterns novos:**
- **Cash session** (turno/abertura-fechamento): não existe em 0004F; 0005F cria. Similar a 0003F's `min_stock` (atributo derivado por produto), mas aqui é agregado por sessão/turno.
- **Convergência estoque/caixa:** Histórico de reconciliação (venda causou saída, saída causou lucro, lucro/prejuízo afeta caixa esperado)?

**Retrofit points:**
1. 0002F `finalizeSale`: adicionar `profit_ledger` insert após `recordSaleExit` + caixa (mesma tx)
2. 0004F cash tela: link ou widget de "Lucro do dia" + "Fechamento de caixa"

**API/UI:**
- GET `/api/lucro/dia` — lucro total do dia (agregado) + breakdown por forma de pagamento
- POST/GET `/api/caixa/sessao` — abertura/fechamento de turno, divergência
- UI `/lucro` — lucro real do dia, histórico por dia/semana
- UI `/caixa/fechamento` — abertura esperada, conferência de gaveta, divergência, notas (retrofit de `/financeiro/caixa`)

---

## Metadata

```json
{
  "updated": "2026-06-11",
  "feature": "0005F-lucro-fechamento",
  "matches": 4,
  "total_analyzed": 4,
  "by": "past-features-discovery"
}
```
