# Architecture Report

**Generated on:** 2026-06-29
**Score:** 8.5/10
**Status:** 🟢 Healthy (with targeted placement fixes)

---

## Summary

The codebase holds the Clean Architecture layer contract well: the **inner layers never import outer layers** — zero `app/` imports inside `lib/services/`, and no `next/cache`/`next/navigation` leakage into services. The `ActionResult`/`toActionError` Result pattern is applied **uniformly across all 14 `actions.ts`** files, validation lives in `lib/validation/`, and money is consistently integer cents. The prior audit's two flagged super-admin issues (raw Drizzle + inline Zod in `app/(admin)/superadmin/actions.ts`) are **fully remediated**. The remaining issues are localized placement violations — raw Drizzle queries that bypass the service/data layer in a few entry points (`caixa/receipt-actions.ts`, both route-group `layout.tsx` files) and one service (`print-service.ts`) — plus a low-severity naming drift in `components/ui/`.

---

## Analysis Context

Based on `context-discovery.md`:
- **Type:** Monolith (single-package fullstack Next.js 16 App Router app)
- **Expected Patterns:** Service layer, Result type, validation-at-boundary, RLS. (CQRS / Repository-generic / DI container intentionally **not** adopted.)
- **Layers:** UI (`app/`) → Server Actions / Route Handlers → services (`lib/services/`) → data (`*-data.ts` / `repository.ts` via `withUserRls`) → Drizzle/Postgres.

---

## Clean Architecture

### Dependency Hierarchy

```
✅ db/ (Drizzle client + RLS)        ← innermost; depends on nothing app-specific
✅ lib/services/<domain>/*-data.ts   ← data access; imports db + db/schema only
✅ lib/services/<domain>/*-service.ts← business logic; imports its data module + AuthContext
✅ app/**/actions.ts (Server Actions)← entry points; import services + validation + auth guards
✅ app/** pages/components           ← UI

Verified: NO inner→outer imports.
  - grep for `@/app/`, `next/cache`, `next/navigation` inside lib/services/ → 0 matches.
  - Services receive `ctx: AuthContext` explicitly (manual DI); never reach into the request/UI layer.
```

### Violations Found (layer / placement)

| Source | Issue | File | Severity |
|--------|-------|------|----------|
| Server Action | Raw Drizzle queries inline, bypasses service+data layer | `app/(app)/caixa/receipt-actions.ts:39-58` | 🟠 High |
| UI layout | Raw Drizzle on the **owner** `db` connection (RLS bypass) inline in UI | `app/(app)/layout.tsx:28-32, 65-73` | 🟠 High |
| UI layout | Raw Drizzle on the owner `db` connection inline in UI | `app/(admin)/layout.tsx:23-27` | 🟡 Medium |
| Service | Raw `tx.select()` inline instead of delegating to `print-data.ts` | `lib/services/print/print-service.ts:192-211, 220-224` | 🟡 Medium |

> Note: `caixa/actions.ts:75` and `comandas/actions.ts:166` import `withUserRls` only to run a single post-commit `selectTenantName(tx, …)` **data-module** call as a print side-effect. They delegate to the data layer, so this is acceptable (not flagged).

---

## CQRS Compliance

### Status: Not applicable (intentionally not adopted — confirmed in `context-discovery.md`)

No command/query split exists and none is expected. No deductions.

---

## Repository Pattern

### Status: ✅ Compliant with the project's chosen "thin data module" convention

The project uses per-domain `*-data.ts` / `repository.ts` modules as a thin data-access layer (not a generic Repository). Verified consistent:

| Check | Status | Details |
|-------|--------|---------|
| Drizzle/schema imports confined to data modules | ⚠️ Mostly | 17 of 20 domains keep all Drizzle in `*-data.ts`/`repository.ts`. Exceptions: `print-service.ts` (raw selects, see ARCH-004), `operator-service.ts` and `permission-service.ts` (`db.transaction(...)` orchestration — acceptable, see below). |
| Data modules contain no business validation | ✅ | Validation lives in actions (Zod) + services (typed `AppError`). |
| Parameterized queries | ✅ | All queries use Drizzle builders / parameterized `sql\`\``. The only raw `sql` template is an advisory lock with a bound parameter (`operator-service.ts:127`). |

> `operator-service.ts:122-148` and `permission-service.ts:55` open a `db.transaction(...)` directly in the service. This is a **legitimate cross-cutting orchestration** (advisory lock + atomic count-then-insert spanning several data helpers `insertOperatorTx` / `countActiveOperators` / `insertPermissions`), not a data-layer bypass — the actual reads/writes still go through data helpers. Not flagged.

---

## Naming Conventions

| Convention | Status | Violations |
|------------|--------|------------|
| Files kebab-case (general) | ✅ | Services, data, validation, db all kebab-case. |
| App React components PascalCase (`components/`, non-ui) | ✅ | 0 violations (e.g. `TenantTable.tsx`, `CashierScreen.tsx`; `.test.tsx` matches the component name). |
| `components/ui/` primitives kebab-case (shadcn convention) | ⚠️ | 7 PascalCase custom primitives mixed with 13 kebab-case shadcn ones (see ARCH-005). |
| Tables/columns snake_case | ✅ | snake_case throughout `db/schema/`. |
| Money as integer cents | ✅ | No `numeric`/float/`parseFloat` for currency in `db/schema/`; all `*Cents` integer columns. |

---

## Coupling

### Dependencies between Modules

| Aspect | Status |
|--------|--------|
| Services importing other services | ✅ Low — composition is via actions (e.g. `caixa/actions.ts` composes `sale-service` + `print-service` + `cash-session-service`), keeping services independent. |
| Circular dependencies | ✅ None observed. |
| Cross-domain imports inside a service | ✅ Minimal — `print-service.ts` reads several schema tables (sales/comanda/products) because printing is inherently cross-domain. |

### Code Smells (file size)

| File | Lines | Assessment |
|------|-------|------------|
| `lib/services/print/print-service.ts` | 396 | Largest non-test service; borderline. Inline raw selects (ARCH-004) inflate it — extracting them to `print-data.ts` would also shrink it. |
| `lib/services/comanda/comanda-service.ts` | 386 | Cohesive (single domain); acceptable. |
| `lib/services/admin/tenant-admin-service.ts` | 298 | Acceptable. |

No service exceeds the 300-line "code smell" threshold in a way that signals a cohesion problem; the two largest are single-domain and cohesive.

---

## Consolidated Issues

### 🟠 High

#### [ARCH-001] Raw Drizzle queries inline in a Server Action (bypasses service + data layer)
**File:** `app/(app)/caixa/receipt-actions.ts:30-81` (queries at `:39-58`)
**Code:**
```typescript
const result = await withUserRls(ctx.userId, async (tx) => {
  const [sale] = await tx.select().from(sales)
    .where(and(eq(sales.id, saleId), eq(sales.tenantId, ctx.tenantId))).limit(1);
  ...
  const lines = await tx.select().from(saleItems).where(...);
  const [tenant] = await tx.select({ name: tenants.name }).from(tenants)...;
});
```
**Impact:** The receipt read logic and its DTO mapping live entirely in the UI/action layer instead of a `sales`/`print` service + data module. It is correctly RLS-scoped and tenant-filtered (so not a security defect), but it violates the layer contract "Server Actions → services → data" and duplicates query logic the sales domain already owns.
**Fix:** Move the read into `lib/services/sales/data.ts` (`selectSaleWithItemsForReceipt(tx, tenantId, saleId)`) and expose a `getSaleReceipt(ctx, saleId)` service that returns the `ReceiptDto`. The action becomes a thin wrapper.

#### [ARCH-002] Raw Drizzle on the owner connection inline in the app layout (UI layer)
**File:** `app/(app)/layout.tsx:28-32` and `:65-73`
**Code:**
```typescript
import { db } from "@/db";        // owner role — bypasses RLS
const [userRow] = await db.select({ email, isFounder }).from(users).where(eq(users.id, user.id))...;
const [tenantRow] = await db.select({ name, validUntil, suspendedAt }).from(tenants).where(eq(tenants.id, tenantId))...;
```
**Impact:** UI layout file performs direct data access against the **RLS-bypassing owner connection**. The queries are key-scoped by id, so the blast radius is limited, but (a) it places data access in the outermost layer and (b) it uses the privileged connection in render code rather than going through a service + `withUserRls`. This is the layer-contract weak point worth tightening; flag also forwarded to the Security agent's attention.
**Fix:** Route through existing services (a small `tenants`/`users` read helper + `subscription-status`) under `withUserRls`, or at minimum a dedicated layout-data helper in `lib/services/`, keeping the owner `db` reserved for login/onboarding/seed/DDL.

### 🟡 Medium

#### [ARCH-003] Raw Drizzle on the owner connection inline in the admin layout (UI layer)
**File:** `app/(admin)/layout.tsx:23-27`
**Code:**
```typescript
const [userRow] = await db.select({ email, isFounder }).from(users).where(eq(users.id, user.id)).limit(1);
```
**Impact:** Same class as ARCH-002 (data access in UI on the owner connection), lower severity because it reads only the current user's own row for a founder gate. Still belongs in an auth/service helper.
**Fix:** Use a `getAuthUserProfile(userId)` helper in `lib/auth/` or `lib/services/`.

#### [ARCH-004] Service performs raw selects instead of delegating to its data module
**File:** `lib/services/print/print-service.ts:192-211` (and `:220-224`)
**Code:**
```typescript
const itemRow = await withUserRls(ctx.userId, async (tx) => {
  const [row] = await tx.select({ ... }).from(comandaItems)
    .leftJoin(products, eq(comandaItems.productId, products.id))
    .where(and(eq(comandaItems.tenantId, ctx.tenantId), eq(comandaItems.id, comandaItemId)))...;
});
```
**Impact:** `print-service.ts` imports `drizzle-orm` and `db/schema` and runs queries inline in `reprintKitchen`, inconsistent with the project's service/data split (a `print-data.ts` already exists for other reads). Couples the service to the schema and inflates the file.
**Fix:** Extract these selects into `print-data.ts` (`selectComandaItemForReprint`, `selectComandaLabel`) and have the service call them.

### 🟢 Low

#### [ARCH-005] Naming-convention drift in `components/ui/`
**Files:** `components/ui/MoneyInput.tsx`, `PageCard.tsx`, `PdvTable.tsx`, `PercentInput.tsx`, `QuantityInput.tsx`, `SectionLabel.tsx`, `StatCard.tsx`
**Problem:** CLAUDE.md states `components/ui/` primitives are kebab-case "to stay aligned with the shadcn CLI". 7 custom primitives are PascalCase while the 13 shadcn-generated ones (`button.tsx`, `card.tsx`, `dialog.tsx`, …) are kebab-case.
**Impact:** Cosmetic inconsistency; no functional effect. Defensible because these are hand-authored (not CLI-generated) project primitives — but the folder now mixes two casings.
**Fix:** Either rename to kebab-case (`money-input.tsx`, …) to match the folder rule, or move custom primitives to a `components/common/` folder and document the exception in CLAUDE.md.

---

## Remediation status of prior audit (2026-06-28)

| Prior finding | Current state | Evidence |
|---|---|---|
| Super-admin actions did raw Drizzle inline | ✅ **Fixed** | `app/(admin)/superadmin/actions.ts` now imports only `lib/services/admin/tenant-admin-service`, `lib/services/platform/settings-repository`; no `drizzle-orm` import. A regression test guards it: `app/(admin)/superadmin/__tests__/actions-no-drizzle.test.ts:28-29` asserts the source has no `from "drizzle-orm"`. |
| Inline Zod schemas in super-admin actions | ✅ **Fixed** | Schemas now imported from `lib/validation/platform` and `lib/validation/subscription` (`actions.ts:21-22`); only `import type { z }` remains in `products/actions.ts:4` and `usuarios/actions.ts:4` (type-only, not inline schemas). |

---

## Fix Checklist

### Clean Architecture / Placement
- [ ] [ARCH-001] Extract receipt read into `sales` service + `data.ts`; thin the action.
- [ ] [ARCH-002] Route app-layout data through a service under `withUserRls`; reserve owner `db` for login/onboarding/seed/DDL.
- [ ] [ARCH-003] Move admin-layout founder lookup into an auth/service helper.

### Service / Data split
- [ ] [ARCH-004] Move `print-service.ts` raw selects into `print-data.ts`.

### Conventions
- [ ] [ARCH-005] Reconcile `components/ui/` casing (rename to kebab or relocate custom primitives + document exception).

---

## Recommendations

1. **Priority 1 — Placement:** Eliminate the three remaining UI/action-layer raw-Drizzle sites (ARCH-001/002/003). The two layout sites also use the RLS-bypassing owner connection; pulling them behind services tightens both the layer contract and the isolation posture (coordinate with the Security agent).
2. **Priority 2 — Consistency:** Finish the service/data split for `print-service.ts` (ARCH-004) so all 20 domains follow the same pattern; consider extending the `actions-no-drizzle` regression test to assert no `drizzle-orm` import in `app/**/*.tsx`/`*.ts` outside `withUserRls` data helpers.
3. **Priority 3 — Cosmetic:** Resolve the `components/ui/` naming drift (ARCH-005).

---

## Scoring

| Deduction | Count | Points |
|---|---|---|
| Raw Drizzle in Server Action bypassing service (ARCH-001) | 1 | −0.5 |
| Owner-connection raw Drizzle in UI layouts (ARCH-002/003) | 2 | −0.5 |
| Service bypassing its data module (ARCH-004) | 1 | −0.25 |
| Convention drift in `components/ui/` (ARCH-005) | 1 | −0.25 |

**Score = 10 − 1.5 = 8.5 / 10**

Strong foundation: inner→outer purity is intact, the Result pattern and money-in-cents rule are universal, and prior audit items are remediated with a regression test. Remaining work is a handful of localized placement fixes, not structural rework.

---

*Document generated by the architecture-analyzer subagent.*
