# Context Discovery

**Generated on:** 2026-06-29
**Project:** SAAS PDV.multi (`d:\SAAS PDV.multi`)
**Version:** 0.13.0 (per `package.json`)

This document is consumed by the downstream Security, Architecture, and Data analysis agents. All findings reflect the **current reality** of the codebase, not aspirations.

---

## Identified Architecture

- **Type:** **Monolith** (single-package fullstack app). No `apps/`, `libs/`, or `packages/` dirs; no `turbo.json`/`nx.json`; `package.json` has no `workspaces` field.
- **Build System:** None (single Next.js app, `next build`).
- **Framework:** Next.js 16.2.7 (App Router), React 19.2.4, TypeScript 5.
- **Runtime mode:** Fullstack — Server Actions (`"use server"`) + Route Handlers (`app/api/.../route.ts`).
- **Apps:** N/A (monolith). The "app" is the root project.
- **Libs:** N/A as separate packages. Internal layering is by directory (see Layers below).

### Top-level layout (load-bearing dirs)
| Path | Role |
|---|---|
| `app/` | Pages, layouts, route handlers, Server Actions (UI + entry points) |
| `components/` | React UI components (`components/ui/` = shadcn primitives) |
| `lib/services/` | Business logic layer (~20 service domains) |
| `lib/auth/` + `lib/auth.ts` | Session (cookie+bcrypt), auth context, permissions, tenant guard, impersonation |
| `lib/validation/` | Zod v4 schemas (one file per domain) |
| `db/` | Drizzle client (`index.ts`), RLS helper (`rls.ts`), `schema/`, `migrations/`, `seeds/` |
| `db/schema/` | Drizzle `pgTable` definitions (one file per table) |
| `db/migrations/` | `*_rls.sql` policy files (NOT Drizzle migrations — push-only strategy) |
| `scripts/` | `apply-rls.ts`, `seed-testfull.ts`, `verify-prod.ts`, `deploy.sh`, `r2-check.ts` |
| `types/` | Shared TS types (e.g. `AuthContext`, DTOs) |
| `tests/`, `e2e/` | Vitest + Playwright |
| `docs/` | `features/`, `product/`, `audit/`, `audits/`, `brainstorm/`, `design/` |

### Layer dependency contract (from CLAUDE.md, verified in code)
```
UI (app/) → Server Actions / Route Handlers → services (lib/services/) → data (Drizzle/Postgres)
```
Inner layers never import outer layers. Verified: `app/(app)/products/actions.ts` calls `lib/services/products/product-service.ts`, which calls its local `data.ts` via `withUserRls`. The service layer never imports from `app/`.

---

## Multi-Tenancy

**This is the single most security-critical aspect of the project.** Multi-tenancy is **enforced at the database level via Postgres Row Level Security (RLS)**, not just application filtering.

- **Model:** **Tenant-based** (each tenant = an "estabelecimento"/store).
- **Tenant Identifier:** `tenantId` (TS) / `tenant_id` (DB column, `uuid`).
- **Hierarchy:** `User` ⇄ `Tenant` is **many-to-many** via the join table `tenant_members` (`db/schema/tenant-members.ts`): `{ tenantId, userId, role (default 'owner'), isActive }`, unique on `(tenant_id, user_id)`. There is **no** Account→Workspace→User hierarchy; the unit of isolation is the tenant directly.
- **"JWT claim" equivalent:** No JWT. Session is a **signed httpOnly cookie** (`pdv_session`) containing the `userId`, HMAC-SHA256 signed with `SESSION_SECRET` (`lib/auth/session.ts`). `tenantId` is **never taken from client input** — it is resolved server-side in `requireAuthContext()` (`lib/auth.ts`) from `tenant_members`.
- **Column in tables:** `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, indexed (e.g. `products_tenant_id_idx`). Present on every business table.

### RLS mechanism (critical detail for Security agent)
- **`db/index.ts`** — the Drizzle client connects as the Postgres **owner role** (`DATABASE_URL`), which **bypasses RLS**. Used only for onboarding/login/seed/DDL.
- **`db/rls.ts` → `withUserRls(userId, fn)`** — wraps work in a transaction that:
  1. `set_config('app.current_user_id', userId, true)` (transaction-local GUC),
  2. optionally `set_config('app.impersonate_tenant_id', ...)` for founder impersonation,
  3. `SET LOCAL ROLE app_user` (a `NOLOGIN` role **without** bypass privilege).
- **`db/migrations/0001_rls.sql`** defines `current_app_user()` (reads the GUC) and per-table policies. Example policy `tenant_isolation` on `products`: `tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = current_app_user())` for both `USING` and `WITH CHECK`.
- **Impersonation (super-admin/founder):** double-checked — app-side founder check **plus** SQL-side `current_app_is_founder()` — so a forged impersonation cookie cannot grant a non-founder cross-tenant access (see `db/rls.ts` doc comment, feature 0017H/0011F).
- **⚠️ Known operational hazard:** `drizzle-kit push` drops RLS policies (it doesn't know them). `npm run db:rls` (or `db:setup`) must be re-run after any push. This is the main risk to the isolation guarantee.

### RLS policy coverage (per `db/migrations/*_rls.sql`)
`0001_rls` (users, tenants, tenant_members, products), `0002_sales`, `0003_stock`, `0004_financeiro`, `0005_lucro`, `0006_comanda`, `0007_impressao`, `0008_subscription` (+ `0008_subscription_lifecycle`), `0009_impersonation`, `0010_usuarios`, `0011_override`.
**Data agent should verify** every table in `db/schema/index.ts` has a corresponding RLS policy and a `tenant_id` index.

### Schema tables (22, from `db/schema/index.ts`)
`users`, `tenants`, `tenant_members`, `user_permissions`, `override_log`, `products`, `sales`, `sale_items`, `stock_movements`, `customers`, `cash_movements`, `receivables`, `receivable_payments`, `payables`, `payable_payments`, `cash_sessions`, `comandas`, `comanda_items`, `print_logs`, `kitchen_order_seqs`, `subscriptions`, `platform_settings`.

---

## Features / Modules

### Service domains (`lib/services/`)
| Domain | Path | Description |
|---|---|---|
| products | `lib/services/products/` | Product CRUD, markup/pricing, images (R2) |
| sales | `lib/services/sales/` | Quick sale (mercado), lookup, sale recording |
| stock | `lib/services/stock/` | Stock movements and levels |
| finance | `lib/services/finance/` | Cash, customers, receivables, payables (ledgers) |
| profit | `lib/services/profit/` | Profit / cash-session closing reports |
| comanda | `lib/services/comanda/` | Table/tab (bar) order management |
| print | `lib/services/print/` | Receipt/kitchen printing, printer driver, print logs |
| tenants | `lib/services/tenants/` | Onboarding (signup creates tenant+member), settings |
| usuarios/users | `lib/services/users/` | Operators (soft-deletable members) |
| permissions | `lib/services/permissions/` | Per-user permission codes + override log |
| subscriptions | `lib/services/subscriptions/` | Tenant status, founder check, renewal/lifecycle |
| admin | `lib/services/admin/` | Super-admin tenant administration |
| platform | `lib/services/platform/` | Platform-wide settings (e.g. max operators) |
| audit | `lib/services/audit/` | Audit trail service |
| storage | `lib/services/storage/` | Cloudflare R2 S3 client (product photos) |

### App routes (`app/`)
- **`app/(auth)/`** — `login`, `signup`, `actions.ts` (cookie session entry).
- **`app/(app)/`** — authenticated app: `vendas`, `products`, `estoque`, `financeiro` (`caixa`/`clientes`/`customers`/`pagar`/`receber`), `caixa`, `comandas`, `lucro`, `usuarios`, `auditoria`, `settings`, `perfil`, `manual`.
- **`app/(admin)/superadmin/`** — super-admin panel: `actions.ts`, `impersonation-actions.ts` (founder impersonation).
- **`app/api/products/[id]/upload/route.ts`** — the only Route Handler (product photo upload to R2).

### Delivered features (`docs/features/`, 22 dirs; ID 0012 intentionally skipped)
| ID | Slug | Theme |
|---|---|---|
| 0001F | product-markup-pricing | Product/markup/pricing (cents, barcode unique per tenant) |
| 0002F | venda-rapida-mercado | Quick market sale |
| 0003F | estoque | Stock control |
| 0004F | financeiro | Finance (cash, receivables, payables, customers) |
| 0005F | lucro-fechamento | Profit & cash-session closing |
| 0006F | comanda-mesa | Bar tabs / table orders |
| 0007F | impressao | Receipt / kitchen printing |
| 0008F | sidebar-layout | Sidebar layout |
| 0009F | page-redesign | Page redesign |
| 0010F | mobile-responsive | Mobile responsiveness |
| 0011F | super-admin-billing | Super admin + billing/subscriptions |
| 0013F | liberacao-meses | Month release / renewal control |
| 0014F | usuarios-permissoes | Users & permissions (operators, soft-delete) |
| 0015F | manual-ajuda | In-app help/manual |
| 0016F | fotos-produto | Product photos (Cloudflare R2) |
| 0017H | super-admin-bypass-permissoes | Hotfix: super admin permission bypass during impersonation |
| 0018F | rebrand-logo | Rebrand / logo |
| 0019H | seguranca-deploy | Hotfix: security & deploy hardening (remediation unit 1) |
| 0020F | camada-dados-services | Data + services layer extraction (remediation unit 2) |
| 0021C | doc-convencoes | Chore: docs & conventions (remediation unit 3) |
| 0022C | xray-patterns | Chore: x-ray & project-patterns skill |

> Note: `docs/features/` contains feature/hotfix/chore docs (`about.md`, `discovery.md`, `plan.md`, `changelog.md`). The "19 features delivered" count in CLAUDE.md refers to the `F`-suffixed entries.

---

## Adopted Patterns

| Pattern | Status | Where / Notes |
|---|---|---|
| CQRS | ❌ | No commands/queries split. |
| Repository | ⚠️ Partial | Per-domain `data.ts` / `*-data.ts` / `repository.ts` modules act as a thin data-access layer (e.g. `lib/services/products/data.ts`, `lib/services/subscriptions/repository.ts`). Not a formal generic Repository pattern. |
| Service layer | ✅ | `lib/services/<domain>/<domain>-service.ts` holds business logic; called by Server Actions. Clear UI→action→service→data layering enforced. |
| Clean Architecture (strict) | ⚠️ Partial | Layer boundaries respected (inner never imports outer) but no ports/adapters/use-case formalism. |
| Dependency Injection | ❌ Manual | No DI container (not NestJS). Services import their `data` modules directly; `AuthContext` is passed explicitly as the first arg (`ctx: AuthContext`). |
| Event-driven | ❌ | No event bus / handlers. |
| Result type | ✅ | Server Actions return `ActionResult<T>` (`lib/services/errors.ts`); typed `AppError` subclasses (`ConflictError`, `NotFoundError`, `UnauthorizedError`, `TenantLockedError`) mapped via `toActionError`. |
| Validation at boundary | ✅ | Zod schemas in `lib/validation/` `safeParse` inputs at the Server Action entry before hitting services. |
| Money as integer cents | ✅ | `integer` cents columns + check constraints (`products_cost_cents_non_negative`); never float. |
| Permission guards | ✅ | `requirePermission` / `requireAnyPermission` (`lib/auth/permissions.ts`) and `requireActiveTenant` (`lib/auth/tenant-guard.ts`) run inside actions before the service call. |

---

## Frontend / Backend Boundary

This is a **fullstack monolith**, so there is no separate frontend app calling a remote API. The boundary is **UI components → Server Actions / Route Handlers → services**.

- **No direct DB access from UI/client:** All data access flows through Server Actions or Route Handlers, then services, then `withUserRls`. There is **no Supabase** (auth is local cookie+bcrypt). Client components never touch Drizzle.
- **API client:** N/A (Server Actions invoked directly). The only HTTP Route Handler is `app/api/products/[id]/upload/route.ts`.
- **Auth Strategy:** Local — signed httpOnly cookie (`pdv_session`, HMAC-SHA256 via `SESSION_SECRET`) + bcrypt password hashing. `SESSION_SECRET` **fails fast in production** if absent/weak/equal to dev default (`lib/auth/session.ts`).
- **Auth context resolution:** `requireAuthContext()` (`lib/auth.ts`) returns `{ userId, tenantId, isImpersonating }`. `tenantId` is resolved server-side from `tenant_members` (or impersonation for founders) — **never from client input**.

### Expected validations per write request (the canonical action pipeline)
Verified in `app/(app)/products/actions.ts` and consistent across actions:
- [x] Zod `safeParse` of the input (reject with `fieldErrors` on failure)
- [x] `requireAuthContext()` — session present, tenant resolved (`UnauthorizedError` otherwise)
- [x] `requirePermission(ctx, <code>)` — operator permission check
- [x] (write/billing-sensitive) `requireActiveTenant(tenantId)` — blocks `status='travada'` tenants
- [x] Service runs under `withUserRls(ctx.userId, ...)` so RLS filters by `tenant_id`
- [x] `tenantId` injected from `ctx`, never from input (RN05)

---

## For the Analysis Subagents

### Security Analyzer
- **RLS is the core control.** Confirm every business table both (a) appears in a `db/migrations/*_rls.sql` policy file and (b) has `ENABLE ROW LEVEL SECURITY` with `USING`+`WITH CHECK` scoped via `tenant_members` subquery. Flag any table in `db/schema/index.ts` with no matching policy.
- Verify the **owner connection** (`db/index.ts`, RLS bypass) is used only for login/onboarding/seed/DDL — never for tenant business reads/writes (those must go through `withUserRls`).
- Audit the **impersonation path** (`db/rls.ts`, `app/(admin)/superadmin/impersonation-actions.ts`): confirm the double founder check (app + `current_app_is_founder()`) and that the impersonation cookie cannot be forged into access (features 0011F/0017H).
- Verify every Server Action calls `requireAuthContext()` + the appropriate `requirePermission`/`requireActiveTenant` guard, and that `tenantId` is never read from client input.
- Check `SESSION_SECRET` fail-fast, cookie flags (`httpOnly`, `secure` in prod, `sameSite=lax`), and bcrypt usage (`lib/auth/password.ts`).
- R2 photo uploads (`app/api/products/[id]/upload/route.ts`, `lib/services/storage/r2-client.ts`): validate auth, tenant scoping of the image key, and content/type limits.

### Architecture Analyzer
- Confirm the layering UI→action→service→data holds everywhere (no `app/` import inside `lib/services/`, no Drizzle import inside client components).
- Check consistency of the per-domain `service.ts` + `data.ts` split; flag domains that bypass their data module or call Drizzle directly from the service.
- Verify `ActionResult`/typed-error pattern is used uniformly across all `actions.ts`.
- Note conventions to enforce: kebab-case files (except `components/` app components in PascalCase and `components/ui/` shadcn primitives in kebab-case), snake_case tables/columns.

### Data Analyzer
- Verify every table has `tenant_id uuid NOT NULL` (FK to `tenants`, `ON DELETE CASCADE`) **and** an index on `tenant_id` (pattern: `<table>_tenant_id_idx`).
- Verify money columns are `integer` cents with non-negative `check` constraints; flag any `numeric`/float used for currency.
- Check ledger/movement tables (`stock_movements`, `cash_movements`, `receivable_payments`, `payable_payments`, `override_log`, `print_logs`) for append-only integrity and correct FKs.
- Confirm the **push-only** schema strategy: `db/schema/` is source of truth; `db/migrations/*_rls.sql` are RLS policies applied by `scripts/apply-rls.ts`, NOT Drizzle migrations. There is no `db:migrate`.
- Validate per-tenant uniqueness constraints (e.g. `products_tenant_barcode_unique` is partial on `barcode IS NOT NULL`) rather than global uniqueness.

---

*Document generated by the context-discovery subagent.*
