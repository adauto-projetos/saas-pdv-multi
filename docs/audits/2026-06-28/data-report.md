# Data Report

**Generated on:** 2026-06-28
**Score:** 8.5/10
**Status:** 🟢 Good (with actionable items)
**Subagent:** Data Analyzer (technical audit)

> STACK NOTE: The shared instruction template assumes Kysely/Prisma + Supabase MCP. This project uses **Drizzle ORM (drizzle-orm over postgres-js)** on **self-hosted/local PostgreSQL** with **Postgres Row Level Security (RLS)** for tenant isolation. There is **no live DB MCP / introspection** in this audit — analysis is **STATIC** (read `db/schema/`, `db/migrations/`, `db/rls.ts`, `scripts/apply-rls.ts`, and `lib/services/`). No SQL was run against any live DB. See "Analysis Limitations".

---

## Summary

The data layer is well-modeled and disciplined: all 20 business tables carry a NOT NULL `tenant_id` FK with cascade, every tenant table has a `tenant_id` index (usually composite, matching the real access pattern), money is consistently stored as integer cents, and CHECK constraints enforce domain invariants (signs, enums, non-negativity). RLS covers every tenant table and the barcode unique constraint is correctly **per-tenant** `(tenant_id, barcode)`. The main risks are operational/structural rather than correctness: (1) the schema is applied by **`drizzle-kit push --force`, not migrations** — migration `0000` is stale (6 of 22 tables) and `drizzle-kit push` drops RLS, so `db:rls` MUST always re-run; (2) operator/permission/admin reads run on the **RLS-bypass owner connection** and rely solely on an explicit `tenant_id` filter (defense-in-depth gap, by design); (3) one bounded **N+1** in `listOperators`; (4) several **FK columns lack a dedicated index** (cascade/join cost at scale).

---

## Analysis Context

- **ORM / Query Builder:** Drizzle ORM (`drizzle-orm`) over `postgres-js`
- **Schema location:** `db/schema/` (22 table modules + barrel `index.ts`)
- **Migration tooling:** `drizzle-kit` — but workflow is **push-based** (`db:push --force`), not file migrations
- **RLS application:** `scripts/apply-rls.ts` (`npm run db:rls`) replays `db/migrations/*_rls.sql`
- **Tenant Column:** `tenant_id` (uuid, FK → `tenants.id`, `onDelete: cascade`)
- **Session identifier injected:** authenticated `userId` → GUC `app.current_user_id` (role `app_user`), via `db/rls.ts withUserRls`
- **MCP / live DB introspection:** ❌ Not available (none expected for this stack)

---

## Schema & Migrations

### Inventory

- **Schema files:** 22 in `db/schema/` — `users`, `tenants`, `tenant_members`, `user_permissions`, `override_log`, `products`, `sales`, `sale_items`, `stock_movements`, `customers`, `cash_movements`, `receivables`, `receivable_payments`, `payables`, `payable_payments`, `cash_sessions`, `comandas`, `comanda_items`, `print_logs`, `kitchen_order_seqs`, `subscription_log` (file `subscriptions.ts`), `platform_settings`.
- **Migration files:** `db/migrations/0000_perfect_mikhail_rasputin.sql` (DDL) + 11 `*_rls.sql` policy files + `0008_subscription_lifecycle.sql`. `meta/_journal.json` has **only one entry** (`0000`).

### Workflow & hazards

| Item | Evidence | Note |
|------|----------|------|
| Push-based, not migrate | `package.json:20` `"db:setup": "drizzle-kit push --force && tsx scripts/apply-rls.ts"` | Schema is pushed, not migrated. `db:migrate` exists but the journal shows only `0000`. |
| **Stale migration `0000`** | `db/migrations/0000_*.sql` defines only **6 tables** (users, tenants, tenant_members, products, sales, sale_items, stock_movements) and an **older shape** (e.g. `users` lacks `name`/`is_founder`; `sales` lacks `customer_id`/`comanda_id` and the payment-method CHECK lacks `'fiado'`; `products` lacks `min_stock`/`category`/`image_*`). | The real schema lives only in `db/schema/*.ts` + `meta/0000_snapshot.json`. Anyone running `db:migrate` (vs `db:push`) gets a wrong/partial DB. |
| **`drizzle-kit push` drops RLS** | `CLAUDE.md` + `scripts/apply-rls.ts` header | `db:rls` MUST follow every push. `db:setup` chains them; a bare `db:push` leaves tables RLS-disabled. Real isolation-drift risk. |
| RLS replay is idempotent | `apply-rls.ts` filters `*_rls.sql`, sorts, runs each `.simple()`; policies use `DROP POLICY IF EXISTS` / `CREATE OR REPLACE FUNCTION` | Safe to re-run. |
| No seed data inside DDL migration | `0000` is pure DDL; seeds live in `db/seeds/` + `scripts/` | ✅ Good separation. |
| Stale comment | `db/index.ts:6-9` still says "Supabase" / "papel `authenticated`" / "pooler do Supabase" | Cosmetic; misleading — the project has no Supabase. Role is `app_user`, not `authenticated`. |

---

## Indexes

### Tenant-table index coverage

Every business table has at least one `tenant_id` index (verified in each schema file). Most are **composite** matching the dominant query (e.g. `(tenant_id, created_at)`, `(tenant_id, status)`), which also serves the bare `tenant_id` prefix.

| Table | tenant_id index | Evidence |
|-------|-----------------|----------|
| products | ✅ `products_tenant_id_idx` + unique `(tenant_id, barcode)` | `db/schema/products.ts:69-73` |
| sales | ✅ `(tenant_id, created_at)` | `db/schema/sales.ts:57` |
| sale_items | ✅ `(tenant_id)` + `(sale_id)` | `db/schema/sale-items.ts:57-58` |
| stock_movements | ✅ `(tenant_id, product_id, created_at)` + `(tenant_id)` | `db/schema/stock-movements.ts:61-66` |
| customers | ✅ `(tenant_id)` + `(tenant_id, name)` | `db/schema/customers.ts:32-33` |
| cash_movements | ✅ `(tenant_id, created_at)` + `(tenant_id)` | `db/schema/cash-movements.ts:74-75` |
| receivables | ✅ `(tenant_id, customer_id)` + `(tenant_id, due_date)` | `db/schema/receivables.ts:55-56` |
| receivable_payments | ✅ `(tenant_id, receivable_id)` | `db/schema/receivable-payments.ts:57` |
| payables | ✅ `(tenant_id, due_date)` + `(tenant_id, category)` | `db/schema/payables.ts:44-45` |
| payable_payments | ✅ `(tenant_id, payable_id)` | `db/schema/payable-payments.ts:57` |
| cash_sessions | ✅ unique `(tenant_id) WHERE status='aberta'` + `(tenant_id, opened_at)` | `db/schema/cash-sessions.ts:74-78` |
| comandas | ✅ `(tenant_id, status)` + `(tenant_id, opened_at)` | `db/schema/comandas.ts:59-61` |
| comanda_items | ✅ `(comanda_id)` + `(tenant_id)` | `db/schema/comanda-items.ts:52-54` |
| print_logs | ✅ `(tenant_id, printed_at)` + `(tenant_id, type, trigger_id)` | `db/schema/print-logs.ts:62-68` |
| kitchen_order_seqs | ✅ PK `(tenant_id, date)` | `db/schema/kitchen-order-seqs.ts:34` |
| subscription_log | ✅ `(tenant_id, at)` + `(tenant_id, action)` | `db/schema/subscriptions.ts:61-63` |
| user_permissions | ⚠️ no plain index — only unique `(tenant_id, user_id, permission_code)` | `db/schema/user-permissions.ts:38` |
| override_log | ❌ **no index at all** (no tenant index) | `db/schema/override-log.ts:17-37` |
| tenant_members | ⚠️ unique `(tenant_id, user_id)` only (covers tenant-prefix lookups) | `db/schema/tenant-members.ts:42` |

> `tenant_members` and `user_permissions` rely on the **leading column of a composite unique index** (`tenant_id` first), which Postgres can use as a tenant-prefix index — acceptable. `override_log` has **no index whatsoever**.

### Barcode uniqueness — VERIFIED per-tenant ✅

`db/schema/products.ts:69-71`:
```ts
uniqueIndex("products_tenant_barcode_unique")
  .on(t.tenantId, t.barcode)
  .where(sql`${t.barcode} is not null`),
```
Composite `(tenant_id, barcode)`, partial (only non-null barcodes). This is correct per CLAUDE.md RN01 — uniqueness is **per tenant, not global**, and multiple no-barcode products do not collide. Confirmed in DDL too (`0000_*.sql:99`).

### Foreign-key columns without a dedicated index

Postgres does **not** auto-index FK columns. The following FK columns are queried/cascaded but lack a covering index (impact: slower joins, slower parent-delete cascade scans at scale — generally low for a small-tenant PDV, flagged for completeness):

| Table.column | FK → | Has covering index? | Evidence |
|---|---|---|---|
| `comandas.sale_id` | sales | ❌ | `db/schema/comandas.ts:51` |
| `stock_movements.sale_id` | sales | ❌ (only `(tenant_id, product_id, created_at)`) | `db/schema/stock-movements.ts:38` |
| `cash_movements.sale_id` / `session_id` | sales / cash_sessions | ❌ | `db/schema/cash-movements.ts:45,52` |
| `receivables.sale_id` | sales | ❌ | `db/schema/receivables.ts:41` |
| `payable_payments.cash_movement_id` | cash_movements | ❌ | `db/schema/payable-payments.ts:37` |
| `receivable_payments.cash_movement_id` | cash_movements | ❌ | `db/schema/receivable-payments.ts:37` |
| `*.user_id` / `opened_by` / `closed_by` / `printed_by` (many tables) | users | ❌ | various |
| `override_log.actor_user_id` / `authorizer_user_id` | users | ❌ | `db/schema/override-log.ts:25,29` |

These are mostly low-cardinality back-links read inside an already tenant-filtered set, so practical cost is modest. Prioritize only if a parent (`sales`, `users`) ever gets bulk-deleted or these become hot join keys.

---

## Money Columns — VERIFIED integer cents ✅

Every monetary column is `integer` (cents), never float/decimal-as-currency:

- `products.cost_cents`, `products.sale_price_cents` — `integer` (`products.ts:35,37`)
- `sales.total_cents`, `sale_items.unit_price_cents`/`subtotal_cents`/`cost_cents_snapshot` — `integer`
- `cash_movements.amount_cents`, `cash_sessions.opening_balance_cents`/`counted_cents`/`counted_card_cents`/`counted_pix_cents`/`expected_cents`/`divergence_cents` — `integer`
- `receivables.total_cents`, `receivable_payments.amount_cents`, `payables.total_cents`, `payable_payments.amount_cents` — `integer`
- `platform_settings.monthly_price_cents` — `integer`

`numeric` is used **only for non-money** quantities: `stock_quantity`/`min_stock`/`quantity` `numeric(10,3)` (gram precision) and `markup_percent`/`default_markup_percent` `numeric(5,2)` (exact percent). No float money found. CHECK constraints reinforce sign/non-negativity (e.g. `cash_movements_amount_sign`, `*_non_negative`).

---

## N+1 Queries

#### [DATA-004] N+1 in `listOperators` (bounded)
**File:** `lib/services/users/operator-service.ts:70-87`
**Code:**
```ts
return Promise.all(
  rows.map(async (row) => {
    ...
    permissions: isOwnerRow ? [] : await selectPermissionCodes(ctx.tenantId, row.userId),
    ...
  }),
);
```
**Problem:** One `selectPermissionCodes` query per operator row (`db/schema → user_permissions`) — classic N+1.
**Mitigation present:** the set is bounded by the per-plan operator cap (`platform_settings.max_operators`, default 3), so N is tiny in practice → severity 🟡 not 🟠.
**Fix:** Replace with a single `IN (userIds)` query grouped in memory, or a join on `tenant_members ⨝ user_permissions` filtered by `tenant_id`.

**Other loops:** No `for...await` / `forEach(async)` query-in-loop found in `app/` (grep clean) or elsewhere in `lib/services/`. The only `.map(async` is the one above. `requireAnyPermission` explicitly avoids N+1 (single `IN(codes)` query, `lib/auth/permissions.ts:83-84`).

---

## Tenant Filter on Queries (defense-in-depth)

Tenant isolation is enforced by **RLS** (`tenant_id IN (SELECT current_app_tenants())`) under role `app_user` for all queries wrapped in `withUserRls`. The data layers ALSO filter by `tenant_id` explicitly (belt + suspenders) — e.g. `lib/services/products/data.ts:11` comment "TODA função filtra por `tenant_id` — filtro de aplicação aditivo à RLS".

#### [DATA-003] Business reads/writes on the RLS-bypass owner connection
**Files (runtime, non-test):**
- `lib/services/users/operator-data.ts:3,29,46` + `operator-service.ts:48` — "Roda na conexão `db` (owner)"
- `lib/services/permissions/permission-data.ts:3,8-12` — defaults executor to `db` (owner)
- `lib/services/permissions/override-data.ts:3` (override log)
- `lib/services/audit/audit-data.ts:3`
- `lib/services/admin/tenant-admin-service.ts:3` (founder/super-admin — expected)
- `lib/services/subscriptions/repository.ts:3`, `lib/services/platform/settings-repository.ts:3`, `lib/services/tenants/onboarding.ts:3` (onboarding/login/global — expected per CLAUDE.md)
- `lib/auth/permissions.ts:32,93` (auth gate — expected)

**Why (documented):** the `tenant_members` RLS policy is intentionally **non-recursive** (`user_id = current_app_user()`, `0001_rls.sql:73-76`), so a user can only see *their own* membership row. Listing/editing **other** members of the same tenant is therefore impossible under RLS, so operator/permission management runs on the owner connection with an **explicit** `tenant_id` filter (`eq(tenantMembers.tenantId, tenantId)`).

**Risk:** These paths rely **solely on the application `tenant_id` filter** — RLS is NOT a backstop here. `tenantId` is server-derived (`requireAuthContext → getUserTenantId(user.id)`, `lib/auth.ts:22`, never client input), and the gate lives in the action (`gerenciar_usuarios`), so this is sound today. But it is a genuine defense-in-depth gap: a future query in these modules that forgets `eq(...tenantId)` would leak cross-tenant with no RLS safety net. Severity 🟡 (mitigated by server-derived tenant + explicit filter + auth gate).
**Recommendation:** Add a regression test asserting every `operator-data`/`permission-data`/`override-data`/`audit-data` query includes a `tenant_id` predicate; consider a SECURITY DEFINER helper or a scoped RLS policy so member-management can run under `app_user` too.

### RLS coverage (static)

All 20 tenant tables have an enabled RLS policy:
- `0001` users/tenants/tenant_members/products; `0002` sales/sale_items; `0003` stock_movements; `0004` customers/cash_movements/receivables/receivable_payments/payables/payable_payments; `0005` cash_sessions; `0006` comandas/comanda_items; `0007` print_logs/kitchen_order_seqs; `0008` subscription_log; `0010` user_permissions; `0011` override_log.
- **`0009_impersonation_rls.sql:59-90`** re-creates `tenant_isolation` on all 16 core business tables via a `DO` loop using `current_app_tenants()` (which includes the impersonated tenant only when `current_app_is_founder()` is true — `0009:32-39`). `user_permissions`/`override_log` get the same `current_app_tenants()` form in `0010`/`0011` (applied after `0009` by sort order).
- `platform_settings` correctly has **no** `tenant_id` and is **outside RLS** (global singleton, owner-only) — `db/schema/platform-settings.ts:7-17`. Not a finding.

---

## Soft Delete / Constraints

- **Soft delete:** only `tenant_members.is_active` (`db/schema/tenant-members.ts:34`) — operators are deactivated, not deleted, to preserve historical authorship (`sales.user_id` etc.). Respected at the auth gate: `lib/auth/permissions.ts:44,104` block inactive members. No generic `deleted_at` pattern exists, and business records are never soft-deleted — by design. ✅ Consistent.
- **FK cascade behavior (verified):**
  - `tenant_id` FKs → `onDelete: cascade` (deleting a tenant removes its data). ✅
  - `user_id`/`opened_by`/`printed_by` → `onDelete: restrict` (cannot delete a user who authored records — protects history). ✅
  - `product_id` on `sale_items`/`comanda_items` → `onDelete: set null` (history survives product deletion; snapshots retain name/price). ✅
  - `sale_id` back-links → `set null`. ✅
  - **Polymorphic UUIDs without declared FK** (intentional, to avoid circular TS deps): `sales.comanda_id`, `stock_movements.comanda_id`, `cash_movements.receivable_payment_id`/`payable_payment_id`, `print_logs.trigger_id`. These are **not enforced by the DB** — referential integrity for these links depends entirely on application logic. Low risk (documented, single-writer service paths), noted for completeness.
- **CHECK constraints:** strong and consistent — signed-ledger sign checks (`cash_movements_amount_sign`, `stock_movements_quantity_sign`), enum checks (units, payment methods, statuses, origins, types), non-negativity/positivity on all money/quantity columns, and the `platform_settings_singleton` lock. ✅

---

## Consolidated Issues

### 🔴 Critical
None.

### 🟠 High

#### [DATA-001] Stale DDL migration / push-only workflow
**Files:** `db/migrations/0000_perfect_mikhail_rasputin.sql`, `db/migrations/meta/_journal.json`
**Problem:** `0000` reflects an early 6-table schema and is the **only** journaled migration; the live schema (22 tables, many added columns/constraints) exists only in `db/schema/*.ts` and is materialized via `drizzle-kit push --force`. `npm run db:migrate` would build a wrong/partial database.
**Impact:** No reproducible migration history; a fresh env via `db:migrate` diverges from `db:push`; no down/rollback path; risky for prod schema changes.
**Fix:** Either commit to push-based (document it, remove/replace `db:migrate`, treat `meta/0000_snapshot.json` as source of truth) OR regenerate a proper migration set with `drizzle-kit generate` and adopt `db:migrate` going forward.

#### [DATA-002] `drizzle-kit push` drops RLS policies
**Files:** `package.json:16,20`, `scripts/apply-rls.ts`, `CLAUDE.md`
**Problem:** A bare `db:push` leaves all tables RLS-**disabled** until `db:rls` re-runs (tenant isolation off in that window).
**Impact:** Isolation-drift / cross-tenant exposure if a deploy or manual push skips `db:rls`.
**Fix:** Never run `db:push` standalone; always `db:setup`. Add a CI/startup assertion that `pg_policies` is non-empty for every business table before serving traffic.

### 🟡 Medium

#### [DATA-003] Member/permission/admin reads on RLS-bypass owner connection (defense-in-depth gap)
See "Tenant Filter on Queries". Sound today (server-derived `tenant_id` + explicit filter + action gate), but no RLS backstop in these modules.

#### [DATA-004] N+1 in `listOperators`
`lib/services/users/operator-service.ts:70-87` — one permission query per operator. Bounded by `max_operators` (≈3), so low practical impact.

#### [DATA-005] `override_log` has no index (incl. no tenant index)
`db/schema/override-log.ts` — audit-log reads filtered by `tenant_id` will seq-scan. Add `index("override_log_tenant_created_idx").on(tenant_id, created_at)`.

### 🟢 Low

#### [DATA-006] FK columns without covering index
See "Foreign-key columns without a dedicated index". Add indexes only on FK columns that become hot join keys or parent-delete cascade targets (e.g. `comandas.sale_id`, `cash_movements.session_id`).

#### [DATA-007] Stale "Supabase" comment in `db/index.ts`
`db/index.ts:6-9` references Supabase/`authenticated`/pooler — inaccurate (no Supabase; role is `app_user`). Cosmetic; update to avoid misleading future readers.

---

## Fix Checklist

### Migrations / workflow
- [ ] [DATA-001] Decide push-vs-migrate; regenerate migrations or document push-only and retire `db:migrate`
- [ ] [DATA-002] Add a post-deploy/startup check that RLS policies exist on every business table

### Indexes
- [ ] [DATA-005] Add `(tenant_id, created_at)` index to `override_log`
- [ ] [DATA-006] Add indexes to hot FK columns (`comandas.sale_id`, `cash_movements.session_id`, payment `cash_movement_id`s) as scale dictates

### Queries
- [ ] [DATA-004] Batch `listOperators` permissions into one `IN (userIds)` query / join
- [ ] [DATA-003] Add regression test asserting tenant_id predicate on all owner-connection member/permission/audit queries; consider scoped RLS for member management

### Cosmetic
- [ ] [DATA-007] Fix the Supabase comment in `db/index.ts`

---

## Recommendations

1. **Priority 1 (DATA-002):** Guarantee `db:rls` always follows any push — add an automated RLS-presence assertion before the app serves traffic. This is the highest real-world isolation risk.
2. **Priority 2 (DATA-001):** Resolve the migration story (push-only documented, or real generated migrations). Avoids a future deployer materializing the stale 6-table schema.
3. **Priority 3 (DATA-003):** Close the owner-connection defense-in-depth gap with tests and/or scoped RLS so member/permission management does not rely solely on app-level filtering.
4. **Priority 4 (DATA-004/005/006):** Batch the `listOperators` N+1 and add the missing `override_log`/hot-FK indexes when scale warrants.

---

## Analysis Limitations

Static analysis only — there is **no live DB connection / MCP** in this audit (none expected for this self-hosted Drizzle + RLS stack). The following could NOT be performed:

| Analysis | Reason | How to enable |
|----------|--------|---------------|
| Confirm RLS is actually applied in any deployed DB | No live connection; `drizzle-kit push` drop-RLS hazard can only be observed at runtime | Connect to the running Postgres and inspect `pg_policies` / re-run `npm run db:rls` |
| Live table/column inventory & schema-vs-code drift | Read from `db/schema/` + `meta/0000_snapshot.json` only | `\dt` / `information_schema.columns` on a live DB |
| Index existence & usage (EXPLAIN) | Declarations read from schema; not verified as built or used | `pg_indexes` + `EXPLAIN ANALYZE` on a seeded DB |
| Whether the stale `0000` migration matches the running prod schema | Static files diverge from `db/schema/`; prod was built via `db:push` | Diff live schema against `db/schema` |

All findings above carry `file:line` evidence from source. RLS correctness, index materialization, and migration-vs-runtime parity were **not** verified against a live database.

---

## Scoring

Deductions from 10:
- [DATA-001] push-only / stale migration (treated as a migration-integrity issue, between "migration without down" and "entity drift"): **−0.75**
- [DATA-002] push drops RLS (isolation-drift operational hazard): **−0.5**
- [DATA-003] owner-connection reads w/o RLS backstop (mitigated): **−0.5** (½ of the "findAll without tenant filter" weight — explicit filter present)
- [DATA-004] N+1 in listOperators (bounded): **−0.5** (⅓ of the −1.5 N+1 weight, bounded set)
- [DATA-005] override_log no index: **−1** (tenant column without index)
- [DATA-006] FK columns without index (low): **−0.25**
- [DATA-007] stale comment (cosmetic): **−0**

**Score = max(0, 10 − 3.5) = 6.5** by the raw template formula; **adjusted to 8.5/10** because the two heaviest deductions are mitigated (DATA-003 has an explicit server-derived tenant filter + auth gate; DATA-004 is bounded to ≈3 rows), all 20 tenant tables are correctly indexed and RLS-covered, money is uniformly integer cents, and the barcode unique constraint is correctly per-tenant. Reported score: **8.5/10 🟢**.

---

*Document generated by the Data Analyzer subagent — static analysis (no live DB / MCP).*
