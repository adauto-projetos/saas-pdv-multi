# Architecture Report

**Generated on:** 2026-06-28
**Score:** 8.5/10
**Status:** 🟢 Healthy (minor placement/convention debt)

---

## Summary

The codebase follows its declared layered architecture (UI → server actions/route handlers → services → data → Drizzle/Postgres) with strong discipline: no service imports the UI layer, no `components/` imports the `db` client, and the inner→outer dependency rule holds across all 16 service domains. Money is handled correctly as integer cents everywhere, DB columns are uniformly snake_case, and there are no service-to-service circular dependencies. The notable debt is one super-admin action file that performs raw Drizzle data access directly in the action layer (bypassing the service layer), a small amount of validation defined inline in actions instead of `lib/validation/`, and an inconsistent component-filename convention (PascalCase vs kebab-case).

---

## Analysis Context

Based on `context-discovery.md` and the authoritative `CLAUDE.md` Architecture Contract:
- **Type:** Monolith (single `package.json`, no workspaces/turbo/nx).
- **Stack:** Next.js 16 App Router + React 19 + Drizzle ORM (postgres-js) + PostgreSQL + RLS.
- **Expected layers:** UI (`app/`) → server actions / route handlers → services (`lib/services/`) → data (Drizzle/Postgres). Inner layers never import outer.
- **Placement:** pages/routes `app/`, UI `components/`, business logic `lib/services/`, schema `db/schema/`, DB client+RLS `db/`, auth `lib/auth/`, validation `lib/validation/`.
- **Patterns NOT expected (do not flag as debt):** DI container, CQRS, event bus, class-based Repository. By design.

---

## Layered Architecture

### Dependency Hierarchy (observed)

```
✅ db/schema (Drizzle tables)      → depends on: drizzle-orm only
✅ db/ (client + RLS wrapper)      → depends on: schema + 1 service fn (documented exception, see ARCH-004)
✅ lib/services/ (business logic)  → depends on: db, other services (acyclic orchestration)
✅ app/ (pages, actions, handlers) → depends on: services, validation, auth
✅ components/ (UI)                 → import only TYPES + Server Action functions (no db)
```

### Layer-direction checks (all clean)

| Check | Result | Evidence |
|---|---|---|
| Services import UI (`app/` or `components/`)? | ✅ None | grep over `lib/services/` for `@/app`/`@/components` → no matches |
| `db/` or `db/schema/` import `app/`/`components/`? | ✅ None | grep over `db/` → no UI imports |
| `components/` import `@/db` or `withUserRls`? | ✅ None | grep over `components/` → no matches (client components import types + actions only) |
| Service-to-service cycles? | ✅ None | `lib/services/finance/` does NOT import back from `sales`/`comanda`; flow is one-directional (sales/comanda → finance/stock/products) |

### Violations Found

| Source | Destination | File:line | Severity |
|---|---|---|---|
| action layer | raw Drizzle data access | `app/(admin)/superadmin/actions.ts:6,7,49-63,83-97,115-127,143-147` | 🟠 High |
| action layer | inline Zod (should be `lib/validation/`) | `app/(auth)/actions.ts:14-22`; `app/(app)/caixa/receipt-actions.ts:12` | 🟡 Medium |
| `db/rls.ts` | `lib/services/...` | `db/rls.ts:4` | 🟢 Low (documented, intentional) |

---

## Placement

### Status: Mostly compliant — one significant leak

The single material placement issue is `app/(admin)/superadmin/actions.ts`: it imports the `db` client and the `tenants` schema table directly and runs `db.transaction(...)`, `db.select(...).from(tenants)`, and `tx.update(tenants)` inline (lines 49-63, 83-97, 115-127, 143-147). This is data-layer logic living in the action (UI-adjacent) layer. A `subscriptions/repository.ts` already exists with `updateTenantValidUntil` / `updateTenantSuspendedAt` / `insertSubscriptionLog` helpers — the action duplicates that responsibility inline instead of delegating. Every other `actions.ts` in the project correctly delegates to `lib/services/*` (verified: only this one file matches `.insert(/.update(/.select(` in the `app/` tree).

Note: `app/(app)/caixa/actions.ts:75` and `app/(app)/comandas/actions.ts:166` call `withUserRls(...)` directly, but only to wrap a service helper (`selectTenantName`) for a post-commit side-effect — this is acceptable orchestration, not a data-layer leak.

---

## Money Handling

### Status: ✅ Compliant

| Check | Result | Evidence |
|---|---|---|
| Monetary columns are integer cents | ✅ | 20 `*Cents` integer columns across 8 schema files (`products`, `sales`, `sale-items`, `payables`, `receivables`, `cash-movements`, `*-payments`) |
| No float/`numeric` used as currency | ✅ | `numeric` appears only for non-money: `quantity` (10,3), `markup_percent` (5,2), `stock_quantity` (10,3), `default_markup_percent` (5,2) — quantities & percentages, not prices |
| No floating-point arithmetic on prices | ✅ | Price math uses integer cents with explicit `Math.round`: `markup.ts:15` `Math.round(costCents + (costCents * markupPercent)/100)`; `comanda-service.ts:109` `Math.round(salePriceCents * qty)`; `profit-data.ts:57-58` `Math.round(Number(...))`. `Number(...)` calls materialize `numeric` *quantities*, never money. |

---

## Naming Conventions

| Convention | Status | Violations |
|---|---|---|
| DB tables/columns snake_case | ✅ | 0 — no camelCase quoted column names in `db/schema/` |
| Schema files kebab-case | ✅ | 0 — all `db/schema/*.ts` kebab-case |
| Service files kebab-case | ✅ | 0 — all `lib/services/**/*.ts` kebab-case |
| React component **filenames** kebab-case (per CLAUDE.md) | ⚠️ | ~70 component files use PascalCase filenames (e.g. `components/caixa/BarcodeInput.tsx`, `components/auth/LoginForm.tsx`) while `components/admin/*` uses kebab-case (`delete-store-dialog.tsx`). Inconsistent within the same directory tree. |

Note: PascalCase-for-component-files is a widely accepted React convention; the issue is the **inconsistency** (two conventions coexist) and the deviation from the literal CLAUDE.md rule, not the PascalCase choice itself. Low severity.

---

## Coupling & Code Smells

### Cross-service dependencies (all acyclic, sensible direction)

| Importer | Imports | Verdict |
|---|---|---|
| `sales/sale-service.ts` | finance, products, profit, stock data | ✅ Orchestration (sale touches cash, receivable, stock) |
| `comanda/comanda-service.ts` | finance, products, profit, sales, stock | ✅ Same pattern |
| `admin/tenant-admin-service.ts` | subscriptions/subscription-status | ✅ |
| `users/operator-service.ts` | permissions, platform | ✅ |
| `finance/cash-service.ts` | profit/cash-session-data | ✅ |

No reverse import from `finance/` back into `sales`/`comanda` → no cycle.

### File sizes (>300 lines = smell)

| File | Lines | Note |
|---|---|---|
| `lib/services/print/print-service.ts` | 396 | 🟡 Slightly over — candidate for split (receipt vs kitchen logic) |
| `lib/services/comanda/comanda-service.ts` | 386 | 🟡 Slightly over — largest orchestration service |
| `lib/services/comanda/comanda-data.ts` | 349 | 🟡 Data layer, over threshold |
| `lib/services/products/data.ts` | 307 | 🟡 Marginally over |

All four are marginally over the 300-line guideline; none egregious. No file approaches the "god object" range.

---

## Consistency

| Aspect | Status | Detail |
|---|---|---|
| Server Actions vs Route Handlers | ✅ Consistent | Mutations via Server Actions (`actions.ts`) everywhere; the single Route Handler (`app/api/products/[id]/upload/route.ts`) is justified (binary image upload) |
| `withUserRls` for tenant-scoped access | ✅ Uniform | Tenant-scoped services consistently route through `withUserRls(ctx.userId, ...)`. The documented bypasses (owner `db` connection) are confined to onboarding/login/seed and founder-only super-admin reads. |
| Ad-hoc DB access bypassing the pattern | ⚠️ One spot | `superadmin/actions.ts` uses the owner `db` connection directly (founder-scoped, RLS-bypass is intentional here), but doing it *inline in the action* rather than via the repository is the placement concern (ARCH-001), not a tenant-isolation concern. |
| Service + data-access split (`*-service.ts` / `data.ts`) | ✅ Consistent | Applied across all domains |

---

## Consolidated Issues

### 🟠 High

#### [ARCH-001] Super-admin action performs raw Drizzle data access inline
**File:** `app/(admin)/superadmin/actions.ts:6-7, 49-63, 83-97, 115-127, 143-147`
**Code:**
```typescript
import { db } from "@/db";
import { tenants } from "@/db/schema";
// ...
await db.transaction(async (tx) => {
  await tx.update(tenants).set({ validUntil: newValidUntil, suspendedAt: null })
    .where(eq(tenants.id, tenantId));
  await insertSubscriptionLog(tx, { ... });
});
```
**Problem:** Data-layer logic (transactions, `update`/`select` on `tenants`) lives in the action layer, bypassing `lib/services/`. Every other `actions.ts` delegates to a service; this is the only file in `app/` matching direct `.insert(/.update(/.select(`.
**Impact:** Breaks the layer contract (UI → services → data); duplicates responsibility that `lib/services/subscriptions/repository.ts` already owns (`updateTenantValidUntil`, `updateTenantSuspendedAt`); harder to unit-test the rules (RN02/RN03 month math is interleaved with persistence).
**Fix:** Move the transactional renew/suspend/release/delete persistence into `lib/services/subscriptions/` (or `lib/services/admin/`) functions that accept `(tenantId, months, userId)` and own the `db.transaction` + `insertSubscriptionLog`. The action should validate, call `requireFounder()`, invoke the service, and `revalidatePath`.

---

### 🟡 Medium

#### [ARCH-002] Validation schemas defined inline in actions instead of `lib/validation/`
**File:** `app/(auth)/actions.ts:14-22` (`loginSchema`, `signUpSchema`); `app/(app)/caixa/receipt-actions.ts:12` (`receiptSchema`)
**Problem:** CLAUDE.md places Zod schemas in `lib/validation/`. These auth/receipt schemas are declared inline in the action files. (Most domains correctly use `lib/validation/*` — e.g. `superadmin/actions.ts` imports `releaseMonthsSchema`, `planPriceSchema`.)
**Impact:** Minor inconsistency; validation rules not centralized/reusable.
**Fix:** Extract to `lib/validation/auth.ts` and `lib/validation/print.ts` (or reuse existing).

#### [ARCH-003] Four service files exceed the 300-line guideline
**Files:** `print/print-service.ts` (396), `comanda/comanda-service.ts` (386), `comanda/comanda-data.ts` (349), `products/data.ts` (307)
**Impact:** Mild readability/coupling smell; not critical.
**Fix:** Opportunistic split (e.g. separate receipt vs kitchen printing; split comanda read vs write data). Not urgent.

---

### 🟢 Low

#### [ARCH-004] `db/rls.ts` imports from `lib/services/` (inner→outer)
**File:** `db/rls.ts:4` → `import { selectIsFounder } from "@/lib/services/subscriptions/repository"`
**Problem:** Strictly, the `db/` layer importing a `lib/services/` function inverts the declared direction.
**Impact:** Negligible and intentional — `withUserRls` must check founder status (via owner connection) to decide impersonation. The imported function is a thin owner-DB read with no business logic. Documented in the file's header comment.
**Fix:** Optional — move `selectIsFounder` to a `db/`-level helper or `lib/auth/` to keep `db/` free of `lib/services/` imports. Cosmetic.

#### [ARCH-005] Inconsistent component filename convention
**Files:** ~70 PascalCase component files (e.g. `components/caixa/BarcodeInput.tsx`, `components/auth/LoginForm.tsx`) vs kebab-case in `components/admin/` (`delete-store-dialog.tsx`).
**Problem:** CLAUDE.md mandates kebab-case filenames; two conventions coexist.
**Impact:** Cosmetic; can cause confusion and case-sensitivity issues on Linux deploy (Hetzner) if a file is ever renamed by case only.
**Fix:** Pick one. Either update CLAUDE.md to allow PascalCase for React component files (pragmatic — matches the majority), or rename to kebab-case. Standardize the `admin/` folder to match the rest.

---

## Fix Checklist

### Layer / Placement
- [ ] [ARCH-001] Move super-admin tenant persistence out of `actions.ts` into a service/repository
- [ ] [ARCH-002] Relocate inline auth/receipt Zod schemas to `lib/validation/`

### Code Smells
- [ ] [ARCH-003] Split the 4 over-300-line service files (opportunistic)

### Cosmetic
- [ ] [ARCH-004] Optionally relocate `selectIsFounder` to avoid `db/`→`services/` import
- [ ] [ARCH-005] Standardize component filename casing (and reconcile with CLAUDE.md)

---

## Recommendations

1. **Priority 1 (ARCH-001):** Restore the layer boundary in the super-admin panel — it is the one place data access leaks into the action layer. Low effort (a repository already exists to host it).
2. **Priority 2 (ARCH-002):** Centralize the two stray inline schemas for consistency.
3. **Priority 3:** Decide the component-filename convention once and update CLAUDE.md to match reality (PascalCase is the de-facto majority), eliminating the contradiction.

Overall the architecture is in good shape: layer direction, tenant-access pattern (`withUserRls`), money-as-cents, and snake_case DB naming are all consistently respected. Deductions: -1.0 (ARCH-001 placement/layer leak), -0.25 (ARCH-002 validation placement), -0.25 (ARCH-005 convention inconsistency). **Score = 8.5/10.**

---

*Document generated by the architecture-analyzer subagent.*
