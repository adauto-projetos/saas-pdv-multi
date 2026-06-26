---
id: discovery-0013F
type: feature-discovery
created: 2026-06-25
updated: 2026-06-25
feature: 0013F-liberacao-meses-flexivel
---

# Discovery: 0013F – Liberação Flexível de Meses para Assinatura

## Summary

Feature extends the current "+30 dias" button in the super admin panel (`/superadmin`) to accept a free-input number of months instead of fixed 30-day increments. Requires: (1) swapping the confirmation dialog to accept numeric input, (2) updating the date-math in the server action, (3) optional zod schema for validation, (4) no schema/auth changes needed.

**Complexity:** Low. Isolated to UI and single server action; reuses existing patterns.

---

## Current Release Flow

### 1. Server Action: `releaseSubscriptionAction`

**File:** [`app/(admin)/superadmin/actions.ts:18-52`](../../../app/(admin)/superadmin/actions.ts#L18-L52)

**What it does:**
- Takes `tenantId` as input
- Calls `requireFounder()` to gate access (auth guard)
- Fetches tenant via `selectTenantById(tenantId)` (reads `validUntil`, `suspendedAt`)
- **Date math (line 28–30):**
  ```typescript
  const now = new Date();
  const base = tenant.validUntil && tenant.validUntil > now ? tenant.validUntil : now;
  const newValidUntil = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
  ```
  - If `validUntil` exists AND is in the future → use it as base
  - Otherwise → use `now`
  - Add exactly **30 days** (in milliseconds: `30 * 24 * 60 * 60 * 1000`)
- Updates tenant record: sets `validUntil` to new date, clears `suspendedAt: null`
- Inserts audit log entry with action `"renewed"` and before/after snapshots
- Returns `{ ok: true, data: { newValidUntil } }`

**Return type:** `ActionResult<{ newValidUntil: Date }>`

---

### 2. Schema: Subscription Columns

**File:** [`db/schema/tenants.ts:30-33`](../../../db/schema/tenants.ts#L30-L33)

**Column:** `validUntil` (timestamp with timezone)
- Type: `timestamp("valid_until", { withTimezone: true })`
- Nullable: Yes (legacy stores may not have a value)
- Semantics: Date until which the store's subscription is active
- Not a duration/counter — an absolute deadline

**Related:** `suspendedAt` (timestamp, nullable)
- When set, overrides `validUntil` to force "travada" (locked) status regardless of expiry
- Cleared when releasing from suspension

---

### 3. Status Derivation

**File:** [`lib/services/subscriptions/subscription-status.ts:11-28`](../../../lib/services/subscriptions/subscription-status.ts#L11-L28)

Status is **pure**, derived from:
1. `suspendedAt !== null` → **"travada"** (locked)
2. `validUntil + 2 days < now` → **"travada"** (grace period expired)
3. Otherwise: `hasRenewed ? "ativa" : "testando"`

No state machine DB table; status is computed per query.

---

### 4. UI: Release Dialog

**File:** [`components/admin/release-dialog.tsx:21-38`](../../../components/admin/release-dialog.tsx#L21-L38)

**Current dialog:**
- Shows message: "Confirmar liberação de acesso para **{tenant.name}**?"
- Displays calculated new date: "Novo vencimento: **{formatDate(newValidUntil)}**"
- Has two buttons: "Cancelar" and "Confirmar"
- **Calculation is duplicated in the component** (lines 21–25):
  ```typescript
  function calcNewValidUntil(validUntil: Date | null): Date {
    const now = new Date();
    const base = validUntil && validUntil > now ? validUntil : now;
    return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  ```

**Trigger:** Button in [`components/admin/tenant-table.tsx:189-195`](../../../components/admin/tenant-table.tsx#L189-L195)
- Labeled "+30 dias" (green button)
- Opens dialog via state: `setDialog({ type: "release", tenantId: tenant.id })`

**Called when confirmed:** `handleRelease()` → `releaseSubscriptionAction(tenantId)` (line 64)

---

### 5. Audit Log

**File:** [`db/schema/subscriptions.ts:29-61`](../../../db/schema/subscriptions.ts#L29-L61)

**Table:** `subscription_log`
- Action: `"renewed"` (for releases via super admin)
- Snapshots: `validUntilBefore`, `validUntilAfter`
- Logged by: `byUserId` (founder's ID, or null if system)
- Timestamp: `at` (auto-defaulted to now)
- Indexed by: `tenant_id, action` and `tenant_id, at` for fast history lookups

---

## Integration Points for N-Months Change

### Changes Required

1. **Dialog accepts numeric input** (NEW)
   - Replace fixed "+30 dias" button text with input field
   - Field accepts integer months (1, 2, 3, etc.)
   - Update `ReleaseDialog` to accept `months` prop
   - Update `calcNewValidUntil()` to accept months parameter

2. **Server action accepts months** (MODIFIED)
   - Signature: `releaseSubscriptionAction(tenantId: string, months: number)`
   - Validate `months` is positive integer (1–60?)
   - Replace hardcoded `30 * 24 * 60 * 60 * 1000` with dynamic calculation
   - Date math: `base.getTime() + months * 30 * 24 * 60 * 60 * 1000`
   - **Note:** Using fixed 30-day months (not calendar months) matches current behavior

3. **Validation schema** (OPTIONAL)
   - Create `lib/validation/release-months.ts` with zod
   - Schema: `z.object({ months: z.number().int().min(1).max(60) })`
   - Validate in server action before date math

4. **Audit log unchanged**
   - `action: "renewed"` still applies (semantics: renewal regardless of duration)
   - Before/after snapshots captured as-is

---

## Related Features & Patterns

**Feature 0011F – Super Admin + Billing** ([`docs/features/0011F-super-admin-billing/`](../../../docs/features/0011F-super-admin-billing/))
- Defined the current release action and status model
- RLS isolation, founder auth, subscription lifecycle
- This feature extends the action UI/input, not the core logic

**Pattern: Server actions + Client dialogs**
- Used by `suspendTenantAction`, `releaseFromSuspensionAction`, `deleteTenantAction`
- Dialog calculates preview client-side, server action does the actual work
- Atomicity via `db.transaction()`

---

## File Mapping

### Modify

| File | Purpose | Change |
|------|---------|--------|
| [`app/(admin)/superadmin/actions.ts`](../../../app/(admin)/superadmin/actions.ts) | Server action | Update `releaseSubscriptionAction(tenantId, months)` signature; parameterize date math |
| [`components/admin/release-dialog.tsx`](../../../components/admin/release-dialog.tsx) | Confirmation UI | Accept `months` prop; add numeric input; update `calcNewValidUntil()` to accept months |
| [`components/admin/tenant-table.tsx`](../../../components/admin/tenant-table.tsx) | Trigger button & state | Update `handleRelease()` to capture months input from dialog; pass to action |

### Create (Optional)

| File | Purpose |
|------|---------|
| [`lib/validation/release-months.ts`](../../../lib/validation/release-months.ts) | Zod schema for months validation (1–60) |

### No Changes

- **DB Schema:** `validUntil` column unchanged; supports any timestamp
- **Auth:** `requireFounder()` gates both 30-day and N-month releases identically
- **Status logic:** Unaffected; status derived from `validUntil` timestamp regardless of how it was set
- **Audit log:** `subscription_log` unchanged; `action: "renewed"` applies to all releases

---

## Technical Assumptions

1. **30-day month approximation:** Current code uses `30 * 24 * 60 * 60 * 1000` (30 × 86400000 ms). Extending this to N months multiplies by N. Assumes fixed 30-day months, not calendar months (Feb ≠ Mar). **Is this correct, or should we use actual calendar month logic?**

2. **Input range:** Assuming 1–60 months is a reasonable limit. **Should we change this?**

3. **Client-side preview:** Dialog calculates new date client-side before confirming. This duplicates logic from server action (both have `calcNewValidUntil`). **Consider extracting shared function or accepting minor drift?**

4. **Audit trail:** The `action: "renewed"` label applies regardless of duration (30 days or 12 months). **Should we differentiate in logs (e.g., `action: "released_custom_months"`) for traceability?**

---

## Identified Risks

- **Timezone handling:** Date calculations use local JavaScript `Date()`. If the browser is in a different timezone than the server, the preview might show a different day. Mitigated by showing the actual returned date after confirmation.

- **Logic duplication:** `calcNewValidUntil()` lives in both the component (preview) and server action (execution). If someone updates one, the other drifts. **Recommendation:** Extract to shared utility.

- **Grace period edge case:** Adding months to a date near the end of Feb (e.g., 2026-02-28) and then adding months might skip days. Not a real risk if we use fixed 30-day months, but worth documenting.

---

## Validation & Constraints

### Input Validation (NEW)

- **Months:** Positive integer, range 1–60 (configurable)
- Validate in server action before date math
- Return error if invalid (already handled by `toActionError()` wrapper)

### Data Integrity

- Atomicity: `validUntil` update + log insert in same transaction (existing pattern)
- Idempotency: No risk; each call is independent
- Cascades: `validUntil` change does NOT cascade; only tenant record updated

---

## Auth & Security

**Gate:** `requireFounder()` in server action (line 22 of `actions.ts`)
- Checks `users.isFounder = true`
- Runs under app_user role with RLS
- Fails with `UnauthorizedError` if not founder

**RLS:** Not directly involved (super admin reads all tenants cross-tenant via owner db). Update happens under app_user role, so RLS policies apply to the tenant_id in the updated record.

**Defense in depth:**
- Layout revalidates `isFounder` before serving page
- Server action revalidates before executing
- Audit log captures `byUserId` for accountability

---

## Prerequisites (0013F)

| Requirement | Prerequisite | Exists? | Notes |
|---|---|---|---|
| User can enter number of months | Input field in UI | ❌ Create | Need numeric input in dialog |
| User sees preview of new date | Client-side calculation | ❌ Update | Extend `calcNewValidUntil()` to accept months |
| Server applies N-month release | Action accepts months param | ❌ Update | Parameterize date math in `releaseSubscriptionAction()` |
| Audit trail shows the action | Log insertion | ✅ Exists | Reuses existing `insertSubscriptionLog()` |
| Only founder can release | Auth gate | ✅ Exists | `requireFounder()` unchanged |
| Correct end date is stored | Schema supports timestamps | ✅ Exists | `validUntil` is timestamp, supports any date |

---

## Delivery Completeness

**Scope of 0013F: Allow founder to input N months (instead of fixed +30 days).**

| User Asks | Required? | In Scope? | User Can Use? |
|---|---|---|---|
| Can I type "6" instead of clicking +30 repeatedly? | Yes | ✅ | ✅ Yes (with numeric input) |
| Does the UI show what date results? | Yes (implicit in "release") | ✅ | ✅ Yes (preview in dialog) |
| Can I confirm and release? | Yes | ✅ | ✅ Yes (confirm button calls action) |
| Is it saved durably? | Yes (implicit in DB) | ✅ | ✅ Yes (transaction + audit log) |

**Verdict:** ✅ Feature is **complete and usable** with proposed scope.

---

## Files Summary

### Core Files (in order of importance)

1. **`app/(admin)/superadmin/actions.ts`** — Server action; update date math and signature
2. **`components/admin/release-dialog.tsx`** — Confirmation UI; add months input
3. **`components/admin/tenant-table.tsx`** — Trigger; pass months to action
4. **`lib/services/subscriptions/repository.ts`** — Helper for tenant lookup (no change)
5. **`db/schema/tenants.ts`** — `validUntil` schema (no change)
6. **`lib/auth/admin.ts`** — Founder check (no change)

### Optional

7. **`lib/validation/release-months.ts`** (NEW) — Zod schema for months validation

---

## Metadata

```json
{
  "updated": "2026-06-25",
  "sessions": 1,
  "by": "discovery-agent",
  "related_feature": "0011F-super-admin-billing",
  "related_files": [
    "app/(admin)/superadmin/actions.ts",
    "components/admin/release-dialog.tsx",
    "components/admin/tenant-table.tsx",
    "db/schema/tenants.ts",
    "lib/services/subscriptions/subscription-status.ts",
    "lib/services/subscriptions/repository.ts",
    "db/schema/subscriptions.ts",
    "lib/auth/admin.ts"
  ]
}
```
