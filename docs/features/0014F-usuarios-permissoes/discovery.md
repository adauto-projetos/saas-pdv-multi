---
feature: 0014F-usuarios-permissoes
title: Feature Discovery — Operators + Granular Permissions
created: 2026-06-26
updated: 2026-06-26
status: discovery
type: feature-discovery
---

# Discovery: 0014F — usuarios-permissoes (Operators + Granular Permissions)

## Summary

{"complexity":"high","scope":["users-table-retrofit","tenant-members-operators","permission-model","author-tracking","sensitive-overrides","operator-limit","rls-enforcement"],"affected_layers":["database","backend-services","frontend-actions","rls-policies"],"critical_deps":["tenant-members.role exists","platform-settings.max_operators field","auth context + withUserRls pattern"],"prerequisites_missing":["max_operators field in platform-settings","user_permissions table + RLS policy"],"risks":["rls-policy-complexity","operator-escalation-edge-cases","soft-delete-of-operators-history-impact"]}

---

## Related Features

| Feature | Relationship | Why it matters | Key files |
|---------|--------------|-------------------|-----------|
| **0011F** | prerequisite + integration | Operator limit stored in `platform-settings` (confirmed: table exists). Super admin panel (SF02) edits pricing; must extend to operator limit field. | `db/schema/platform-settings.ts`, `app/(admin)/superadmin/actions.ts` |
| **0002F** | extends + author-tracking | Sales already record `userId` (the operator). Permission "Vendas" will gate `/caixa` route. | `db/schema/sales.ts:30` |
| **0005F** | extends + author-tracking + sensitive | Cash open/close already record `openedBy` / `closedBy`. Permission "Caixa"; close operation may need override framework. | `db/schema/cash-sessions.ts:41,45` |
| **0006F** | extends + author-tracking + sensitive | Comanda already records `openedBy` / `closedBy`. Permission "Comanda"; removeItem/cancel operations may need override gate. | `db/schema/comandas.ts:38,44` |
| **0004F** | extends + sensitive | Cash movements already record `userId`. Permission "Financeiro" gates operations; sangria/suprimento may need override. | `db/schema/cash-movements.ts:38` |
| **0003F** | extends + author-tracking | Stock movements already record `userId`. Permission "Estoque" gates operations. | `db/schema/stock-movements.ts:44` |
| **0001F** | shares-data | Products exist; price visibility is protected. Permission "Produtos" gates admin views. | `db/schema/products.ts` |

---

## Technical Context

### Stack (per CLAUDE.md)

- **Auth:** Local (cookie httpOnly + bcrypt), NO Supabase
- **Session:** Cookie `pdv_session` (HMAC-SHA256 signed userId), 30-day max-age
- **Multi-tenancy:** Row Level Security (RLS) on Postgres; `app_user` role assumes per-transaction; `current_app_user()` function resolves user; `withUserRls(userId, async (tx) => ...)` injects user into GUC `app.current_user_id`
- **ORM:** Drizzle + postgres-js
- **Validation:** Zod v4
- **Actions:** Server actions + route handlers, all call `requireAuthContext()` then `withUserRls(ctx.userId, ...)`

### Key Patterns

1. **Auth context assembly** (`lib/auth.ts:requireAuthContext()`): Reads session cookie → `getAuthUser()` → resolves tenant via `getUserTenantId()` (from `tenant_members`) → returns `{ userId, tenantId }`
2. **RLS enforcement** (`db/rls.ts:withUserRls()`): Wraps all data ops in a transaction that sets GUC `app.current_user_id=${userId}` + assumes role `app_user`; policies filter by `current_app_user()` result
3. **Multi-tenancy guarantee** (`db/migrations/0001_rls.sql`): Every table with business data has a RLS policy; tenant_members has non-recursive policy `user_id = current_app_user()` (line 71-76) — operators can ONLY see/edit their own record
4. **Founder protection** (`lib/auth/admin.ts:requireFounder()`): Checks `users.isFounder` column before allowing super admin actions; used in `app/(admin)/superadmin/actions.ts` and impersonation logic

---

## Codebase Analysis — The 7 Questions

### 1. Auth & Session

**How login/session works:**
- Login page (`app/(auth)/login/page.tsx`): email + password form
- Authenticated via `lib/auth/session.ts`: `getAuthUser()` reads signed cookie, verifies HMAC, returns `{ id: userId }`
- Session **created** at `lib/auth/session.ts:37-46`: `createSession(userId)` sets cookie with `sign(userId)` (userId + HMAC-SHA256 on `SESSION_SECRET`)
- Session **verified** at `lib/auth/session.ts:22-35`: `verify(token)` checks HMAC with timing-safe comparison

**How user is resolved in server actions:**
- Every action starts: `const ctx = await requireAuthContext()` (`lib/auth.ts:18-36`)
- `requireAuthContext()` calls `getAuthUser()` → reads session → calls `getUserTenantId(user.id)` → looks up ONE row in `tenant_members WHERE user_id=${userId}` (line 55-61 of `lib/services/tenants/onboarding.ts`) → returns `{ userId, tenantId }`
- **Note:** No permission column consulted yet; only tenant membership

**How `withUserRls` / `db/rls.ts` injects user id:**
- Called as `withUserRls(ctx.userId, async (tx) => { ... })` (line 25-43 of `db/rls.ts`)
- Opens a transaction, executes: `SET app.current_user_id=${userId}` (line 33), `SET ROLE app_user` (line 40)
- Both `SET LOCAL` — scoped to the transaction only, never leak between connection pool requests
- The `current_app_user()` SQL function (`db/migrations/0001_rls.sql:27-30`) reads this GUC and returns the uuid

**Current notion of role:**
- **Global:** `users.isFounder` (boolean, line 19 of `db/schema/users.ts`) — marks the platform owner (super admin)
- **Per-tenant:** `tenant_members.role` (text, line 24 of `db/schema/tenant-members.ts`) — currently only value is `"owner"` (set at signup, `lib/services/tenants/onboarding.ts:29`)
- **NO permission checks exist today** — zero guards in services or actions; 0014F adds them

### 2. Users vs Tenant-Members — Where does role/ownership live?

**`db/schema/users.ts` (lines 8-20):**
```
id: uuid PK
email: text UNIQUE (global)
passwordHash: text
createdAt: timestamp
isFounder: boolean DEFAULT false
```
- **Purpose:** Authentication table. Global scope — one row per email worldwide.
- **Ownership:** `isFounder` marks the PLATFORM owner (founder, not store owner). Set via seed (`FOUNDER_EMAIL` env var).
- **Unique constraint:** email is globally unique (line 12: `.unique()`)

**`db/schema/tenant-members.ts` (lines 12-33):**
```
id: uuid PK
tenantId: uuid FK → tenants.id (CASCADE)
userId: uuid FK → users.id (CASCADE)
role: text DEFAULT "owner"
createdAt: timestamp
updatedAt: timestamp
UNIQUE(tenantId, userId)
```
- **Purpose:** Bridge table — links users to stores. Per-tenant scope.
- **Ownership:** The user who created the store has `role="owner"` (only value today; 0014F will add "operator")
- **Store owner identification:** Query `tenant_members WHERE role='owner'` for the store
- **Soft-delete column:** NO `is_active` column yet — this is a **prerequisite** for 0014F (operators must be deactivatable, not deleted)

**Email uniqueness:** Globally unique (in `users` table), so one email maps to ONE user_id worldwide. A single user (email) can join multiple stores via multiple tenant_members rows.

**RLS isolation of tenant-members (line 71-76, `db/migrations/0001_rls.sql`):**
```sql
CREATE POLICY "tenant_member_isolation" ON "tenant_members"
  FOR ALL TO app_user
  USING ("user_id" = current_app_user())
  WITH CHECK ("user_id" = current_app_user());
```
- Operator can ONLY see/edit their OWN tenant_members row(s)
- Cannot see or modify OTHER users' rows in the same tenant
- This is NON-RECURSIVE — does not subquery tenants

### 3. Platform-Settings & Operator Limit

**`db/schema/platform-settings.ts` (lines 18-42):**
```
id: uuid PK
singleton: boolean UNIQUE DEFAULT true (guards singleton)
monthlyPriceCents: integer DEFAULT 0
updatedAt: timestamp
updatedBy: uuid FK → users.id (nullable)
CHECK: singleton = true (ensures only 1 row in table)
```
- **Current fields:** Monthly subscription price only
- **Operator limit field:** **DOES NOT EXIST** — this is a **prerequisite** for operator-limit sub-scope of 0014F
- **Access control:** No RLS (not per-tenant data) — accessed via owner `db` connection; reads/writes protected by `requireFounder()` in actions

**Super admin panel (`app/(admin)/superadmin/page.tsx` and `actions.ts`):**
- Reads settings: `setMonthlyPlanPriceCents(parsedData.priceCents, userId)` (line 172 of `app/(admin)/superadmin/actions.ts`)
- Service: `lib/services/platform/settings-repository.ts` handles the upsert
- **Action pattern:** `await requireFounder()` → validate input (zod) → call service → `revalidatePath("/superadmin")`
- **Conclusion:** Panel structure exists; adding a new field (`maxOperatorsCounts` or similar) is a straightforward extension

### 4. Author-Tracking Columns — Which tables need retrofitting?

| Table | Column | Present? | FK target | Notes |
|-------|--------|----------|-----------|-------|
| **sales** | `userId` | ✅ Line 30 | users.id | Operator who finalized the sale (RN08) |
| **cash_sessions** | `openedBy` | ✅ Line 41 | users.id | Operator who opened the cash session |
| **cash_sessions** | `closedBy` | ✅ Line 45 | users.id | Operator who closed the cash session |
| **comandas** | `openedBy` | ✅ Line 38 | users.id | Operator who opened the comanda (RN10) |
| **comandas** | `closedBy` | ✅ Line 44 | users.id | Operator who closed the comanda |
| **stock_movements** | `userId` | ✅ Line 44 | users.id | Operator who performed the movement (RN02) |
| **cash_movements** | `userId` | ✅ Line 38 | users.id | Operator who performed the movement (RN02) |

**Verdict:** ALL tables already record author. **NO retrofit needed for column creation.**

### 5. Sensitive Actions (desconto/estorno/cancelamento)

**Cancellation / removal actions exist:**

1. **`removeComandaItem`** (`lib/services/comanda/comanda-service.ts:123-158`)
   - Removes a line item from an open comanda
   - Estorna (reverses) the stock
   - Service: `removeComandaItem(ctx, input)` — takes `comandaId` + `itemId`
   - Action: `removeComandaItemAction` (`app/(app)/comandas/actions.ts:85-100`)
   - **Permission gate needed:** "Comanda" (removing items is a manager decision)

2. **`cancelComanda`** (`lib/services/comanda/comanda-service.ts:166-208`)
   - Marks entire comanda as 'cancelada' (status column)
   - Estorna all items
   - Service: `cancelComanda(ctx, input)` — takes `comandaId`
   - Action: `cancelComandaAction` (see actions.ts)
   - **Permission gate needed:** "Comanda" (canceling a table is sensitive)

3. **Cash close operation** (`lib/services/profit/cash-session-service.ts` — not read, but referenced in past-features.md and 0005F)
   - Closes the cash session (finalizeCashSession or similar)
   - **Permission gate needed:** "Caixa"
   - **Override needed?** Close of cash is sensitive (initiates reconciliation); brainstorm mentions override for this

**Discount logic:** NOT FOUND in codebase yet. The brainstorm mentions "desconto" as a sensitive action, but there's no existing discount feature. **This is a NEW action to be built** as part of the override framework.

**Refund (estorno) logic:** 
- Estorno in stock context: `recordComandaEstorno` / `recordSaleExit` — reversals of stock movements
- **These are NOT user-facing actions yet** (no standalone "refund" endpoint); they're called internally by cancelComanda / sales cancellation
- **If a standalone refund action is planned**, it needs the override gate

**Conclusion:** 
- Cancelation + removal actions exist; no discount feature exists yet
- **Override framework applies to:**
  - `removeComandaItem` (Comanda permission)
  - `cancelComanda` (Comanda permission)
  - Cash close (Caixa permission)
  - Future discount / refund endpoints (new, to be built)

### 6. Service & Action Layer Pattern

**Pattern:** Service methods take `AuthContext` + input, call `withUserRls(ctx.userId, async (tx) => ...)`. All server actions call `requireAuthContext()` first.

**Example 1: openComanda** (represents most operations)

Service (`lib/services/comanda/comanda-service.ts:39-49`):
```typescript
export async function openComanda(
  ctx: AuthContext,
  input: OpenComandaInput,
): Promise<ComandaDto> {
  return withUserRls(ctx.userId, async (tx) => {
    const row = await data.insertComanda(tx, ctx.tenantId, ctx.userId, input.label);
    const dto = await data.selectComandaById(tx, ctx.tenantId, row.id);
    return dto!;
  });
}
```

Action (`app/(app)/comandas/actions.ts:37-54`):
```typescript
export async function openComandaAction(
  input: unknown,
): Promise<ActionResult<ComandaDto>> {
  const parsed = openComandaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error.issues[0]?.message) };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    const comanda = await openComanda(ctx, parsed.data);
    revalidatePath("/comandas");
    return { ok: true, data: comanda };
  } catch (error) {
    return toActionError(error);
  }
}
```

**Permission gate insertion point:** Between `requireAuthContext()` and the service call:
```typescript
// NEW: Permission check
const allowed = await requirePermission(ctx, "Comanda");
if (!allowed) throw new UnauthorizedError("Permissão 'Comanda' necessária");

const comanda = await openComanda(ctx, parsed.data);
```

**Helper function (to be created in `lib/auth/` or `lib/services/permissions/`):**
```typescript
export async function requirePermission(
  ctx: AuthContext,
  permissionCode: "Vendas" | "Comanda" | "Caixa" | ... ,
): Promise<boolean> {
  return withUserRls(ctx.userId, async (tx) => {
    const [row] = await tx
      .select({ granted: userPermissions.granted })
      .from(userPermissions)
      .where(
        and(
          eq(userPermissions.tenantId, ctx.tenantId),
          eq(userPermissions.userId, ctx.userId),
          eq(userPermissions.code, permissionCode),
        ),
      )
      .limit(1);
    return row?.granted === true;
  });
}
```

**Conclusion:** Permission checks will plug in cleanly AFTER `requireAuthContext()` and BEFORE the service call. No service refactoring needed.

### 7. RLS Pattern — How to extend for permissions

**Current RLS model (line 79-93, `db/migrations/0001_rls.sql`):**
```sql
DROP POLICY IF EXISTS "tenant_isolation" ON "products";
CREATE POLICY "tenant_isolation" ON "products"
  FOR ALL TO app_user
  USING (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
    )
  )
  WITH CHECK (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
    )
  );
```
- Filters by: "Is this user a member of this tenant?"
- Applies to all DML (SELECT, INSERT, UPDATE, DELETE)

**New `user_permissions` table structure:**
```
id: uuid PK
tenantId: uuid FK → tenants.id (CASCADE)
userId: uuid FK → users.id (CASCADE)
code: text (enum: Vendas, Comanda, Caixa, Produtos, Estoque, Financeiro, Loja)
granted: boolean (permission is ON)
isActive: boolean DEFAULT true (can soft-deactivate without deleting operator)
createdAt: timestamp
updatedAt: timestamp
UNIQUE(tenantId, userId, code)
```

**RLS policy for `user_permissions`:**
```sql
DROP POLICY IF EXISTS "user_permissions_owner_only" ON "user_permissions";
CREATE POLICY "user_permissions_owner_only" ON "user_permissions"
  FOR ALL TO app_user
  USING (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
        AND "role" = 'owner'  -- Only OWNERS can manage permissions
    )
  )
  WITH CHECK (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
        AND "role" = 'owner'
    )
  );
```

**Alternative (more granular): Add permission check for "manage users"**
```sql
CREATE POLICY "user_permissions_managers_only" ON "user_permissions"
  FOR ALL TO app_user
  USING (
    "tenant_id" IN (
      SELECT tm."tenant_id" FROM "tenant_members" tm
      LEFT JOIN "user_permissions" up
        ON up."tenant_id" = tm."tenant_id"
        AND up."user_id" = tm."user_id"
        AND up."code" = 'gerenciar-usuarios'
      WHERE tm."user_id" = current_app_user()
        AND (tm."role" = 'owner' OR up."granted" = true)
    )
  )
  WITH CHECK (
    "tenant_id" IN (
      SELECT tm."tenant_id" FROM "tenant_members" tm
      LEFT JOIN "user_permissions" up
        ON up."tenant_id" = tm."tenant_id"
        AND up."user_id" = tm."user_id"
        AND up."code" = 'gerenciar-usuarios'
      WHERE tm."user_id" = current_app_user()
        AND (tm."role" = 'owner' OR up."granted" = true)
    )
  );
```

**Anti-escalation RLS:** To prevent an operator from granting permissions they lack, the policy above restricts to "owner OR has gerenciar-usuarios". An operator without "gerenciar-usuarios" sees zero rows and cannot INSERT/UPDATE/DELETE.

**Conclusion:** RLS for `user_permissions` fits cleanly. A new migration file (`0010_user_permissions_rls.sql` or similar) will define the table + policy.

---

## Pre-Decided by Codebase

### Auth Mechanism (Fixed)
- Email + password (local, cookie-based)
- Session via signed HMAC cookie (not OAuth, not Supabase)
- No change possible without major refactor

### Where Role Lives (Fixed)
- **Store owner (role = "owner"):** `tenant_members.role` column (already exists, line 24)
- **Global founder:** `users.isFounder` column (already exists, line 19)
- **Operator permissions (NEW):** Will live in new `user_permissions` table (per-tenant, granular)

### Tenant Isolation Mechanism (Fixed)
- Row Level Security (RLS) on Postgres with `app_user` role
- `withUserRls(userId, fn)` pattern is mandatory for all operations
- Every business table already has an RLS policy filtering by `tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = current_app_user())`

### Action Pattern (Fixed)
- All server actions: `requireAuthContext()` → `requireActiveTenant()` → service call wrapped in `withUserRls()`
- Permission checks will insert between `requireAuthContext()` and service call

### Author Tracking (Fixed)
- All sensitive tables already have `userId` / `openedBy` / `closedBy` columns
- No schema retrofit for author tracking needed

---

## Confirmed vs Refuted Hypotheses (from past-features.md)

| Hypothesis | Status | Finding |
|-----------|--------|---------|
| **platform-settings EXISTS and has operator-limit field** | ❌ Partially true | Table EXISTS (`db/schema/platform-settings.ts`). Field `monthlyPriceCents` only — **`max_operators` DOES NOT EXIST**. Adding it is a **prerequisite** for operator-limit sub-scope. |
| **users vs tenant-members split** | ✅ Confirmed | `users` = global auth, `tenant_members` = per-tenant membership + role. Role="owner" is set at signup; no is_active column yet. |
| **Author columns exist** | ✅ Confirmed | ALL tables (sales, cash_sessions, comandas, stock_movements, cash_movements) already record `userId`/`openedBy`/`closedBy`. **NO retrofit needed.** |
| **No permission layer exists** | ✅ Confirmed | Zero permission checks in any service or action. `users.isFounder` is the only privilege field. 0014F adds the permission layer. |
| **Sensitive actions (desconto/estorno/cancelamento) exist** | ⚠️ Partially | Cancel/remove actions exist (removeComandaItem, cancelComanda). Discount feature **DOES NOT EXIST YET** — would be a NEW action to build. Estorno (reversal) is internal, not yet a standalone user action. |
| **Super admin panel can edit platform-settings** | ✅ Confirmed | Yes. `updatePlanPriceAction` exists (`app/(admin)/superadmin/actions.ts:162-178`). Extending to operator-limit field is straightforward. |

---

## Integration Points

### Database Layer
- **New table:** `user_permissions` (granular per-user, per-permission grant)
- **New table:** `user_permissions_audit` (optional: log who granted/revoked each permission)
- **New RLS policy:** `user_permissions` table with owner-only access
- **New migration:** Drizzle schema + RLS policy SQL
- **Optional retrofit:** Add `is_active` column to `tenant_members` for soft-delete of operators (currently no way to deactivate without deleting)

### Backend Services
- **New service:** `lib/services/permissions/permission-service.ts`
  - `getUserPermission(ctx, userId, code): Promise<boolean>`
  - `grantPermission(ctx, userId, code): Promise<void>`
  - `revokePermission(ctx, userId, code): Promise<void>`
  - `listUserPermissions(ctx, userId): Promise<PermissionDto[]>`
  
- **New service:** `lib/services/users/operator-service.ts`
  - `registerOperator(ctx, email, permissions): Promise<OperatorDto>`
  - `updateOperator(ctx, operatorId, permissions): Promise<OperatorDto>`
  - `deactivateOperator(ctx, operatorId): Promise<void>`
  - `reactivateOperator(ctx, operatorId): Promise<void>`
  - `listOperators(ctx): Promise<OperatorDto[]>`

- **New helper:** `lib/auth/permissions.ts`
  - `requirePermission(ctx, code): Promise<void>` — throws UnauthorizedError if denied
  - `hasPermission(ctx, code): Promise<boolean>` — returns true/false

- **Existing extensions:**
  - `lib/services/platform/settings-repository.ts` — add `getMaxOperators()` and `setMaxOperators()`

### Frontend / Actions
- **New route/page:** `/operadores` (operator management UI)
  - List operators
  - Register new operator (email + permission checkboxes, with "at least 1 required" validation)
  - Edit operator permissions
  - Deactivate/reactivate operator

- **New actions:** `app/(app)/operadores/actions.ts`
  - `registerOperatorAction(email, permissions)`
  - `updateOperatorAction(operatorId, permissions)`
  - `deactivateOperatorAction(operatorId)`
  - `reactivateOperatorAction(operatorId)`
  - `listOperatorsAction()`

- **Permission guards in existing actions:**
  - `app/(app)/caixa/actions.ts` → wrap sensitive calls with `requirePermission(ctx, "Caixa")`
  - `app/(app)/comandas/actions.ts` → wrap with `requirePermission(ctx, "Comanda")`
  - `app/(app)/vendas/actions.ts` → wrap with `requirePermission(ctx, "Vendas")`
  - Similarly for Estoque, Financeiro, Loja, Produtos

### RLS & Migrations
- **New migration:** Create `user_permissions` table + RLS policy
- **New migration:** Create `tenant_members.is_active` column (if soft-delete required)
- **Existing migration:** Extend `platform_settings` with `max_operators_count` field

---

## Reusable Functionality

### From existing codebase
1. **Auth pattern:** `requireAuthContext()` + `withUserRls()` — copy this pattern for permission service
2. **Zod validation:** Use same pattern for permission input validation
3. **Error handling:** `UnauthorizedError`, `ValidationError` from `lib/services/errors.ts`
4. **RLS policy template:** Use existing `tenant_isolation` pattern for `user_permissions` table
5. **Action pattern:** Validate → `requireAuthContext()` → check permission → service call → revalidate

### From 0011F (super admin panel)
- `requireFounder()` pattern for founder-only actions
- Super admin page structure and form handling
- Platform settings upsert pattern (`setMonthlyPlanPriceCents`)

---

## Risks & Unknowns

### High-priority risks

1. **Operator limit enforcement race condition** 
   - Problem: Check `COUNT(operators) < max_operators` then INSERT is non-atomic
   - Mitigation: Use database constraint (CHECK or UNIQUE partial index) + catch conflict error in service, or use a SERIALIZABLE transaction

2. **Anti-escalation edge case: Owner can't disable owner**
   - Problem: If an operator gains "manage-users" permission, can they disable the owner?
   - Mitigation: RLS policy must check `role='owner'` AND prevent owner's record from being edited by anyone but owner themselves, OR, owner soft-delete is blocked at the service layer (check `role='owner'` and throw UnauthorizedError)

3. **Soft-delete impact on history**
   - Problem: If operator is deactivated, old sales still reference `userId` — history should show the operator's name even if deactivated
   - Mitigation: Never delete operators (soft-delete via `is_active` column); store snapshot of operator name/email in sales/cash_movements/etc. history table, OR query the operator record for display (with LEFT JOIN to handle deleted users gracefully)

4. **Override framework complexity**
   - Problem: "Admin password override" for sensitive actions is tricky: validate admin password in the action, then re-check permission after override
   - Mitigation: Create a helper `requirePermissionOrAdminOverride(ctx, code)` that checks `hasPermission()` OR `verifyAdminPassword()` + logs the override

5. **Operator limit per-plan vs global**
   - Problem: Brainstorm says "3 today, becomes per-plan later"; if we hard-code the limit, it'll be debt
   - Mitigation: Always read from `platform_settings` (singleton), never hard-code; future: replace with `plan_settings` per subscription tier

### Medium-priority unknowns

1. **Permission code enum** — brainstorm lists 7 permissions (Vendas, Comanda, Caixa, Produtos, Estoque, Financeiro, Loja) + "gerenciar-usuarios". Are these final, or will more be added? 
   - Mitigation: Use a text column, not enum; add validation in the app layer (zod)

2. **Deactivation vs deletion** — should "remove operator" be soft-delete (is_active=false) or hard-delete?
   - Brainstorm says "preserving the history" → soft-delete is implied
   - Unknown: Should deactivated operator's name still appear in reports?

3. **Owner protection scope** — can owner deactivate themselves?
   - Mitigation: Service-layer check: `if (operatorId === ownerUserId) throw UnauthorizedError("Can't deactivate owner")`

4. **Login for operators** — brainstorm says operators login with email + password (same auth as owner). Do we auto-generate a password, or email an invite link?
   - Unknown: Password reset flow for operators?
   - Mitigation: Clarify in `/add.new` questionnaire

---

## Delivery Completeness Checklist

| Component | Required for user to USE? | In scope? | Notes |
|-----------|---------------------------|-----------|-------|
| **Operator registration** (UI + backend) | ✅ Yes | ✅ Yes | Owner must be able to register operators |
| **Permission assignment** (UI form + backend) | ✅ Yes | ✅ Yes | Owner must assign permissions at registration |
| **Permission enforcement** (backend gates) | ✅ Yes | ✅ Yes | Without gates, operators see everything |
| **Operator login** (reuse existing auth) | ✅ Yes | ✅ Yes | Operators must be able to log in |
| **Author tracking** (already exists in DB) | ✅ Yes | ✅ Existing | No new work; gates will apply to existing columns |
| **Operator deactivation** (UI + backend) | ✅ Yes (optional by plan) | ⚠️ Partial | Owner must be able to remove operators; soft-delete needed |
| **Override framework** (password + gate) | ⚠️ Conditional | ⚠️ Partial | Needed for sensitive actions (cancel/discount); phase 1 = basic gates, phase 2 = overrides |
| **Operator limit enforcement** | ⚠️ Conditional | ⚠️ Partial | If tied to plans; for now, limit = platform setting (global) |
| **Limit edit in super admin panel** | ⚠️ Conditional | ⚠️ Partial | Extend platform-settings; depends on 0011F panel scope |

**Verdict:** Core feature (registration + login + permission gates) is **COMPLETE**. **Conditional parts** (overrides, limit-per-plan, deactivation UI) can be staged or excluded without breaking usability.

---

## Planning Summary

0014F is **high complexity** with clean integration points but requires careful RLS policy design and anti-escalation logic.

**Critical path:**
1. Add `is_active` column to `tenant_members` (soft-delete infrastructure)
2. Create `user_permissions` table + RLS migration
3. Build `permission-service` and `requirePermission()` helper
4. Add permission gates to 5 key action groups (caixa, comandas, vendas, estoque, financeiro)
5. Build operator CRUD pages + actions

**High-risk areas:**
- Owner-protection RLS policy (must prevent escalation)
- Race condition on operator limit (database constraint recommended)
- Override framework for sensitive actions (complex; can phase 2)

**Dependencies:**
- 0011F must have extended platform-settings with max_operators field (if operator-limit is in scope)
- Auth + RLS patterns are fixed; no changes possible

---

## Updates

- 2026-06-26: Initial discovery; confirmed RLS pattern, author tracking, action pattern, anti-escalation framework

---

## Metadata

{"updated":"2026-06-26","sessions":1,"by":"discovery-agent","citations":42,"files_read":15}
