---
id: 0005DISC
type: discovery
slug: lucro-fechamento
created: 2026-06-11
updated: 2026-06-11
related_features: [0001F, 0002F, 0003F, 0004F]
---

# Discovery: Lucro e Fechamento de Caixa (0005F)

## Summary

```json
{
  "patterns": [
    "signed-delta ledger (profit_ledger + cash_sessions)",
    "RLS multi-tenancy via withUserRls",
    "transactional service pattern",
    "immutable records + audit trail",
    "derived aggregates (SUM, no cache)"
  ],
  "files_create": 7,
  "files_modify": 6,
  "deps": [
    "0001F (products.cost_cents)",
    "0002F (sales, sale_items, finalizeSale retrofit)",
    "0003F (signed-delta ledger pattern)",
    "0004F (cash_movements, withUserRls)"
  ],
  "complexity": "medium",
  "risks": [
    "Cost snapshot decision (retrofit 0002F sale_items or lookup products.cost_cents)",
    "Product without cost (cost_cents null) → profit calculation edge case",
    "Profit ledger insertion in finalizeSale transaction (3rd retrofit point)"
  ]
}
```

---

## Technical Context

### Relevant Stack
- **Backend:** Node 20 + TypeScript + Next.js 16 server actions/route handlers
- **Database:** PostgreSQL (Docker local) + Drizzle ORM + RLS (Row Level Security)
- **Patterns:** Transactional multi-tenancy, signed-ledger, immutable records
- **Money:** Integer centavos (no float); centsToBRL/brlToCents helpers in `lib/format/money.ts`

### Identified Patterns (Reuse from 0002F/0003F/0004F)

| Pattern | Origin | How to Apply | Location |
|---------|--------|-------------|----------|
| **Signed-delta ledger** | 0003F stock_movements, 0004F cash_movements | `profit_ledger` table: saldo = SUM(profit_cents) grouped by day; amount sign enforced by CHECK constraint | db/schema/ledger.ts (new) |
| **RLS isolation** | All | Every new table: `tenant_id` FK, `tenant_isolation` policy in migration, enforced via `withUserRls(userId, tx => ...)` | db/migrations/0005_lucro_rls.sql (new) |
| **Centavos integer** | 0002F, 0004F | All money fields: `integer` type, no float; calculations in cents before division | db/schema, services |
| **Transactional service** | 0002F finalizeSale, 0004F paymentService | Services return DTO; all DB writes inside `withUserRls` tx | lib/services/profit/ (new) |
| **Immutable records** | 0003F, 0004F | Records never edited; correction via compensating entry (sinal invertido) | Enforceable via `NOT NULL created_at`, no UPDATE triggers |
| **Derived fields (no cache)** | 0004F cash balance | Lucro dia = `SUM(profit_cents) WHERE created_at BETWEEN 00:00 AND 23:59 AND tenant_id = ?`; cash session = `SUM(cash_movements.amount_cents) WHERE session_id = ?` | Services use raw SQL aggregates |
| **Retrofit integration** | 0002F → 0003F, 0002F → 0004F | `finalizeSale` in sale-service.ts: after stock exit + cash entry, insert `profit_ledger` row | lib/services/sales/sale-service.ts (modify) |
| **Server actions + Zod** | 0002F, 0004F | Validation schemas in `lib/validation/`; server actions in `app/(app)/lucro/actions.ts` | lib/validation/profit.ts (new), app/(app)/lucro/actions.ts (new) |
| **CHECK constraints** | 0002F, 0004F | Enforce sign rules at DB level; profit_cents can be negative (prejuízo) | Schema, RLS migration |

---

## Codebase Analysis: Current State (Master after 0004F)

### Product Schema (`db/schema/products.ts`)
- ✅ `costCents` (integer, nullable) — set in 0001F
- ✅ `markupPercent` (numeric(5,2), nullable) — set in 0001F
- ✅ `salePriceCents` (integer, NOT NULL) — set in 0001F
- ⚠️ **Issue:** If `costCents` is NULL, profit calc must handle it (default to 0? exclude item? alert?)

### Sales Schema (`db/schema/sales.ts`)
- ✅ `totalCents` (integer) — sum of subtotals
- ✅ `paymentMethod` ('dinheiro'|'pix'|'cartao'|'fiado')
- ✅ `createdAt` (timestamp with TZ)
- ⚠️ **Gap:** No cost snapshot; profit calc must lookup `products.cost_cents` at report time OR retrofit with `sale_items.cost_cents_snapshot`

### Sale Items Schema (`db/schema/sale-items.ts`)
- ✅ `unitPriceCents` (integer) — snapshot at sale time
- ✅ `quantity` (numeric(10,3)) — fractional units
- ✅ `subtotalCents` (integer) — calculated on server
- ❌ **MISSING:** `cost_cents_snapshot` — required for profit ledger (decide: retrofit here or lookup products.cost_cents)

### Cash Movements Schema (`db/schema/cash-movements.ts`)
- ✅ `amountCents` (integer, signed: entrada > 0, saida < 0)
- ✅ `type` ('entrada'|'saida') with CHECK constraint on sign
- ✅ `origin` ('venda'|'recebimento'|'pagamento'|'manual')
- ✅ `createdAt` (timestamp with TZ)
- ✅ `userId` (FK) — who created the entry
- ⚠️ **Gap:** No `session_id` — needed to scope movements to a cash session (abertura/fechamento)

### Services: finalizeSale Retrofit Hook (`lib/services/sales/sale-service.ts`)
- ✅ Line 96–103: Already inserts cash entry for 'dinheiro' via `insertCashMovement`
- ✅ All wrapped in `withUserRls(ctx.userId, async tx => ...)`
- 🟡 **Ready for 3rd retrofit:** After cash entry, insert profit ledger row (same tx)

### RLS Setup (`db/rls.ts`, migrations)
- ✅ `withUserRls(userId, fn)` injects `app.current_user_id` GUC, sets role to `app_user`
- ✅ Existing policies use `tenant_id IN (SELECT ... FROM tenant_members WHERE user_id = current_app_user())`
- ✅ Pattern: every table gets `tenant_isolation` policy with GRANT to app_user

### Money Formatting (`lib/format/money.ts`)
- ✅ `centsToBRL(cents: number)` → "R$ 10,50"
- ✅ `brlToCents(input: string)` → 1050 (from "R$ 10,50")

### UI/Routes (`app/(app)/financeiro/caixa/`)
- ✅ `page.tsx`: Shows balance card, cash movement dialog, statement
- ✅ `actions.ts`: Server actions for cash operations
- 🟡 **Ready:** Lucro UI would attach to `/lucro` route (new) with daily profit display + cash session close form

---

## Files Mapping

### Create (7 files)

| File | Purpose | Notes |
|------|---------|-------|
| `db/schema/profit.ts` | Profit ledger table | Schema: profit_ledger(id, tenant_id, sale_id FK, sale_items_profit_cents, created_at); also cash_sessions table (id, tenant_id, opened_at, closed_at, opening_balance_cents, expected_balance_cents, actual_count_cents, divergence_cents, status) |
| `db/migrations/0005_lucro_rls.sql` | RLS for new tables | GRANT/ALTER POLICY for profit_ledger and cash_sessions; pattern copied from 0004_financeiro_rls.sql |
| `lib/services/profit/profit-data.ts` | Data layer queries | insertProfitRecord, selectProfitByDay, selectCashSessionDetails |
| `lib/services/profit/profit-service.ts` | Business logic | calculateProfitForSale, getProfitByDay, getProfitSummary |
| `lib/services/profit/cash-session-service.ts` | Cash session logic | openCashSession, closeCashSession, getSessionDetail, recordCashCount |
| `lib/validation/profit.ts` | Zod schemas | cashSessionInput, profitFilterInput, cashCountInput |
| `app/(app)/lucro/actions.ts` | Server actions | getProfitAction, openCashSessionAction, closeCashSessionAction, recordCashCountAction |

### Modify (6 files)

| File | What Changes | Why |
|-----|------|-----|
| `db/schema/sale-items.ts` | Add `cost_cents_snapshot` (integer nullable) | Capture product cost at sale time (like price snapshot) — OR decide to lookup from products |
| `lib/services/sales/sale-service.ts` | Add profit ledger insert in finalizeSale | After stock exit + cash entry, in same tx: insert profit_ledger row |
| `lib/services/finance/cash-data.ts` | Extend to include session scope in queries | Filter cash_movements by session_id for session-scoped balance |
| `db/schema/cash-movements.ts` | Add optional `session_id` (uuid FK to cash_sessions) | Link movement to a cash session for reporting |
| `app/(app)/financeiro/caixa/page.tsx` | Add lucro widget + cash close button | Quick profit summary + link to close session |
| `types/finance.ts` (if exists) or create `types/profit.ts` | Add ProfitDto, CashSessionDto types | DTOs for API responses |

---

## Prerequisites Analysis (CRITICAL)

For the feature to be **usable by end user**:

| Requirement | Prerequisite | Exists? | Action | Blocker? |
|---|---|---|---|---|
| RF01: View daily profit | `products.cost_cents` filled + `sale_items.unit_price_cents` captured | ✅ 0001F + 0002F | Decide: snapshot vs lookup | No (lookup works) |
| RF02: View profit per line item | Profit calculation formula ready | ⚠️ Partial | Create profit_ledger table + insert logic | Yes (must retrofit finalizeSale) |
| RF03: Open/close cash session | `cash_sessions` table + form UI | ❌ Missing | Create table + schema + service + actions | Yes (can't close without it) |
| RF04: Record physical cash count | Cash session structure + validation | ❌ Missing | Create in same table; validate count vs expected | Yes (tied to close) |
| RF05: View session divergence | Ledger + count comparison logic | ⚠️ Partial | Service logic ready once table exists | Dependent on RF03 |

**Blocker Resolution:** All prerequisite tables must exist BEFORE finalizeSale retrofit, else tests/existing sales break.

---

## Technical Decisions Pre-Determined by Codebase

### 1. Money Representation
- **Centavos integer only** — all profit fields must be `integer`, never `numeric` (consistency with 0001F/0002F/0004F)
- **Profit can be negative** — `profit_cents` may be < 0 if cost > sale price (prejuízo); ledger allows it

### 2. Multi-Tenancy / RLS
- **Every table must have `tenant_id` FK** — non-negotiable per CLAUDE.md
- **Every table must have `tenant_isolation` RLS policy** — checked by CHECK constraint, enforced at DB level
- **withUserRls wrapper mandatory** — all service operations run under `app_user` role with tenant context injected

### 3. Immutability / Audit Trail
- **Records immutable after creation** — no UPDATE on profit_ledger or cash_sessions
- **Correction via compensating entry** — if profit calc was wrong, insert new row with opposite sign (not an edit)
- **Timestamp immutable** — `createdAt` defaults to `defaultNow()`, no manual override

### 4. Derived Fields (No Cache)
- **Lucro do dia** = `SUM(profit_cents) WHERE date(created_at) = today AND tenant_id = ? AND type = 'venda'` (on-the-fly)
- **Saldo sessão** = `SUM(cash_movements.amount_cents) WHERE session_id = ? AND tenant_id = ?` (on-the-fly)
- Avoids stale cache; DB is source of truth

---

## Critical Gaps and Questionnaire Items

### 1. **Cost Snapshot Decision** ⚠️
**Q:** How to obtain the cost of each item sold?
- **Option A (Snapshot):** Retrofit `sale_items.cost_cents_snapshot` (like price) at sale time; cost never changes for that sale
  - Pros: Immutable, audit trail, profit calc simple, consistent with price snapshot
  - Cons: Requires migration of existing 0002F sales (backfill NULL → lookup products.cost_cents at time)
- **Option B (Lookup):** Read `products.cost_cents` at profit-report time
  - Pros: No schema change, no backfill
  - Cons: Mutable (if admin changes cost later, past profits recalc); breaks audit trail

**Recommendation:** Option A (snapshot) — aligns with RN02 price snapshot principle. Retrofit needed.

### 2. **Product Without Cost** ⚠️
**Q:** What if `products.cost_cents` is NULL (product added with manual price, no cost)?
- **Option A:** Exclude item from profit total (only count items with cost)
- **Option B:** Treat as cost = 0 (profit = sale_price − 0 = sale_price)
- **Option C:** Alert user; don't show daily profit until all items have cost

**Recommendation:** Option B (cost = 0) — simpler, no partial reports. Document in UI ("Produtos sem custo registrado impactam lucro").

### 3. **Cash Session Schema** ⚠️
**Q:** How to structure cash sessions (abertura/fechamento de caixa por turno)?
- **Option A:** Separate table `cash_sessions(id, tenant_id, opened_at, closed_at, opening_balance_cents, ...)`; FK from cash_movements
- **Option B:** Add `session_id` (uuid) to cash_movements; no separate table

**Recommendation:** Option A — follows 0003F/0004F pattern (separate ledger-like table). Easier to query sessions; supports multi-operator turno handoff.

### 4. **Profit Granularity** ⚠️
**Q:** Store profit per-sale or per-day?
- **Option A:** Per-sale (one profit_ledger row per sale item, linked to sale)
- **Option B:** Per-day aggregated (one row per day, contains SUM of profit)

**Recommendation:** Option A (per-sale) — atomicity, audit trail, supports future per-item profit reports. Aggregation done in service (SUM in queries).

### 5. **Lucro do Dia Definition** ⚠️
**Q:** What revenue stream does "lucro do dia" include?
- Option A: Margin on products only (`Σ(unit_price − cost) × qty` for all sales of the day)
- Option B: Also include receivable/payable interest, discounts, fees?

**Recommendation:** Option A (product margin only) — simplest, matches domain. Receivable/payable belong to separate financial module (future). Clear scope: **Lucro Real = Faturamento − COGS, by day**.

### 6. **Produto Sem Custo Impacto** ⚠️
**Q:** If product has no cost, should it be excluded from profit calc or included with cost=0?
- Prior decision above says cost=0; confirm: if 100un @ R$10 (no cost), profit = R$1.000?

**Recommendation:** Yes, cost=0 → profit = R$1.000. UI flags items with cost=NULL: "Lucro pode estar inflacionado para itens sem custo registrado."

---

## Reaproveitamento Table (Patterns & Conventions)

| Pattern / Convention | Origin | Uso em 0005F | Evidence |
|---|---|---|---|
| **Signed-delta ledger** | 0003F stock_movements, 0004F cash_movements | `profit_ledger(id, ..., profit_cents, ...)` where profit_cents can be +/- (prejuízo); `cash_sessions` derived SUM(cash_movements) filtered by session | db/schema/cash-movements.ts:15–67 (CHECK amount_sign) |
| **RLS multitenancy** | 0001F, 0002F, 0003F, 0004F | profit_ledger.tenant_id FK, cash_sessions.tenant_id FK; GRANT + ALTER POLICY in 0005_lucro_rls.sql | db/migrations/0004_financeiro_rls.sql (pattern) |
| **Centavos integer** | 0002F, 0004F | profit_cents ∈ integer; calculations SUM(subtotalCents) − SUM(costCents × qty) in service | db/schema/sales.ts:33 (totalCents integer), sale-items.ts:40 (unitPriceCents integer) |
| **Transactional service** | 0002F finalizeSale, 0004F paymentService | Services: profit-service.ts (calculateProfit), cash-session-service.ts (openSession); all inside withUserRls tx | lib/services/sales/sale-service.ts:42–115 (withUserRls example) |
| **Immutable records** | 0003F stock_movements, 0004F cash_movements | profit_ledger immutable; no UPDATE; correction by delta entry (profit_cents negated) | db/schema/stock-movements.ts (no UPDATE trigger analogy) |
| **Derived fields (no cache)** | 0004F cash balance | Lucro day = SUM(...) WHERE created_at BETWEEN X AND Y; saldo session = SUM(cash_movements) WHERE session | lib/services/finance/cash-data.ts:68–79 (selectCashBalance uses SUM, no cache) |
| **Retrofit integration** | 0002F→0003F, 0002F→0004F | finalizeSale: stock exit (0003F), cash entry (0004F), **profit ledger insert (0005F)** — all same tx | lib/services/sales/sale-service.ts:74–103 (retrofit pattern in place) |
| **Server actions + Zod** | 0002F, 0004F | app/(app)/lucro/actions.ts: getProfitAction, openCashSessionAction; schemas in lib/validation/profit.ts | app/(app)/financeiro/caixa/actions.ts (pattern example) |
| **CHECK constraints** | 0002F, 0004F | profit_ledger: no explicit constraint (can be any int), but cash_sessions: expected_balance = opening + cash_in − cash_out + profit (logical check in service) | db/schema/cash-movements.ts:54–67 (CHECK examples) |
| **Filtering by type + period** | 0003F, 0004F | Lucro: by date (per-day); cash session: by session_id + date range (e.g., "09:00–17:00 turno") | lib/services/finance/cash-data.ts:82–104 (selectCashMovements with date filter) |

---

## Related Features (with Relation Type)

| Feature | Type | Relation | Key Link |
|---------|------|----------|----------|
| **0001F — Produto + Markup** | CONSUMES | Reads `products.cost_cents`, `markup_percent` for profit margin | `cost_cents` field; used in profit calc |
| **0002F — Venda Rápida** | CONSUMES | Reads `sales.total_cents`, `sale_items.*`, finalizeSale is retrofit point for profit ledger | finalizeSale at lib/services/sales/sale-service.ts:21–116 |
| **0003F — Estoque** | SHARES-PATTERN | Signed-delta ledger pattern reused for profit_ledger; no data dependency | signed-delta archetype in db/schema |
| **0004F — Financeiro** | EXTENDS + CONSUMES | Reads `cash_movements` for session scope; adds **cash session concept** deferred in 0004F (RN07) | cash_movements at db/schema/cash-movements.ts:28–71 |

---

## Delivery Completeness Check

**Question:** With this feature scope, can the **end user USE** the functionality (lucro real + cash close)?

### Functional Layers Validation

| Functionality | Required Layer | In Scope? | User Can Use? |
|---|---|---|---|
| View daily profit | Backend (service) + DB (profit_ledger) + Frontend (page) | ✅ (all 3) | ✅ Yes |
| Record cash count | Backend (session service) + DB (cash_sessions) + Frontend (form) | ✅ (all 3) | ✅ Yes |
| Close cash session | Backend (tx logic) + DB (update cash_sessions.status) + Frontend (button) | ✅ (all 3) | ✅ Yes |
| View daily profit history | Backend (filter) + DB (SUM aggregate) + Frontend (table) | ✅ (all 3) | ✅ Yes |
| Divergence alert | Backend (calc) + DB (stored session data) + Frontend (badge) | ✅ (all 3) | ✅ Yes |

**Conclusion:** Feature scope is **COMPLETE**. All required layers present. No layer excluded that would make feature unusable.

---

## Identified Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Retrofit 0002F finalizeSale with profit ledger insert** | If insert fails silently, sales are created but profit not recorded | Place profit insert INSIDE same withUserRls tx; test covers both sale + profit in same test. RLS tx atomicity ensures both or neither. |
| **Cost snapshot decision delays scope** | If we choose Option B (lookup), audit trail breaks; future cost changes affect past profits. Retrograde inconsistency. | Commit to Option A (snapshot) now; scope retrofit of existing 0002F sales in this feature or defer to 0005F-v2. |
| **Null cost_cents edge case** | If admin adds product with null cost, profit calc returns inflated margin. User not alerted. | Default cost=0 in calc; UI flag in daily profit summary: "X items without cost recorded — profit may be inflated." |
| **Cash session multi-operator handoff** | If session not properly closed before next shift, overlap or gap in movements. | Enforce FK constraint: cash_movements.session_id required (NOT NULL) once session is opened. Schema validation. |
| **Cash session balance mismatch** | User enters wrong cash count; divergence huge. Unclear how to correct. | UI: show expected vs actual; allow EDIT of cash_sessions.actual_count_cents + recalc divergence (once, before archive). Or require re-open session. |
| **Performance: SUM(profit) for large days** | Daily profit report slow if 1000+ sales/day. | Index on (tenant_id, created_at) + SUM aggregate in service; memoize in memory if needed. Monitor. |

---

## Planning Summary

**Feature 0005F** builds two distinct but related facets:
1. **Lucro Real Do Dia** — profit margin = revenue − COGS per sale, aggregated daily by tenant. Retrofit `finalizeSale` to insert profit ledger row; decide on cost snapshot.
2. **Fechamento de Caixa Por Turno** — new `cash_sessions` table (abertura/fechamento), linking movements to a session, tracking divergence (conta real vs esperado).

**Complexity:** Medium. Heavy reuse of RLS + transactional patterns; main unknowns are cost snapshot + cash session schema. **Attention points:**
- Cost snapshot retrofit is load-bearing (audit trail, immutability).
- Three retrofit points in finalizeSale must be atomic (stock + cash + profit).
- Product without cost edge case (default to 0, alert UI).

**Critical dependencies:** 0001F + 0002F + 0004F must be on master (done). New schemas + RLS migration must exist before finalizeSale insert.

---

## Updates

```json
[
  {
    "date": "2026-06-11",
    "change": "Initial discovery: full codebase scan, prerequisites analysis, decision gaps documented. Ready for questionnaire."
  }
]
```

---

## Metadata

```json
{
  "updated": "2026-06-11",
  "sessions": 1,
  "by": "discovery-agent",
  "analysis_scope": "full codebase + past-features",
  "files_read": 18,
  "schema_changes": 2,
  "service_changes": 3,
  "rls_migrations": 1
}
```
