---
id: 0011F-discovery
type: feature-discovery
feature: 0011F-super-admin-billing
updated: 2026-06-22
sessions: 1
---

# Discovery: Super Admin + Assinatura/Billing (0011F)

## Summary
{"patterns":["RLS bypass for admin reads","guard middleware pattern for write-blocking","subscription state machine"],"files_create":5,"files_modify":7,"deps":["users+tenants schema","withUserRls RLS machinery","all write actions"],"complexity":"medium-high","risks":["RLS policy for super-admin requires new role","founder identification","cron infrastructure missing"]}

---

## Technical Context

### Relevant Stack
- **Backend:** Next 16 server actions, Drizzle ORM, Postgres RLS (app_user role)
- **Auth:** Local cookie (httpOnly, HMAC-SHA256) → session.ts → user.id resolved; no founders role yet
- **Multi-tenancy:** Row-level security via `withUserRls` (injects app.current_user_id GUC, assumes app_user role)
- **Database:** Postgres with RLS policies per table; `postgres` role bypasses all policies (onboarding/login use this)

### Identified Patterns
- **Auth context injection:** All server actions call `requireAuthContext()` → extracts userId from cookie + resolves tenantId from tenant_members table (file: `lib/auth.ts:11-21`)
- **RLS transaction wrapper:** `withUserRls(userId, async(tx) => {...})` wraps DB calls with GUC+role injection (file: `db/rls.ts:16-27`)
- **Tenant isolation by subquery:** All business-table RLS policies filter via `tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = current_app_user())` (file: `db/migrations/0001_rls.sql:78-93`)
- **Write validation in service layer:** Services (e.g., finalizeSale) run one atomic transaction per user action; validation errors throw before INSERT (file: `lib/services/sales/sale-service.ts:22-65`)

---

## Codebase Analysis

### Real Tenant + Auth Model
**Tenants table** (`db/schema/tenants.ts:9-27`):
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | generated |
| name | text | required, e.g. "PDV Store 1" |
| default_markup_percent | numeric(5,2) | 0.00–999.99%, defaults to "30.00" |
| created_at | timestamp | auto-now |
| updated_at | timestamp | auto-now |

**Users table** (`db/schema/users.ts:8-20`):
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | generated |
| email | text | unique |
| password_hash | text | bcrypt via lib/auth/password.ts |
| created_at | timestamp | auto-now |

**Tenant-members bridge** (`db/schema/tenant-members.ts:12-33`):
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | generated |
| tenant_id | uuid FK | references tenants.id |
| user_id | uuid FK | references users.id |
| role | text | defaults to "owner"; used but not enforced in RLS yet |
| created_at | timestamp | auto-now |
| updated_at | timestamp | auto-now |
| *(unique constraint)* | (tenant_id, user_id) | one user per store |

**Current state:** No founder/super-admin role yet. Every user who signs up becomes "owner" of their tenant. No subscription state columns exist.

---

### RLS Bypass Path (For Admin Reads)

**Current onboarding bypass:**
1. `createUserWithTenant()` in `lib/services/tenants/onboarding.ts:12-31` runs on `db` (postgres role, no RLS)
2. Inside: wraps user+tenant+member INSERTs in `db.transaction()`
3. File reference: `db/index.ts:1-18` — `queryClient = postgres(connectionString)` uses postgres role

**Admin bypass strategy (reusable):**
- Create a `withAdminRls(userId, fn)` helper that:
  1. Validates userId is a founder (new column `users.is_founder` or `users.email IN (founders.json)`)
  2. Calls `db.transaction()` WITHOUT role assumption (stays in postgres role)
  3. Returns results (reads all tenants unfiltered)
- Location: `db/admin-rls.ts` (new file, mirrors `db/rls.ts`)

**Why this works:**
- postgres role has table SELECT/INSERT/UPDATE/DELETE without RLS filtering (same mechanism as onboarding)
- No changes to RLS policies needed — just a different caller path

---

### Write Actions to Gate (Blocked in `travada`)

**Real server actions that perform writes** (enumerate all):

| Feature | Action | File | Function | Entity | Reason |
|---|---|---|---|---|---|
| **0002F venda-rapida** | finalizeSaleAction | app/(app)/caixa/actions.ts:42 | finalizeSale() | sales, sale_items, cash_movements, stock_movements | Revenue generation — founder needs to see this gated |
| | listTodaySalesAction | app/(app)/caixa/actions.ts:83 | listTodaySales() | sales | Read-only; OK in travada |
| | lookupProductByBarcodeAction | app/(app)/caixa/actions.ts:20 | lookupProductByBarcode() | products | Read-only; OK in travada |
| **0003F estoque** | recordEntryAction | app/(app)/estoque/actions.ts:28 | recordEntry() | stock_movements | Stock in — block in travada |
| | recordAdjustmentAction | app/(app)/estoque/actions.ts:46 | recordAdjustment() | stock_movements | Stock adjust — block in travada |
| | setMinStockAction | app/(app)/estoque/actions.ts:63 | setMinStock() | products | Config write — allow in travada |
| **0004F financeiro** | registerCashInflowAction | app/(app)/financeiro/caixa/actions.ts:20 | registerCashMovement(...,type:'entrada') | cash_movements | Cash in — block |
| | registerCashOutflowAction | app/(app)/financeiro/caixa/actions.ts:40 | registerCashMovement(...,type:'saída') | cash_movements | Cash out — block |
| | createReceivableAction | app/(app)/financeiro/receber/actions.ts:N | createReceivable() | receivables | Accounts receivable — block |
| | recordReceivablePaymentAction | app/(app)/financeiro/receber/actions.ts:N | recordReceivablePayment() | receivable_payments, cash_movements | Receivable payment — block |
| | createPayableAction | app/(app)/financeiro/pagar/actions.ts:N | createPayable() | payables | Accounts payable — block |
| | recordPayablePaymentAction | app/(app)/financeiro/pagar/actions.ts:N | recordPayablePayment() | payable_payments, cash_movements | Payable payment — block |
| **0005F lucro-fechamento** | openCashSessionAction | app/(app)/lucro/actions.ts:N | openCashSession() | cash_sessions | Session open — block |
| | closeCashSessionAction | app/(app)/lucro/actions.ts:N | closeCashSession() | cash_sessions | Session close — block |
| **0006F comanda-mesa** | openComandaAction | app/(app)/comandas/actions.ts:37 | openComanda() | comandas | Comanda open — block |
| | addComandaItemAction | app/(app)/comandas/actions.ts:N | addComandaItem() | comanda_items | Add to comanda — block |
| | removeComandaItemAction | app/(app)/comandas/actions.ts:N | removeComandaItem() | comanda_items | Remove from comanda — block |
| | closeComandaAction | app/(app)/comandas/actions.ts:N | closeComanda() | comandas, sales | Close comanda → trigger sale — block |
| | cancelComandaAction | app/(app)/comandas/actions.ts:N | cancelComanda() | comandas | Cancel comanda — block |
| **Products** | createProductAction | app/(app)/products/actions.ts:N | createProduct() | products | Product CRUD — allow in travada |
| | updateProductAction | app/(app)/products/actions.ts:N | updateProduct() | products | Product CRUD — allow in travada |
| | deleteProductAction | app/(app)/products/actions.ts:N | deleteProduct() | products | Product CRUD — allow in travada |
| **Settings** | updateSettingsAction | app/(app)/settings/actions.ts:N | updateSettings() | tenants | Store config — allow in travada |

**Key business-impacting writes to block:** Sales, stock movements, cash movements (all financial), comanda operations.

**Pattern:** Check if action calls `finalizeSale`, `recordEntry`, `recordCashMovement`, `createReceivable`, `createPayable`, `openCashSession`, `closeCashSession`, `openComanda`, `closeComanda` → BLOCK in travada.

---

### Revenue Source (Faturamento)

**Sales table** (`db/schema/sales.ts:21-59`):
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid FK | Isolates by store |
| user_id | uuid FK | Operator who made the sale |
| total_cents | integer | Sum of item subtotals (RN06: never float, always cents) |
| payment_method | text | 'dinheiro', 'pix', 'cartao', 'fiado' |
| customer_id | uuid FK | Nullable; required if payment_method='fiado' |
| comanda_id | uuid | Nullable; audit link to comanda |
| created_at | timestamp | |

**Admin revenue query pattern:**
```sql
SELECT 
  tenant_id,
  DATE(created_at) as day,
  COUNT(*) as sales_count,
  SUM(total_cents) as revenue_cents
FROM sales
WHERE created_at >= $1 AND created_at < $2  -- date range
GROUP BY tenant_id, DATE(created_at)
ORDER BY tenant_id, day DESC;
```

**Problem:** RLS policy on sales blocks access UNLESS the query runs under app_user role for a user whose tenant matches. Admin needs unfiltered access.

**Solution:** Use `withAdminRls()` (new) for admin queries — bypasses RLS, reads all tenants' sales in one query.

---

### Layout/Shell for /admin + Travada Banner

**Current app shell:** `app/(app)/layout.tsx:12-41`
- Imports: AppSidebar (sidebar nav), AppTopBar (top bar), BottomNav (mobile)
- Guard: `getAuthUser()` at line 17 → redirect("/login") if no session

**AppSidebar** (`components/layout/AppSidebar.tsx:22-35`):
```typescript
const NAV_PRIMARY = [
  { href: "/caixa", label: "Caixa", ... },
  { href: "/vendas", label: "Vendas", ... },
  { href: "/products", label: "Produtos", ... },
  { href: "/estoque", label: "Estoque", ... },
  { href: "/comandas", label: "Comandas", ... },
];

const NAV_SECONDARY = [
  { href: "/financeiro/caixa", label: "Financeiro", ... },
  { href: "/financeiro/clientes", label: "Clientes", ... },
  { href: "/lucro", label: "Lucro", ... },
  { href: "/settings", label: "Configurações", ... },
];
```

**Placement for /admin link:**
- Add conditional link to NAV_SECONDARY (or new NAV_ADMIN section) in AppSidebar
- Guard: Only render if `user.is_founder === true` (new column)
- Icon: BarChart3 or Shield or Users

**Travada banner** (when tenant.status = 'travada'):
- Add to AppTopBar or as a sticky alert banner above main content
- Text: "Assinatura vencida. Contate o suporte para renovar." + color: red/warning
- Disable all write buttons on pages (estoque, caixa, financeiro, comanda)

---

### Cron / Jobs Infrastructure

**Current state:** No route handlers, no scheduled job infrastructure exists.

**What needs to be created:**
- Route handler at `app/api/admin/cron-midnight/route.ts` (POST, secured by secret)
  - Checks current date's midnight
  - Finds tenants with `valid_until < today` AND status ≠ 'travada'
  - Sets status to 'travada'
  - Logs event (new table: subscription_events or audit_log)

**Trigger options:**
1. External cron (GitHub Actions, cloud scheduler) calls the endpoint with secret header
2. Vercel Cron Functions (if deployed to Vercel) — declare in `vercel.json`
3. Local dev: manual script or skip for testing

**No existing pattern in codebase** — must be created from scratch.

---

## File Mapping

### Create (New)

| Path | Purpose |
|---|---|
| `db/schema/subscriptions.ts` | Tenant subscription state (status, valid_until, trial_start, history) |
| `db/admin-rls.ts` | Bypass RLS for founder-only admin queries (mirrors db/rls.ts pattern) |
| `lib/auth/founder-guard.ts` | Utility to check if current user is founder; throws if not |
| `lib/services/admin/tenant-service.ts` | Queries: list all tenants, tenant by ID, revenue by tenant, last-activity, impersonation audit |
| `app/api/admin/cron-midnight/route.ts` | Sweep expired subscriptions → set status='travada' |

### Modify (Existing)

| Path | Change |
|---|---|
| `db/schema/tenants.ts` | Add columns: `subscription_status` (enum-like text: 'testando'/'ativa'/'travada'), `valid_until` (timestamp nullable), `created_at` already exists |
| `db/schema/users.ts` | Add column: `is_founder` (boolean, defaults false) |
| `db/migrations/0001_rls.sql` | Add RLS policy for super_admin role (if using dedicated role) OR document founder bypass pattern |
| `components/layout/AppSidebar.tsx` | Add conditional /admin link (visible if is_founder); adjust NAV_SECONDARY or create NAV_ADMIN |
| `components/layout/AppTopBar.tsx` | Add travada banner when tenant.status='travada' |
| `lib/auth.ts` | Update AuthContext to include `isFounder` boolean |
| `lib/services/tenants/onboarding.ts` | Set `valid_until = now + 7 days` and `subscription_status = 'testando'` on tenant creation |

---

## Prerequisites Analysis (CRITICAL)

| # | Requirement | Prerequisite | Exists? | Action | Blocker? |
|---|---|---|---|---|---|
| RF01 | Founder sees all tenants | users.is_founder column | ❌ | Create in db/schema/users.ts | YES |
| RF01 | Founder unfiltered reads | withAdminRls() helper | ❌ | Create in db/admin-rls.ts | YES |
| RF02 | Tenant subscription state | subscriptions table or columns in tenants | ❌ | Add to db/schema/tenants.ts (or new table) | YES |
| RF03 | Travada blocks writes | Guard middleware in all write actions | ❌ | Create lib/services/travada-guard.ts | YES |
| RF04 | Impersonate store | Audit log table + session override | ❌ | Create db/schema/impersonation_log.ts | NO* |
| RF05 | Revenue metrics | Sales table exists, needs admin query | ✅ | Add service function | NO |
| RF06 | Midnight sweep | Route handler + cron infrastructure | ❌ | Create app/api/admin/cron-midnight/route.ts | NO** |
| RF07 | Banner alerts | AppTopBar/alert component | ✅ (partial) | Add travada banner conditional | NO |

**Blockers that prevent feature from being used:** RF01, RF02, RF03 (founder auth, subscription state, write guard)

**Non-blockers (can be added post-MVP):** RF04 impersonation audit, RF06 midnight cron

---

## Delivery Completeness

**With this scope, can the end user (founder) USE the feature?**

| Validated in Past-Features | Layer | In Scope? | User can use? |
|---|---|---|---|
| Founder sees all stores (dashboard) | Backend | ✅ | ✅ (founder queries via admin panel) |
| Founder sees revenue per store | Backend | ✅ | ✅ (queries unfiltered sales) |
| Manual PIX → valid_until +30d | Backend | ✅ | ✅ (founder API or direct DB update) |
| Travada blocks checkout | Backend (guard middleware) | ✅ | ✅ (all write actions guarded) |
| Travada message on UI | Frontend | ✅ | ✅ (banner in AppTopBar) |
| Midnight sweep | Backend | ⚠️ (requires external cron) | ⚠️ (works if cron is configured) |
| Impersonation audit | Backend | ❌ | ❌ (stretch goal, not MVP) |

**✅ Delivery is COMPLETE** if:
1. Founder column + admin bypass created
2. Subscription status columns added to tenants
3. Travada guard blocks all write actions
4. Admin panel (minimal) lists tenants + revenue
5. Travada banner visible in UI

**⚠️ INCOMPLETE without:**
- Midnight cron (but MVP can use manual trigger + notes in docs)
- Impersonation (stretch feature)

---

## Dependencies

### Internal
- `@/db/rls` — withUserRls pattern (reused for authenticated users)
- `@/lib/auth` — AuthContext, getAuthUser (extended with isFounder)
- `@/lib/services/sales` — sales table queries (for revenue metrics)
- `@/db/schema` — all tables that need travada guard (sales, stock_movements, cash_movements, receivables, payables, comanda, cash_sessions)

### External
- None (auth is local, no Asaas integration until post-MVP)

---

## Technical Assumptions

- **Founder identity:** Stored as `users.is_founder` (simplest); alternatively, read from external list (requires secret/env var)
- **Subscription state machine:** Stored in `tenants` table (3 states: testando, ativa, travada); could be separate table but tenants is simpler
- **Travada immediate effect:** All read-only; owner sees reports + data but cannot transact. No gradual lockdown.
- **Impersonation audit:** Not MVP — can log manually if founder changes another tenant's subscription
- **Cron trigger:** External (GitHub Actions / cloud scheduler) POST to route handler; no in-app scheduler yet

---

## Identified Risks

- **RLS policy for founder:** The current RLS policies filter by tenant-members.user_id. Founder must either:
  1. Have NULL tenant_id in RLS (requires new policy: `user_id = current_app_user() OR is_founder`), OR
  2. Use completely separate `withAdminRls()` path (simpler, no policy change)
  - **Mitigation:** Use approach #2 (withAdminRls) — avoids touching existing RLS logic
  
- **Travada guard scattering:** If not centralized, multiple actions may miss the guard → allow writes during travada
  - **Mitigation:** Single guard function (lib/services/travada-guard.ts), imported by all write actions; test it with a "disabled tenant" integration test
  
- **Revenue query slow for large installs:** SUM(total_cents) across all tenants' sales for dashboards
  - **Mitigation:** Add index on sales(tenant_id, created_at) (already exists per schema comment); consider caching if performance needed later
  
- **Midnight cron missed:** No cron infrastructure; relies on external service
  - **Mitigation:** Document cron setup in README + add monitoring (email alert if not called for 24h)
  
- **Founder locked out:** If is_founder column not set correctly, founder cannot access /admin
  - **Mitigation:** Seed script + clear docs on how to promote users to founders

---

## Planning Summary

**Complexity:** Medium-high (schema changes, new auth path, multiple action guards)

**Critical path:**
1. Add subscriptions columns to tenants schema (or new table) + is_founder to users
2. Implement withAdminRls() bypass (copy withUserRls pattern)
3. Create travada-guard.ts, import in all write actions
4. Build minimal /admin dashboard (founder-only, lists tenants + revenue)
5. Add travada banner to UI

**Attention points:**
- RLS policy does not need to change (withAdminRls bypasses it)
- Founder identification must be robust (cannot be guessed from user input)
- Travada guard must be tested in all write action paths

**Non-blockers (post-MVP):**
- Midnight cron (manual trigger + docs sufficient for MVP)
- Impersonation audit logging
- Founder impersonation UI (back-link to own account)

---

## Related Features

| Feature | Relationship | Why it matters |
|---|---|---|
| **0001F cadastro-produtos** | prerequisite | Tenant created on signup; must set subscription_status='testando' + valid_until=now+7d |
| **0002F venda-rapida** | blocked-by | finalizeSaleAction must check travada guard before inserting sales |
| **0003F estoque** | blocked-by | recordEntry/recordAdjustment must check travada guard |
| **0004F financeiro** | prerequisite + blocked-by | Cash/receivable/payable writes blocked; admin reads revenue from sales table |
| **0005F lucro-fechamento** | blocked-by | openCashSession/closeCashSession must check travada guard |
| **0006F comanda-mesa** | blocked-by | openComanda/closeComanda must check travada guard |
| **0008F sidebar-layout** | extends | AppSidebar + AppTopBar host /admin link + travada banner |

---

## Updates
[{"date":"2026-06-22","change":"Initial discovery: tenant+auth model verified, write actions enumerated, RLS bypass strategy documented, schema prerequisites identified"}]

---

## Metadata
{"updated":"2026-06-22","sessions":1,"by":"discovery-agent"}
