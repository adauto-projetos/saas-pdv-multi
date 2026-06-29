# Context Discovery

**Generated on:** 2026-06-28
**Project:** SAAS PDV.multi — multi-tenant PDV/POS SaaS for hybrid commerce (market + bar + lanchonete)
**Subagent:** Context Discovery (technical audit)

> NOTE: The shared instruction template assumes a NestJS + Supabase monorepo. This project is **not** that stack. This document describes the **actual** stack: a fullstack **Next.js 16 (App Router) monolith** with **Drizzle ORM over postgres-js**, **PostgreSQL**, and **Postgres Row Level Security (RLS)** for tenant isolation. There is **no Supabase, no NestJS, no Radix** (UI is shadcn/ui over Base UI). Authoritative contract: `d:\SAAS PDV.multi\CLAUDE.md`.

---

## Identified Architecture

- **Type:** **Monolith** (single `package.json`, no workspaces/turbo/nx/lerna). Verified: `package.json` has no `workspaces` key; no `turbo.json`/`nx.json` present.
- **Framework:** Next.js 16.2.7 (App Router), React 19.2.4, TypeScript 5. Fullstack: Server Actions (`"use server"`) + Route Handlers (`route.ts`).
- **Build System:** Next.js build (`next build`). No monorepo build orchestrator.
- **ORM / DB:** drizzle-orm 0.45 over `postgres-js` (`postgres` 3.4) → PostgreSQL (Docker local; self-hosted in prod at pdv.art.br/Hetzner).
- **UI:** Tailwind CSS v4, shadcn/ui (style base-nova) over **Base UI** (`@base-ui/react`), `lucide-react`, `sonner`, `next-themes`. (`@radix-ui/react-slot` present only as a shadcn transitive dep — not the component primitive layer.)
- **Auth:** Local — httpOnly cookie with HMAC-SHA256 signed user id + bcrypt password hash (`bcryptjs`). No external auth provider.
- **Validation:** Zod v4.
- **Storage:** Cloudflare R2 (S3 SDK `@aws-sdk/client-s3`) for product photos; `sharp` for image processing.
- **Apps:** N/A (monolith — single app).
- **Libs:** N/A (no `libs/`/`packages/`). Internal modularization is by directory (see Layers below).

### Directory layout (real)

| Directory | Role |
|---|---|
| `app/` | Routes, pages, server actions (`actions.ts`), route handlers (`api/.../route.ts`). Route groups: `(app)` main UI, `(admin)` super admin, `(auth)` login/signup, `api/` REST handlers. |
| `components/` | React UI components (PascalCase + kebab-case files). |
| `lib/services/` | Business logic, organized by domain (products, sales, stock, finance, comanda, profit, print, users, permissions, admin, tenants, subscriptions, storage, audit, platform). |
| `lib/auth/` | Session (cookie+HMAC), password (bcrypt), permissions, admin guard, impersonation, tenant-guard. |
| `lib/validation/` | Zod schemas per domain. |
| `lib/format/` | Money (cents), percent, calendar formatting helpers. |
| `db/` | Drizzle client (`index.ts`), RLS transaction wrapper (`rls.ts`), schema, migrations, RLS tests. |
| `db/schema/` | 22 Drizzle table modules + barrel `index.ts`. |
| `db/migrations/` | SQL migrations incl. 11 dedicated `*_rls.sql` policy files. |
| `scripts/` | `apply-rls.ts` (db:rls), seeds, deploy, r2-check. |
| `types/` | Shared DTO/context types (e.g. `AuthContext`). |
| `docs/` | `features/` (18 feature folders), `product/`, `design/`, `audit/`, `audits/`, `brainstorm/`. |
| `tests/`, `e2e/` | Vitest + Playwright. |

---

## Multi-Tenancy

- **Model:** **Tenant-based** (tenant = `tenants` = "estabelecimento"/store). Enforced at the database layer via **Postgres Row Level Security**, not just application filtering. RLS is treated as the last line of defense.
- **Tenant Identifier (column):** **`tenant_id`** (`uuid`, FK → `tenants.id`, `onDelete: cascade`). Present on **20 of 22** business tables. Only `tenants` (the root) and `users` (global identity) lack `tenant_id`. `platform_settings` carries `tenant_id` per grep but is documented/used as a **global singleton outside RLS** (one-row SaaS config — see its schema comment); auditors should treat it as non-tenant global config.
- **Session identifier injected into DB:** the **authenticated user id**, not the tenant id. Flow:
  1. `lib/auth/session.ts` resolves the user id from the signed `pdv_session` cookie (`getAuthUser()`).
  2. `lib/auth.ts → requireAuthContext()` builds `AuthContext { userId, tenantId, isImpersonating }`; **`tenantId` is resolved server-side from the user→tenant membership (`getUserTenantId`), NEVER from client input** (RN05).
  3. `db/rls.ts → withUserRls(userId, fn)` opens a Drizzle transaction, runs `select set_config('app.current_user_id', userId, true)`, then `set local role app_user`, and executes `fn` inside it.
  4. RLS policies call `current_app_user()` (`db/migrations/0001_rls.sql`), which reads the GUC `app.current_user_id`, and filter rows where `tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = current_app_user())`.
- **Hierarchy:** `users` (global) ──< `tenant_members` (join: `tenant_id` + `user_id`, unique, `role`, `is_active` soft-delete) >── `tenants` (store) ──< all business tables (`tenant_id`). A user can belong to multiple tenants; `tenant_members` is the table RLS consults to resolve membership.
- **Roles (DB):** table owner role `postgres` **bypasses RLS** (used only for onboarding/login/seed/migrations via the `db`/`queryClient` connection in `db/index.ts`). Application requests run under non-privileged role **`app_user`** (NOLOGIN, assumed per-transaction via `SET LOCAL ROLE`). `app_user` has table CRUD grants but no bypass.
- **Session token (not JWT):** auth is a cookie `pdv_session` = `userId.HMAC-SHA256(userId, SESSION_SECRET)`. No JWT, no claims. `SESSION_SECRET` has an insecure dev default (`dev-insecure-secret-change-me`) — flag for security review.
- **Impersonation (super admin / founder):** founder can "enter" a store. Target stored in httpOnly cookie `pdv_impersonate` = `tenant_id` (`lib/auth/impersonation.ts`). Defense-in-depth: cookie only takes effect if user `is_founder` — checked in app (`requireAuthContext` / `withUserRls` via `selectIsFounder`) **and** reinforced in SQL by `current_app_is_founder()`. When impersonating, `withUserRls` also sets GUC `app.impersonate_tenant_id`, and `current_app_tenants()` includes the impersonated tenant.
- **Tenant-scoped uniqueness:** barcode uniqueness is **per tenant** via partial unique index `products_tenant_barcode_unique` on `(tenant_id, barcode)` where barcode is not null (RN01). Each tenant-scoped table also has a `tenant_id` index (e.g. `products_tenant_id_idx`).

### RLS coverage (migrations)

`db/migrations/` contains per-domain RLS policy files: `0001_rls` (users/tenants/tenant_members/products), `0002_sales_rls`, `0003_stock_rls`, `0004_financeiro_rls`, `0005_lucro_rls`, `0006_comanda_rls`, `0007_impressao_rls`, `0008_subscription_rls`, `0009_impersonation_rls`, `0010_usuarios_rls`, `0011_override_rls`. Plus `0008_subscription_lifecycle`. Applied via `scripts/apply-rls.ts` (`npm run db:rls`).

> ⚠️ CRITICAL OPERATIONAL CAVEAT for auditors: `drizzle-kit push` does **not** know the RLS policies and **drops them**. `npm run db:setup` runs `db:push --force` then re-applies RLS. A bare `db:push` leaves tables with RLS disabled until `db:rls` re-runs. This is a real isolation-drift risk worth flagging.

---

## Features/Modules

Modules are organized as service domains under `lib/services/` (logic) + routes under `app/` + Drizzle tables under `db/schema/`. Mapped from `lib/services/`, `app/(app|admin|auth)/`, and `docs/features/`.

| Module | Service path | Routes | Description |
|---|---|---|---|
| auth/session | `lib/auth/` | `app/(auth)/login`, `signup`, `actions.ts` | Local cookie+bcrypt login/signup, session, founder check |
| tenants/onboarding | `lib/services/tenants/` | signup onboarding, `app/(app)/settings` | Store creation, membership, default markup settings |
| products | `lib/services/products/` | `app/(app)/products`, `api/products` | Product CRUD, markup pricing, cost-change preview, photos (R2) |
| sales (venda rápida) | `lib/services/sales/` | `app/(app)/vendas` | Fast market sale, barcode lookup, sale items |
| stock (estoque) | `lib/services/stock/` | `app/(app)/estoque` | Stock levels, movements, low-stock alerts |
| finance (financeiro) | `lib/services/finance/` | `app/(app)/financeiro/{caixa,clientes,customers,pagar,receber}` | Cash, customers, payables, receivables + payments |
| profit/lucro | `lib/services/profit/` | `app/(app)/lucro`, `caixa` | Cash sessions, profit closing/report |
| comanda (mesa/bar) | `lib/services/comanda/` | `app/(app)/comandas` | Table tabs (comandas), comanda items, kitchen order seqs |
| print (impressão) | `lib/services/print/` | (used by sales/comanda) | Receipt/kitchen printing, print logs, printer driver |
| users/operators | `lib/services/users/` | `app/(app)/usuarios` | Operator CRUD, soft-delete, max-operators cap |
| permissions | `lib/services/permissions/` | (cross-cutting) | Per-user permissions, override log/service |
| audit (auditoria) | `lib/services/audit/` | `app/(app)/auditoria` | Audit data/log viewing |
| subscriptions/billing | `lib/services/subscriptions/` | `app/(admin)/superadmin` | Subscription lifecycle, valid_until, suspension |
| admin (super admin) | `lib/services/admin/` | `app/(admin)/superadmin`, `actions.ts` | Founder panel: tenant table, metrics, impersonation, release |
| platform settings | `lib/services/platform/` | super admin | Global singleton: monthly price, max operators (no tenant) |
| storage | `lib/services/storage/` | (used by products) | Cloudflare R2 client (S3 SDK) |

**Feature docs (18):** 0001F product-markup-pricing, 0002F venda-rapida-mercado, 0003F estoque, 0004F financeiro, 0005F lucro-fechamento, 0006F comanda-mesa, 0007F impressao, 0008F sidebar-layout, 0009F page-redesign, 0010F mobile-responsive, 0011F super-admin-billing, 0013F liberacao-meses, 0014F usuarios-permissoes, 0015F manual-ajuda, 0016F fotos-produto, 0017H super-admin-bypass-permissoes (hotfix), 0018F rebrand-logo. (No 0012F folder present.)

---

## Adopted Patterns

| Pattern | Status | Where / Notes |
|---|---|---|
| Layered architecture (UI → actions/handlers → services → data) | ✅ | Enforced per CLAUDE.md. e.g. `app/(app)/products/actions.ts` (`"use server"`) → `lib/services/products/product-service.ts` → `lib/services/products/data.ts` → Drizzle. Inner layers never import outer. |
| Service + data-access split | ✅ | Each domain has `*-service.ts` (logic) + `data.ts`/`*-data.ts` (Drizzle queries). Not a classic Repository class, but a consistent functional data layer. |
| Repository (class-based) | ❌ (functional equivalent) | No `*Repository` classes except `lib/services/subscriptions/repository.ts` and `lib/services/platform/settings-repository.ts` (functional modules named repository). |
| RLS-scoped transactions | ✅ | `db/rls.ts withUserRls()` wraps every tenant-scoped DB op; services call it with `ctx.userId`. |
| Server Actions vs Route Handlers | ✅ | Mutations mostly via Server Actions (`actions.ts`). Route handler used for `app/api/products/[id]/upload/route.ts` (binary image upload). |
| Auth context resolution | ✅ | `requireAuthContext()` central; `tenantId` server-derived, never client-supplied. Permission checks via `lib/auth/permissions.ts` (`requirePermission`/`requireAnyPermission`) and `lib/auth/admin.ts` (founder). |
| Validation at boundary | ✅ | Zod schemas in `lib/validation/*` parsed in actions before service calls. |
| Dependency Injection | ❌ | No DI container. Plain ES module imports (no NestJS `@Injectable`/`@Inject`). |
| CQRS | ❌ | Not used. |
| Event-driven | ❌ | Not used. |
| Money as integer cents | ✅ | Convention enforced (`*_cents` integer columns; `lib/format/money.ts`). |

---

## Frontend/Backend Boundary

This is a fullstack Next.js app — there is no separate frontend/backend deployment. The relevant boundary is **server-only DB access vs. client components**.

- **Expected rule:** Database access (Drizzle, `withUserRls`, services that touch `db`) MUST stay server-side — inside Server Actions (`"use server"`), Route Handlers, or Server Components. Client components (`"use client"`) must only call Server Actions or receive props.
- **Observed reality:** ✅ Boundary is respected. Client components found importing from `lib/services`/`@/db` (`components/products/ProductForm.tsx`, `EditProductForm.tsx`, `components/admin/tenant-table.tsx`, `tenant-status-badge.tsx`, `subscription-history-modal.tsx`, `metrics-cards.tsx`) import only **TYPES** (e.g. `AdminTenantRow`, DTOs) and **Server Action functions** (e.g. `applyCostChangeAction`, `deleteTenantAction`) — not the `db` client or raw query modules. No client component executes Drizzle queries directly.
- **API client:** No centralized HTTP API client (not needed — Server Actions). One REST route handler: `app/api/products/[id]/upload/route.ts`.
- **Auth strategy:** Local signed-cookie session (`pdv_session`, HMAC-SHA256) + bcrypt. Tenant isolation by Postgres RLS under role `app_user`. No external IdP, no JWT.

### Expected validations per request (tenant safety)

- [x] User id resolved server-side from signed cookie (`getAuthUser`), never trusted from client body.
- [x] `tenantId` resolved server-side from `tenant_members` (`requireAuthContext`), never from client input.
- [x] All tenant-scoped DB ops wrapped in `withUserRls(userId, ...)` so RLS filters by `tenant_id`.
- [x] Queries pass `ctx.tenantId` explicitly in the data layer (belt) AND rely on RLS (suspenders).
- [ ] Auditors: confirm EVERY service path actually goes through `withUserRls` (no direct `db.` business reads bypassing RLS outside onboarding/login/seed).

---

## For the Analysis Subagents

### Security Analyzer
- Tenant identifier is the **session `userId`** injected into GUC `app.current_user_id`; tenant column is **`tenant_id`**. Verify each service resolves tenant server-side (`requireAuthContext`) and never reads `tenantId` from client input.
- Verify every tenant-scoped DB operation runs inside `withUserRls` (role `app_user`); flag any business query using the owner `db`/`queryClient` connection directly outside onboarding/login/seed/migrations.
- **Flag:** `SESSION_SECRET` insecure default in `lib/auth/session.ts` (`"dev-insecure-secret-change-me"`) — confirm prod sets it.
- **Flag:** RLS-drop risk — `drizzle-kit push` drops RLS policies; confirm prod/CI always re-runs `db:rls` (uses `db:setup`).
- Review impersonation (`lib/auth/impersonation.ts` + `0009_impersonation_rls.sql`): confirm `is_founder` enforced in BOTH app and SQL (`current_app_is_founder()`), and that a forged `pdv_impersonate` cookie cannot grant access to a non-founder.
- Permission model: `lib/auth/permissions.ts`, `user_permissions`, `override_log` (0014F/0017H). Verify `requirePermission`/`requireAnyPermission` guard all sensitive actions, including super-admin bypass hotfix 0017H.

### Architecture Analyzer
- Verify layer rule (UI → actions/handlers → services → data; inner never imports outer). Spot-check that `actions.ts` files don't query Drizzle directly and that `components/` never import `@/db` query modules.
- Confirm service/data split consistency (`*-service.ts` vs `data.ts`) across all 16 domains.
- Note: no DI/CQRS/event-bus by design — do not flag their absence as debt.

### Data Analyzer
- Confirm all 20 business tables carry `tenant_id` (NOT NULL, FK → tenants, cascade) and a tenant index. Exceptions by design: `users`, `tenants` (root/global). Treat `platform_settings` as a **global singleton outside RLS** despite a `tenant_id`-matching grep.
- Verify each tenant table has a corresponding RLS policy file under `db/migrations/*_rls.sql` (11 policy files cover the domains).
- Money columns are integer cents (`*_cents`); decimals use `numeric(p,s)` (stock qty, markup). Verify no float money.
- Check FK cascade behavior and soft-delete (`tenant_members.is_active`) implications for historical authorship (e.g. `sales.userId`).

---

*Document generated by the Context Discovery subagent. Stack verified against source — no Supabase/NestJS/Radix present.*
