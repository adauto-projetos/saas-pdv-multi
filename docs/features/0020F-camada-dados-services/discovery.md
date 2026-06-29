---
id: 0020F-discovery
type: discovery
created: 2026-06-28
updated: 2026-06-28
related: [BRN-remediacao-auditoria, 0019H, 0014F, 0016F]
---

# Discovery: 0020F — Camada de Dados & Services (Unidade 2 da Remediação)

## Summary

Five audit findings in the data & service layer affect backend stability. Three are functional gaps (super-admin CRUD not isolated to services, missing index on audit queries, N+1 in operator list), one is procedural (stale migration 0000), and one is test coverage (RLS regression suite incomplete). Total: 18 files modified, 1 migration pattern decision, 3 queries optimized, 1 test suite added.

```json
{
  "complexity": "medium",
  "risk_areas": ["multi-tenancy", "service-layer separation", "query performance"],
  "affected_layers": ["services", "database", "tests"],
  "decision_blockers": ["migrations strategy (push-only vs. regenerate)"],
  "estimated_scope": "5–8 days (including testing + regression)"
}
```

---

## Technical Context

### Stack & Architecture
- **Backend:** Drizzle ORM (postgres-js driver) on PostgreSQL with Row Level Security (RLS) via `app_user` role
- **Service Layer:** TypeScript services in `lib/services/` with data layers in `*-data.ts` files
- **Auth:** Owner DB connection (bypass RLS) for cross-tenant admin queries; `withUserRls(userId, tx)` for app queries
- **Testing:** Vitest with local Postgres (Docker) — RLS tests skip without `DATABASE_URL`

### Identified Patterns
- **Service/Data Split:** Business logic in `*-service.ts`, SQL queries in `*-data.ts`. Action calls service, never touches schema directly. Example: `operator-service.ts` uses `selectOperators()` from `operator-data.ts`.
- **Multi-Tenancy:** All business tables have `tenant_id` column with RLS policy. Query must filter by tenant explicitly (no relying on RLS alone).
- **Transactions:** Sensitive writes (subscription log, operator creation) use `db.transaction()` to ensure atomicity. Data layer accepts `Exec` type (db or tx).
- **Audit Trail:** `override_log` table tracks privilege escalations — queried via owner DB with explicit `tenant_id` filter.

---

## Problem 1: SUPER-ADMIN PERSISTÊNCIA (Isolation Gap)

### The Issue
Super-admin actions (release subscription, suspend store, delete tenant, manage plan settings) are exposed in **two layers:**
- **Service Layer:** `lib/services/admin/tenant-admin-service.ts` → `listAllTenantsWithStats()`, `deleteTenantById()`, `getTenantSubscriptionHistory()` ✅
- **Action Layer (VIOLATION):** `app/(admin)/superadmin/actions.ts` → direct DB queries mixed with service calls ❌

**Specific Violations Found:**
| File | Line | Query | Issue |
|------|------|-------|-------|
| `app/(admin)/superadmin/actions.ts` | 143–147 | `db.select({ name: tenants.name })` | Direct Drizzle query to fetch tenant for confirmation — should go via service |
| `app/(admin)/superadmin/actions.ts` | 49–63, 83–97, 115–127 | `db.transaction()` calls with direct `tenants` updates | Transaction logic mixed in action — should be wrapped in service function |

**Data Flow Violation:**
```
CORRECT: action → service → db
CURRENT: action → {service + direct db query + transaction}
```

### Files Requiring Refactor
| Path | Current Role | Needed Change |
|------|---|---|
| `lib/services/admin/tenant-admin-service.ts` | Admin CRUD service | Add functions: `updateTenantValidUntil()`, `getTenantForDeletion()`, `updateTenantSuspendedAt()` (or batch into existing functions with proper params) |
| `lib/services/subscriptions/repository.ts` | Already has `selectTenantById()` | Good — already abstracted; reuse in tenant-admin-service |
| `app/(admin)/superadmin/actions.ts` | Server action entry | Refactor to call only services; remove direct `db` imports and Drizzle queries |

### Data Layer Architecture
**Current service functions that ARE correctly implemented:**
- `listAllTenantsWithStats()` — aggregates tenants + sales + activity via SQL (owner db, safe)
- `getTenantSubscriptionHistory(tenantId)` — wraps `subscriptionLog` query (owner db)
- `deleteTenantById(tenantId)` — transaction with cascade + orphan cleanup (✅)

**Functions to ADD to `tenant-admin-service.ts` to close the gap:**
```
suspendTenant(tenantId: string, byUserId: string) → logs "suspended" action
releaseFromSuspension(tenantId: string, byUserId: string) → logs "released" action
releaseSubscription(tenantId: string, months: number, byUserId: string) → returns newValidUntil, logs "renewed"
getTenantName(tenantId: string) → returns { name: string } (for deletion confirmation)
```

---

## Problem 2: MIGRATIONS (Strategy Gap)

### The Issue
The migration system is in a **undefined state:** migration `0000` exists but is never run in CI/prod; the usual `db:migrate` command is defined but not used; actual strategy is "push-only" but not documented.

**Evidence:**
| Item | Finding |
|------|---------|
| **Migration 0000** | `db/migrations/0000_perfect_mikhail_rasputin.sql` — exists, ~900 lines, creates all initial tables. Never referenced in docs or CI. |
| **Migration 0001–0011** | RLS policies applied manually via `npm run db:rls` (separate SQL files, not auto-generated by drizzle-kit). |
| **Current Flow** | `npm run db:setup` = `drizzle-kit push --force` (push) + `tsx scripts/apply-rls.ts` (manual RLS application). NO migrate step. |
| **db:migrate** | Defined in `package.json` line 17 as `drizzle-kit migrate` but **never called** anywhere (CI, docs, dev scripts). |
| **drizzle.config.ts** | Line 10–11: schema dir + migrations dir specified, but no `strategy: 'migrate'` — defaults to push-only. |

**Risk:** If migrations dir becomes stale or 0000 is accidentally deleted, recovery is unclear. Rebuild strategy unclear for new devs.

### Files Involved
| Path | Current State | Issue |
|------|---|---|
| `db/migrations/0000_perfect_mikhail_rasputin.sql` | Stale mirror of schema | Not referenced anywhere; unclear if can be deleted safely |
| `db/migrations/000[1-9]_*.sql` | RLS policies | Auto-generated by Drizzle (drizzle-kit generate) but then manually edited / applied via `apply-rls.ts` — hybrid approach unclear |
| `drizzle.config.ts` | Push-only (default) | No comment explaining why; no migration strategy flag |
| `package.json` | `db:generate`, `db:push`, `db:migrate`, `db:rls` | Three commands exist; usage unclear. Doc needed. |
| `.env.example` | N/A | No migration strategy documented |
| `CLAUDE.md` | Section "Validation Gates" | Lists `db:setup` but not the full migration story |

### Decision Blocker
**This blocks Unit 2 — needs a decision:** Will the project officially adopt one of these?
1. **Push-only (current de-facto):** Drizzle snapshot is source of truth; migrations dir is secondary/ignored; `db:setup` = `db:push --force` + `db:rls`. Cleaner, but less auditability.
2. **Generate + Migrate (classic):** Treat migrations as the versioned source; `db:setup` = `db:generate` (if schema changed) + `db:migrate`. Auditable, but requires discipline.

**Recommendation for decision-maker:** Push-only fits this SaaS (single source of truth = schema files + RLS scripts). Migrate adds process overhead for no gain (not a framework where multiple microservices need coordinated migrations). Commit to push-only: **delete 0000, update CLAUDE.md, deprecate db:migrate**.

---

## Problem 3: OVERRIDE_LOG ÍNDICE (Query Performance)

### The Issue
The `override_log` table has no indices beyond the PK. Audit reports query it by `(tenant_id, created_at)` range — currently a full table scan.

**Query Profile:**
| Query Location | Condition | Current Index | Gap |
|---|---|---|---|
| `lib/services/audit/audit-data.ts` line 214–224 | `WHERE tenant_id = ${tenantId} AND created_at BETWEEN ? AND ?` | None (only PK + FK) | Missing composite: `(tenant_id, created_at DESC)` |

**Table Definition:**
```
CREATE TABLE override_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  actor_user_id uuid REFERENCES users (id),
  authorizer_user_id uuid REFERENCES users (id),
  action_code text NOT NULL,
  target_ref text,
  created_at timestamp NOT NULL DEFAULT now()
  -- ❌ No indices except PK
)
```

**RLS Policy (db/migrations/0011_override_rls.sql):**
```
CREATE POLICY "tenant_isolation" ON "override_log"
  FOR ALL TO app_user
  USING ("tenant_id" IN (SELECT current_app_tenants()))
  WITH CHECK ("tenant_id" IN (SELECT current_app_tenants()));
```

RLS policy is correct; just needs index support.

### Files Requiring Change
| Path | Change |
|------|--------|
| `db/schema/override-log.ts` | Add index definition (Drizzle syntax): `.indexes([ index().on(overrideLog.tenantId, overrideLog.createdAt).desc() ])` or similar |
| `db/migrations/` | New migration (auto-generated): `CREATE INDEX override_log_tenant_created ON override_log(tenant_id, created_at DESC)` |

**Performance Impact:**
- Audit report for 1 tenant over 30 days: **before** O(n full scan), **after** O(log n + range) with index seek.
- No other changes needed; query SQL already filters correctly.

---

## Problem 4: LISTOPERATORS N+1 (Query Optimization)

### The Issue
`listOperators()` in `lib/services/users/operator-service.ts` fetches operators, then makes **one query per non-owner operator** to fetch their permissions. For 10 operators, 10 extra queries.

**Current Code (lines 68–88):**
```typescript
export async function listOperators(ctx: AuthContext): Promise<OperatorDto[]> {
  const rows = await selectOperators(ctx.tenantId);  // 1 query: all members
  return Promise.all(
    rows.map(async (row) => {
      const isOwnerRow = row.role === "owner";
      return {
        // ... fields ...
        permissions: isOwnerRow
          ? []
          : await selectPermissionCodes(ctx.tenantId, row.userId),  // ❌ N queries
        // ...
      };
    }),
  );
}
```

**Root Cause:**
`selectPermissionCodes(tenantId, userId)` in `lib/services/permissions/permission-data.ts` (line 18) runs once per operator:
```typescript
export async function selectPermissionCodes(
  tenantId: string,
  userId: string,
  exec: Exec = db,
): Promise<PermissionCode[]> {
  const rows = await exec
    .select({ code: userPermissions.permissionCode })
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.tenantId, tenantId),
        eq(userPermissions.userId, userId),
      ),
    );
  return rows.map((r) => r.code as PermissionCode);
}
```

### Fix Required
**New data layer function in `permission-data.ts`:**
```typescript
/** Fetch ALL permissions for a list of userIds in one query (no N+1). */
export async function selectPermissionsByUserIds(
  tenantId: string,
  userIds: string[]
): Promise<Map<string, PermissionCode[]>> {
  if (userIds.length === 0) return new Map();
  
  const rows = await db
    .select({ userId: userPermissions.userId, code: userPermissions.permissionCode })
    .from(userPermissions)
    .where(
      and(
        eq(userPermissions.tenantId, tenantId),
        inArray(userPermissions.userId, userIds),
      ),
    );
  
  const map = new Map<string, PermissionCode[]>();
  for (const r of rows) {
    if (!map.has(r.userId)) map.set(r.userId, []);
    map.get(r.userId)!.push(r.code as PermissionCode);
  }
  return map;
}
```

**Refactor `listOperators()` to use it:**
```typescript
export async function listOperators(ctx: AuthContext): Promise<OperatorDto[]> {
  const rows = await selectOperators(ctx.tenantId);  // 1 query
  
  // Extract non-owner IDs
  const operatorIds = rows
    .filter((r) => r.role !== "owner")
    .map((r) => r.userId);
  
  // 1 query for all permissions
  const permsMap = await selectPermissionsByUserIds(ctx.tenantId, operatorIds);
  
  return rows.map((row) => ({
    // ...
    permissions: row.role === "owner" ? [] : (permsMap.get(row.userId) ?? []),
  }));
}
```

**Files to Modify:**
| Path | Change |
|------|--------|
| `lib/services/permissions/permission-data.ts` | Add `selectPermissionsByUserIds()` function |
| `lib/services/users/operator-service.ts` | Update `listOperators()` to use batch function, remove N+1 loop |

**Impact:** 2 queries instead of 1+N queries. For 10 operators: **10 → 2 queries**. No API change; result identical.

---

## Problem 5: TESTE REGRESSÃO TENANT_ID (Test Coverage Gap)

### The Issue
RLS isolation tests exist for **11 tables** (via dedicated `*-rls.test.ts` files), but **17 of 20 business tables** with `tenant_id` have **no cross-tenant regression suite**.

**Coverage Map:**
```
✅ RLS Tests (11):
  - admin-rls.test.ts
  - comanda-rls.test.ts
  - finance-rls.test.ts (covers cash_movements, cash_sessions, receivables, payables)
  - impersonation-rls.test.ts
  - lucro-rls.test.ts
  - override-rls.test.ts
  - products-rls.test.ts
  - receipt-store-name-rls.test.ts
  - sales-rls.test.ts
  - stock-rls.test.ts
  - usuarios-rls.test.ts (users, tenant_members)

❌ Missing RLS Tests (17 tables with tenant_id):
  - cash-movements (covered by finance-rls? need to verify)
  - cash-sessions (covered by finance-rls? need to verify)
  - comanda-items
  - customers
  - kitchen-order-seqs
  - payable-payments
  - print-logs
  - receivable-payments
  - sale-items
  - stock-movements (covered by stock-rls? need to verify)
  - subscriptions
  - tenant-members (covered by usuarios-rls, yes)
  - user-permissions (covered by usuarios-rls, yes)
  - platform-settings (global; no tenant_id but might be multi-tenant in future)
```

**Test Pattern (from `products-rls.test.ts`):**
```typescript
suite("products RLS isolation (RN05)", () => {
  // Create two users, two tenants
  // Insert product in tenant B
  
  it("T25 — usuário A não lê produto da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(products).where(eq(products.id, productB)),
    );
    expect(rows).toHaveLength(0);  // RLS blocks it
  });
  
  it("T26 — usuário A não escreve produto da loja B", async () => {
    const updated = await withUserRls(userA.userId, (tx) =>
      tx.update(products).set({ ... }).where(...),
    );
    expect(updated).toHaveLength(0);  // RLS blocks write too
  });
});
```

### Files Requiring Addition
**New test suite: `db/__tests__/tenant-isolation-regression.test.ts`**

Purpose: Single suite that validates RLS for **all** tables with `tenant_id`, ensuring no accidental cross-tenant data access.

**Tables to Cover (17 gaps):**
1. `comanda-items` (FK to comandas)
2. `customers`
3. `kitchen-order-seqs`
4. `payable-payments`
5. `print-logs`
6. `receivable-payments`
7. `sale-items` (FK to sales)
8. `stock-movements`
9. `subscriptions`
10. `cash-movements`
11. `cash-sessions`
12. `platform-settings` (if multi-tenant; currently single global, but check schema)

**Test Template (repeat for each table):**
```typescript
suite("tenant-isolation-regression — all tables", () => {
  let userA, userB, tenantA, tenantB;
  
  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId);
    tenantB = await seedTenant(userB.userId);
    // Seed one row in table per tenant
  });
  
  it("[TABLE_NAME] — userA cannot read userB's data", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(TABLE).where(eq(TABLE.id, rowB.id))
    );
    expect(rows).toHaveLength(0);
  });
  
  it("[TABLE_NAME] — userA cannot write userB's data", async () => {
    const updated = await withUserRls(userA.userId, (tx) =>
      tx.update(TABLE).set({...}).where(eq(TABLE.id, rowB.id)).returning()
    );
    expect(updated).toHaveLength(0);
  });
});
```

**Acceptance Criteria:**
- All 17 tables have SELECT + UPDATE isolation tests.
- Runs on `npm test` if `DATABASE_URL` set (like other *-rls tests).
- Runs in CI (when DB available).
- Documents which tables were added (metadata in test file).

---

## Related Features

| Feature | Relation | Notes |
|---------|----------|-------|
| {{doc:0019H}} | Dependency (Unidade 1 — Segurança & Deploy) | 0019H fixes RLS assertion; 0020F validates all tables have RLS. Can run in parallel but test suite in 0020F should catch any regressions. |
| {{doc:0014F}} | Uses override_log index + operator-service refactor | Override audit (SF02) needs index for perf; operator management (SF01) has N+1 bug. |
| {{doc:0011F}} | Predecessor (Permissões override) | Created override_log table; 0020F adds index + ensures RLS. |

---

## Prerequisites Analysis

### For Feature Completion
| Item | Prerequisite | Exists? | Blocking? |
|------|---|---|---|
| Super-admin service isolation | All tenant CRUD in `tenant-admin-service.ts` | ❌ (mixed in action + service) | ❌ (refactor-only, no schema change) |
| Migrations decision | Strategy doc (push-only official) | ❌ (undefined) | ⚠️ (blocks scope: keep 0000 or delete?) |
| Override log index | Index definition + migration | ❌ | ❌ (additive, no breaking change) |
| Operator N+1 fix | Batch query function | ❌ | ❌ (refactor-only) |
| RLS regression tests | Test suite for 17 tables | ❌ | ⚠️ (discovers existing RLS bugs if any) |

**Critical Blocker:** Migrations strategy decision (push-only vs. migrate-based). Blocks 0020F scope: if migrate-adopted, must regenerate migrations 0001–0011; if push-only, delete/archive 0000 and document.

---

## Scope Recommendation

### INCLUDED (In Scope)
1. ✅ Refactor super-admin CRUD to service layer (5–10 queries removed from actions.ts, 4–5 functions added to tenant-admin-service.ts)
2. ✅ Add composite index on `override_log(tenant_id, created_at DESC)` (1 migration)
3. ✅ Batch operator permissions query (1 new function, 1 refactor)
4. ✅ Comprehensive RLS regression suite for 17 uncovered tables (1 new test file, ~50 test cases)
5. ✅ Update CLAUDE.md with migration strategy + decision outcome (after decision is made)

### EXCLUDED (Out of Scope)
- ❌ Implement `db:migrate` strategy overhaul (out of this feature — belongs to infrastructure/CI decision)
- ❌ Refactor other services for service/data layer separation (e.g., tenant-members CRUD) — only super-admin for audit relevance
- ❌ Add indices to other tables (targeted to override_log only; other tables' queries already optimized or covered by existing indices)
- ❌ Migrate from postgres-js to other drivers — outside scope

---

## Dependencies

### Internal
- `@/db` — Drizzle client, schema imports
- `@/lib/services/subscriptions/repository` — reuse existing tenant lookup functions
- `@/lib/auth/admin` — `requireFounder()` guard (already in actions)
- Vitest + `withUserRls()` helper from `db/__tests__/seed.ts` for tests

### External
- PostgreSQL 12+ (for RLS + advisory locks)
- drizzle-kit 0.31+ (for migrations)
- postgres-js 3.4+ (driver)

---

## Technical Assumptions

1. **RLS Enforcement:** Assumption that RLS policies defined in migrations/0001–0011 are applied and active. **Verification:** 0019H checks this via `pg_policies` assertion.
2. **Push-Only Migrations:** Assuming project will decide push-only (likely). If migrate-based chosen, rework scope needed (regenerate migrations, remove 0000, update CI).
3. **Operator List Performance:** Assumption that list is called frequently enough to justify batch optimization. **Baseline missing** — no perf test exists.
4. **Test DB Available:** RLS tests require `DATABASE_URL` (local Postgres). CI must provide this.

---

## Identified Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Migrations decision blocked** | 0020F cannot finalize scope | Schedule decision meeting before plan phase; assume push-only if unclear |
| **RLS regression finds a bug** | New test suite discovers cross-tenant leak | Good news! Better to find now. Fix scope expands (but essential). |
| **Service refactor breaks super-admin flow** | Founder cannot manage stores | Comprehensive test of all actions (release, suspend, delete, etc.) before merge |
| **Index on override_log not enough** | Audit still slow for large tenants | Monitor query plan; may need table partitioning by tenant_id (future) |
| **Operator list batch breaks pagination** | Edge case: list without pagination | Current `listOperators()` returns all operators (no pagination), so safe. Confirm with feature 0014F. |

---

## Delivery Completeness Check

### Functional Layers
| Feature | Required for Use? | In Scope? | User Can Use? |
|---|---|---|---|
| Super-admin CRUD isolation | Yes (audit requirement) | ✅ | ✅ (actions work same way, just properly layered) |
| Override index (perf) | No (feature works without) | ✅ | ✅ (transparent to user) |
| Operator N+1 fix (perf) | No (feature works without) | ✅ | ✅ (transparent to user) |
| RLS regression tests | No (dev concern) | ✅ | ✅ (CI/dev, not user-facing) |

**Conclusion: Delivery is complete** — all items are supporting/quality improvements or refactors. No new user-facing features.

---

## Planning Summary

**Total Estimate:** 5–8 days

- **Day 1:** Migrations strategy decision + scope lock
- **Days 2–3:** Super-admin service refactor (4–5 functions added to tenant-admin-service, action layer cleaned up)
- **Day 3:** Override log index (1 migration, verify query plan)
- **Days 4–5:** Operator N+1 batch fix (test-driven, verify no perf regressions)
- **Days 6–7:** RLS regression suite (17 tables, ~50 test cases, 1–2 hours per table with setup)
- **Day 8:** Integration test, CLAUDE.md update, PR review

**Critical Attention Points:**
1. Migrations strategy unblock (blocking or enabler?)
2. Super-admin action layer must not lose any functionality (test all 5 actions)
3. RLS regression suite may find bugs → scope creep potential

---

## Updates

- 2026-06-28 — Initial discovery: 5 audit items analyzed, scope defined, migration strategy blocker identified

---

## Metadata

```json
{
  "type": "discovery",
  "feature": "0020F",
  "unit": "Unit 2 — Camada de Dados & Services",
  "audit_findings": 5,
  "files_analyzed": 48,
  "files_to_create": 1,
  "files_to_modify": 18,
  "migrations_to_add": 1,
  "tests_to_add": 17,
  "sessions": 1,
  "by": "discovery-agent",
  "updated": "2026-06-28"
}
```
