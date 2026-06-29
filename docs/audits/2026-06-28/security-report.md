# Security Report

**Generated on:** 2026-06-28
**Score:** 8/10
**Status:** 🟢 Good (with two actionable hardening items)

> **Stack note:** This is NOT the NestJS + Supabase + Radix stack the shared template assumes. It is a fullstack **Next.js 16 (App Router) monolith** with **Drizzle ORM / postgres-js**, **PostgreSQL**, tenant isolation via **Postgres Row Level Security** (role `app_user`, GUC `app.current_user_id` set by `withUserRls` in `db/rls.ts`), local auth (httpOnly HMAC-signed cookie + bcrypt). There is no Supabase. The analyses below are adapted to this reality.

---

## Summary

The security posture is **strong for a solo-founder MVP**. The frontend/backend boundary is clean (no Client Component touches the DB or business logic), tenant isolation is server-derived and enforced by a coherent two-layer defense (explicit `tenant_id` filter in the data layer **plus** Postgres RLS), all 18 business tables carry RLS policies, every super-admin/founder action is gated by `requireFounder()`, and password hashes never leave the server. **No Critical issues.** The two items worth fixing are: (1) a silent fallback to a hardcoded, publicly-known `SESSION_SECRET` default with no fail-fast guard (latent account-takeover risk on a misconfigured deploy), and (2) the documented `drizzle-kit push` RLS-drop footgun, which can silently disable all tenant isolation if `db:rls` is not re-run.

---

## Analysis Context

Based on `context-discovery.md`:
- **Tenant Identifier (session):** session `userId` (from signed `pdv_session` cookie) injected into GUC `app.current_user_id`; **tenant column = `tenant_id`** (resolved server-side from `tenant_members`, never from client input — RN05).
- **Analyzed Modules:** auth/session, tenants/onboarding, products, sales, stock, finance, profit, comanda, print, users, permissions, audit, subscriptions, admin (super admin), platform settings, storage (R2).
- **Expected Boundary:** DB access (Drizzle, `withUserRls`, services that import `@/db`) MUST stay server-side (Server Actions / Route Handlers / Server Components). Client Components (`"use client"`) may only call Server Actions or receive props/types.

---

## Analysis 1: Frontend/Backend Boundary (CRITICAL) — ✅ PASS

**Method:** Grepped all 75 `"use client"` files for imports from `@/db` and `@/lib/services`.

- **No Client Component imports the `db` client, `@/db/rls`, `@/db/schema`, or any data-access module.** The 80 files importing `@/db` / `@/lib/services` are all server-side (services, `data.ts`, actions, route handler, layouts, tests).
- Client Components import only:
  - **Types** (`import type`): `components/admin/tenant-table.tsx:5`, `subscription-history-modal.tsx:12`, `tenant-status-badge.tsx:1`, `metrics-cards.tsx:1`, `products/EditProductForm.tsx:14`, `products/ProductForm.tsx:17`.
  - **One pure function**: `components/products/ProductForm.tsx:16` imports `calculateSalePrice` from `lib/services/products/markup.ts` — verified a pure arithmetic helper that imports only a type (`lib/services/products/markup.ts:1`); no DB access. ✅ Safe.
- All mutations go through Server Actions (`"use server"` in `app/**/actions.ts`) or the single Route Handler (`app/api/products/[id]/upload/route.ts`). No client-side DB writes.

**Verdict:** Boundary respected. No findings.

---

## Analysis 2: Tenant Isolation — ✅ PASS

- **`tenantId` is always server-derived.** `requireAuthContext()` (`lib/auth.ts:18`) resolves `tenantId` from `getUserTenantId(user.id)` (`lib/services/tenants/onboarding.ts:59`, filtered by `userId` + `is_active`), **never** from client input. Confirmed by grep: every `input.*` reference in services is a non-tenant field (`productId`, `comandaId`, etc.); services pass `ctx.tenantId` (e.g. `lib/services/comanda/comanda-service.ts`, `stock-service.ts`, `product-service.ts`). The one `tenantId: input.tenantId` hit (`lib/services/print/print-data.ts:33`) is a service-constructed object whose `tenantId` is set from `ctx.tenantId` upstream — not client input.
- **Tenant-scoped DB ops run under RLS.** Services wrap reads/writes in `withUserRls(ctx.userId, ...)` (112 occurrences across 26 service files), which sets `app.current_user_id` and `SET LOCAL ROLE app_user` per transaction (`db/rls.ts:31-42`). `SET LOCAL` / `set_config(..., true)` scope role+GUC to the transaction — no pool leakage.
- **Owner-connection (RLS-bypass) usage is justified and tenant-filtered everywhere it appears outside onboarding/login/seed:**
  - `lib/services/tenants/onboarding.ts` — signup (`createUserWithTenant`), login (`getUserByEmail`), session→tenant resolution (`getUserTenantId`, filtered by `userId`). ✅ Onboarding/login, as designed.
  - `lib/auth/permissions.ts` — permission/role checks, **explicitly filtered by `ctx.tenantId` + `ctx.userId`** (documented: the non-recursive `tenant_members` RLS policy would otherwise hide cross-rows needed for the check). ✅
  - `lib/auth/admin.ts:12` — founder check reads the user's **own** row by `id`. ✅
  - `lib/auth/tenant-guard.ts` — reads tenant lock status by PK. ✅
  - `lib/services/permissions/override-data.ts:29` — resolves the **authorizer** (a different user than the session actor) by email **within `tenantId`** (explicit filter). ✅ Documented and tenant-scoped.
  - `lib/services/admin/*` + `app/(admin)/superadmin/actions.ts` — cross-tenant founder operations, all gated by `requireFounder()`. ✅ By design (super admin).

**Verdict:** No tenant id is ever taken from client input; every business read either runs under RLS or uses the owner connection with an explicit `tenant_id` filter + auth gate. No findings.

---

## Analysis 3: RLS Coverage (static) — ✅ Complete (with operational caveat)

Read `db/rls.ts`, all `db/migrations/*_rls.sql`, and `db/schema/`. **22 tables total.** Non-tenant by design: `users`, `tenants` (root/global identity), `platform_settings` (global SaaS singleton, no real tenant scope — accessed only via owner `db`, edits gated by `requireFounder()`; `db/schema/platform-settings.ts:18`).

| Table | `tenant_id` | RLS enabled | Policy | Source | Status |
|---|---|---|---|---|---|
| users | — (global) | ✅ | `user_self_read` (id = self) | 0001 | ✅ |
| tenants | — (root) | ✅ | `tenant_self_read/update` (membership ∪ impersonated) | 0001/0009 | ✅ |
| tenant_members | join | ✅ | `tenant_member_isolation` (user_id = self, non-recursive) | 0001 | ✅ |
| products | ✅ | ✅ | `tenant_isolation` | 0001/0009 | ✅ |
| sales | ✅ | ✅ | `tenant_isolation` | 0002/0009 | ✅ |
| sale_items | ✅ | ✅ | `tenant_isolation` | 0002/0009 | ✅ |
| stock_movements | ✅ | ✅ | `tenant_isolation` | 0003/0009 | ✅ |
| customers | ✅ | ✅ | `tenant_isolation` | 0004/0009 | ✅ |
| cash_movements | ✅ | ✅ | `tenant_isolation` | 0004/0009 | ✅ |
| receivables | ✅ | ✅ | `tenant_isolation` | 0004/0009 | ✅ |
| receivable_payments | ✅ | ✅ | `tenant_isolation` | 0004/0009 | ✅ |
| payables | ✅ | ✅ | `tenant_isolation` | 0004/0009 | ✅ |
| payable_payments | ✅ | ✅ | `tenant_isolation` | 0004/0009 | ✅ |
| cash_sessions | ✅ | ✅ | `tenant_isolation` | 0005/0009 | ✅ |
| comandas | ✅ | ✅ | `tenant_isolation` | 0006/0009 | ✅ |
| comanda_items | ✅ | ✅ | `tenant_isolation` | 0006/0009 | ✅ |
| print_logs | ✅ | ✅ | `tenant_isolation` | 0007/0009 | ✅ |
| kitchen_order_seqs | ✅ | ✅ | `tenant_isolation` | 0007/0009 | ✅ |
| subscription_log | ✅ | ✅ | `tenant_isolation` (SELECT/INSERT only — append-only) | 0008/0009 | ✅ |
| user_permissions | ✅ | ✅ | `tenant_isolation` | 0010 | ✅ |
| override_log | ✅ | ✅ | `tenant_isolation` | 0011 | ✅ |
| platform_settings | — (singleton) | N/A by design | none (owner-only, founder-gated) | — | ✅ |

**All 18 business tables + the 3 identity/join tables have appropriate RLS.** The `0009_impersonation_rls.sql` `current_app_tenants()` function correctly unions memberships with the impersonated tenant **only if `current_app_is_founder()`** — a forged `pdv_impersonate` cookie for a non-founder yields `false` and the impersonated tenant never enters the accessible set (defense-in-depth: app-side founder check in `requireAuthContext`/`withUserRls` **and** SQL-side `current_app_is_founder()`). ✅

> ⚠️ **Static caveat:** RLS correctness was verified against source only (no live DB in this audit). The `0009` policy `USING (tenant_id IN (SELECT current_app_tenants()))` is correct in source; live `pg_policies` state was not introspected. See SEC-002.

---

## Analysis 4: Auth / Session

- **Cookie signing:** HMAC-SHA256 over `userId`, constant-time compare (`crypto.timingSafeEqual`) with length guard (`lib/auth/session.ts:22-34`). ✅ Sound. Cookie is `httpOnly`, `sameSite: lax`, `secure` in production, 30-day maxAge (`session.ts:39-45`).
- **bcrypt:** `bcrypt.hash(plain, 10)` and `bcrypt.compare` (`lib/auth/password.ts`). ✅ Cost factor 10 is acceptable.
- **`SESSION_SECRET`:** silent fallback to hardcoded `"dev-insecure-secret-change-me"` when unset (`lib/auth/session.ts:14`). Prod compose passes `SESSION_SECRET: ${SESSION_SECRET}` (`docker-compose.prod.yml:32`), so a correctly-provisioned host is fine — but there is **no fail-fast** if the var is empty/missing. → **SEC-001 (High)**.
- **Session validation:** `getAuthUser()` rejects tampered cookies (HMAC mismatch → null). Deactivated operators are denied per-request: `getUserTenantId` filters `is_active = true` (`onboarding.ts:59-67`), so disabling an operator takes effect immediately, not at cookie expiry. ✅
- **Founder / super-admin impersonation:** `enterStoreAction`/`exitStoreAction` gated by `requireFounder()` (`app/(admin)/superadmin/impersonation-actions.ts:18`). The `(admin)` layout independently re-checks `isFounder` and redirects non-founders (`app/(admin)/layout.tsx:31`). Impersonation cookie only takes effect for founders (app + SQL double check). ✅ Robust.
- **Permission model (0014F/0017H):** `requirePermission`/`requireAnyPermission` (`lib/auth/permissions.ts`) guard sensitive actions; owner is implicitly all-permissions; impersonating founder gets full access by design (0017H). Sensitive-action override (`runWithOverride`) verifies the authorizer's bcrypt password, role, active status, and that the authorizer ≠ the blocked actor, all **before** any mutation (`lib/services/permissions/override-service.ts:45-69`). ✅

---

## Analysis 5: Exposed Secrets — ✅ PASS

- Grep for `api_key|apiKey|secret=|sk_live|sk_test|password=|token=` across `**/*.{ts,tsx}` returned **only** throwaway dev passwords in local seed scripts (`scripts/seed-testfull.ts:12` `"1234"`, `scripts/seed-test-stores.ts:11` `"123456"`) — local seeding only, not credentials. No live API keys/tokens hardcoded.
- No `console.log`/`console.error` of `password|token|secret|key` in `lib/**` (grep: no matches).
- `.env*` not committed (confirmed by infra agent; `.gitignore` excludes `.env*`). `.env.example` holds placeholders only.

---

## Analysis 6: Sensitive Data in Responses — ✅ PASS

- **Password hashes never leave the server.** `loginAction` reads `user.passwordHash` for `verifyPassword` and returns only `{ userId }` (`app/(auth)/actions.ts:32-37`). The override path selects `passwordHash` (`override-data.ts:34`) but consumes it internally in `verifyPassword` (`override-service.ts:65`) and returns only the authorizer's `userId` or `null`. No DTO/response includes `passwordHash`.
- **No leaky entity spread.** The upload route returns only `{ imageUrl }` (`route.ts:61`); super-admin reads project explicit column sets (`select({ ... })`), not `select()` of full user rows toward the client. The one `select()` (all columns) is `getUserByEmail` — server-internal for login, never returned.

---

## Consolidated Issues

### 🔴 Critical
None.

### 🟠 High

#### [SEC-001] `SESSION_SECRET` silently falls back to a public hardcoded default (no fail-fast)
**File:** `lib/auth/session.ts:14`
**Code:**
```ts
function secret(): string {
  return process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me";
}
```
**Impact:** The cookie HMAC key is the *only* thing preventing session forgery (there is no JWT, no server-side session store). If a production deploy ever starts without `SESSION_SECRET` set (empty `/opt/pdv/.env`, typo, new host), the app boots normally using a default string that is committed to the repo and known to anyone. An attacker can then compute `userId.HMAC(userId, "dev-insecure-secret-change-me")` for **any** user id and forge a valid `pdv_session` cookie → full account takeover, and (via a founder id) super-admin + cross-tenant access. Currently latent (prod compose does pass the var) but there is no guardrail to catch a misconfig.
**Fix:** In production, **fail fast** instead of falling back. E.g. throw on startup if `process.env.SESSION_SECRET` is missing/short when `NODE_ENV === "production"`, and keep the dev default only for non-production. Optionally also validate a minimum length.

### 🟡 Medium

#### [SEC-002] `drizzle-kit push` drops RLS policies → silent loss of tenant isolation
**Files:** `CLAUDE.md` (Validation Gates), `scripts/apply-rls.ts`, `db/migrations/*_rls.sql`
**Problem:** `drizzle-kit push` does not know the RLS policies and drops them. RLS is the last line of defense for multi-tenancy; if a bare `db:push` runs in prod/CI without a subsequent `npm run db:rls`, every business table reverts to **no row filtering** and `app_user` could read/write across tenants. The footgun is documented but relies on operator discipline (`db:setup` chains both; a manual `db:push` does not).
**Impact:** Cross-tenant data exposure if the ordering is ever missed during a schema change. Not currently exploitable (assuming `db:setup` was used), but there is no automated guard.
**Fix:** (a) Make the prod migration/deploy path *always* run `db:rls` after any push (single command, no manual step); (b) add a CI/startup assertion that queries `pg_policies` and fails if any business table lacks `tenant_isolation`. (Live verification was out of scope for this static audit — see Analysis 3 caveat.)

#### [SEC-003] High-severity `undici` advisory (carried from infra report)
**Source:** `infrastructure-report.md` [INF-002]. Transitive dep, auto-fixable.
**Impact:** TLS validation bypass / header injection / DoS vectors in a transitive dependency.
**Fix:** `npm audit fix` (non-breaking). Tracked in the infra report; restated here for completeness.

### 🟢 Low

#### [SEC-004] `DATABASE_URL` empty-string fallback
**File:** `db/index.ts:10` — `const connectionString = process.env.DATABASE_URL ?? "";`
**Impact:** Minimal — an empty connection string fails loudly at first DB call rather than silently misbehaving. Cosmetic; consider failing fast at startup for a clearer error.

#### [SEC-005] Login action returns `userId` to the client
**File:** `app/(auth)/actions.ts:37` — `return { ok: true, data: { userId } }`
**Impact:** Negligible — the `userId` is a UUID and confers no access without the HMAC-signed cookie (which is httpOnly and set server-side). Noted only for completeness; not a vulnerability.

---

## RLS Analysis

### Status: Static (source) — complete coverage; live state not introspected

See the full table under **Analysis 3**. All 18 business tables carry a `tenant_isolation` policy scoped to `tenant_id IN (SELECT current_app_tenants())`; identity tables (`users`, `tenants`, `tenant_members`) have self/membership-scoped policies; `platform_settings` is an owner-only founder-gated singleton (no RLS by design). Impersonation is gated by `current_app_is_founder()` in SQL **and** the app layer. No business table lacks a policy in source.

---

## Fix Checklist

### Auth / Secrets
- [ ] [SEC-001] Fail-fast on missing/short `SESSION_SECRET` in production; restrict the dev default to non-prod.

### Multi-Tenancy / RLS
- [ ] [SEC-002] Make prod deploy always re-apply `db:rls` after any schema push; add a `pg_policies` assertion in CI/startup.

### Dependencies
- [ ] [SEC-003] `npm audit fix` to clear the `undici` high advisory.

### Low
- [ ] [SEC-004] Fail fast on empty `DATABASE_URL`.
- [ ] [SEC-005] (Optional) Drop `userId` from the login response.

---

## Priority Recommendations

1. **HIGH:** Add a production fail-fast for `SESSION_SECRET` (SEC-001) — the single most impactful one-line guard against catastrophic session forgery.
2. **MEDIUM:** Automate `db:rls` in the deploy path + add a live RLS-coverage assertion (SEC-002) so the documented `drizzle-kit push` footgun can never silently disable tenant isolation.
3. **MEDIUM:** Run `npm audit fix` for the `undici` advisory (SEC-003).

---

## Scoring

Adapted formula (no Supabase/frontend-DB queries found, no missing RLS, no endpoints without tenant validation, no exposed secrets):

- Frontend querying DB directly: **0** found → 0
- Role check exploitable in frontend: **0** (all permission checks are server-side) → 0
- Endpoint/action without tenant validation: **0** (all server-derived) → 0
- Business table without RLS: **0** → 0
- Exposed secret: **0** → 0
- Additional deductions for stack-specific risks: SESSION_SECRET fallback (High, latent) **−1.5**; RLS-drop footgun + no live verification (Medium) **−0.5**.

**Score = 10 − 2 = 8/10.** 🟢 Good — no Critical/High *active* exploits; two hardening items to close latent risks.

---

*Document generated by the security-analyzer subagent (adapted to the Next.js 16 + Drizzle + Postgres RLS stack).*
