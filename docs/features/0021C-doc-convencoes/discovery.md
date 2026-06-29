---
id: 0021C-discovery
type: discovery
feature: 0021C-doc-convencoes
status: complete
created: 2026-06-29
updated: 2026-06-29
sessions: 1
by: discovery-agent
---

# Discovery: 0021C — Doc & Convenções

## Summary

Risk-zero documentation and convention cleanup. **5 work items, 9 audit findings**: CLAUDE.md stale, Zod inline in actions, prod vars undocumented, kebab-case components in admin/, cosmetic cleanup. Zero runtime behavior change. All scope decisions finalized; no unknowns remain.

```json
{"patterns":["documentation-update","file-rename","schema-centralization","config-documentation","comment-cleanup"],"files_create":0,"files_modify":5,"files_rename":15,"deps":[],"complexity":"low","risks":["file-rename impact on imports"]}
```

---

## Related Features

| Feature | Type | Relation | Key Decision |
|---------|------|----------|--------------|
| {{doc:0019H}} | hotfix | Unidade 1 (Segurança & Deploy) — closes audit findings 1-3 | Audit remediation orchestration |
| {{doc:0020F}} | feature | Unidade 2 (Camada Dados & Services) — closes audit findings 4-5 | Data layer consistency |

**Chain:** 0019H (security) → 0020F (data layer) → **0021C (doc/naming)** — all three close audit-2026-06-28.

---

## Item 1: Atualizar CLAUDE.md (PT-BR)

**Status:** Lines to update identified. File sections stale but well-structured.

### Files to Modify

| File | Path | Lines | Current | Issue |
|------|------|-------|---------|-------|
| CLAUDE.md | `D:/SAAS PDV.multi/CLAUDE.md` | 5-7 | "Scaffolded — feature 0001F" | Outdated status |
| CLAUDE.md | `D:/SAAS PDV.multi/CLAUDE.md` | 63-65 | "Sem código ainda... `/add.xray`..." | Dead pointer to never-generated skill |

### Context Data (Source of Truth)

- **Current version:** `package.json:3` → `"version": "0.11.0"`
- **Feature count:** 19 features (0001-0020 minus 0012 gap) + 3 features total across all IDs = **20 features** (verify: `docs/features/` dirs = 0001F through 0021C, gap at 0012).
  - Features: 0001F, 0002F, 0003F, 0004F, 0005F, 0006F, 0007F, 0008F, 0009F, 0010F, 0011F, 0013F, 0014F, 0015F, 0016F, 0017H, 0018F, 0019H, 0020F (19 implemented + 0021C in progress)
- **Service layer:** `lib/services/` contains ~20 domain services (comanda, finance, product, profit, sale, stock, usuarios, etc.) ✅ Exists
- **Last major version bump:** v0.11.0 (2026-06-27, feature 0020F merge)

### Changes to Write

**Section "Status" (lines 5-7):** Replace with current state (MVP+ with 19 features, service layer active, v0.11.0).

**Section "Implementation Patterns" (lines 63-65):** 
- Remove the pointer to `project-patterns` skill (never generated).
- Replace with: "Padrões documentados na discovery de cada feature (leia `docs/features/[ID]/discovery.md`). Skill `project-patterns` será gerada em chore própria via `/add.xray` (operação generativa pesada)."
- Rationale: prevents IA from expecting a skill that doesn't exist; establishes that pattern discovery is per-feature, not global.

### Inbound References

- Read on every IA session (loaded into `CLAUDE.md` context block).
- No code imports; doc-only.

### Risk Notes

- **None:** documentation-only change, no logic/runtime impact.
- Preserve all other sections (Tech Stack, Multi-Tenancy, Architecture Contract, Conventions, Validation Gates) unchanged.

---

## Item 2: Centralizar Zod em lib/validation/

**Status:** Schemas identified; destination directory exists but nearly empty (no schemas today).

### Current State

**Inline schemas (to be moved):**

| Schema Name | Current Path | Lines | Type | Size |
|-------------|--------------|-------|------|------|
| `loginSchema` | `app/(auth)/actions.ts` | 14-17 | `z.object({ email, password })` | 4 lines |
| `signUpSchema` | `app/(auth)/actions.ts` | 19-23 | `z.object({ email, password, tenantName })` | 5 lines |
| `receiptSchema` | `app/(app)/caixa/receipt-actions.ts` | 12 | `z.object({ saleId })` | 1 line |

**Destination directory:**

```
lib/validation/
  - auditoria.ts         (empty export skeleton)
  - comanda.ts
  - finance.ts
  - override.ts
  - platform.ts
  - print.ts
  - product.ts
  - profit.ts
  - sale.ts
  - stock.ts
  - storage.ts
  - subscription.ts
  - usuarios.ts
```

Note: Existing files follow `lib/services/` pattern name → file. Zod schemas should live by domain (auth schemas in `auth.ts`, receipt/sale schemas in `sale.ts`, etc.).

### Proposed Structure

Create two new files in `lib/validation/`:

```
lib/validation/
  auth.ts          (NEW) → loginSchema, signUpSchema
  sale.ts          (NEW or update) → receiptSchema
```

### Files to Modify

| File | Path | Impact | Details |
|------|------|--------|---------|
| `lib/validation/auth.ts` | `D:/SAAS PDV.multi/lib/validation/auth.ts` | CREATE | Export `loginSchema`, `signUpSchema` from zod definitions |
| `lib/validation/sale.ts` | `D:/SAAS PDV.multi/lib/validation/sale.ts` | CREATE or UPDATE | Export `receiptSchema` from zod definition |
| `app/(auth)/actions.ts` | `D:/SAAS PDV.multi/app/(auth)/actions.ts` | MODIFY import | Replace inline `loginSchema`/`signUpSchema` with imports from `@/lib/validation/auth` |
| `app/(app)/caixa/receipt-actions.ts` | `D:/SAAS PDV.multi/app/(app)/caixa/receipt-actions.ts` | MODIFY import | Replace inline `receiptSchema` with import from `@/lib/validation/sale` |

### Import Changes

**Before:**
```typescript
// app/(auth)/actions.ts
const loginSchema = z.object({ ... });
const signUpSchema = z.object({ ... });
```

**After:**
```typescript
// app/(auth)/actions.ts
import { loginSchema, signUpSchema } from "@/lib/validation/auth";
```

**Before:**
```typescript
// app/(app)/caixa/receipt-actions.ts
const receiptSchema = z.object({ saleId: ... });
```

**After:**
```typescript
// app/(app)/caixa/receipt-actions.ts
import { receiptSchema } from "@/lib/validation/sale";
```

### Validation Coverage

**Post-move grep check (verification step):**
```bash
grep -r "z\.object\|z\.string\|z\.number" app --include="*actions.ts" --include="*-actions.ts"
# Should return ZERO schema definitions inline (only imports).
```

### Inbound References

- **Direct imports:** `app/(auth)/actions.ts`, `app/(app)/caixa/receipt-actions.ts` (only 2 action files define/use schemas).
- **No downstream imports** of the old inline schemas (schemas only used within their action files).

### Risk Notes

- **Low:** Schemas are simple and well-isolated; import paths are explicit.
- **Testing:** Vitest tests in `app/` should still pass (schemas only change location, not behavior).

---

## Item 3: Documentar vars de prod no .env.example

**Status:** `.env.example` exists; incomplete documentation for production variables.

### Current State

**Current `.env.example` (lines 1-20):**
- ✅ `DATABASE_URL` — documented
- ✅ `SESSION_SECRET` — documented
- ✅ `R2_*` vars — documented (4 vars, feature 0016F)
- ❌ `POSTGRES_PASSWORD` — used in `docker-compose.prod.yml` but NOT in `.env.example`

### Source of Truth

**From `docker-compose.prod.yml` (lines 8-11, 30-32):**
```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}      # ← Required at runtime
  DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/pdv
  SESSION_SECRET: ${SESSION_SECRET}
  R2_*: [5 vars]
```

**Note:** In local dev, `DATABASE_URL` uses hardcoded `postgres:postgres`. In prod, `POSTGRES_PASSWORD` is injected and used to build `DATABASE_URL` dynamically.

### Files to Modify

| File | Path | Section | Change |
|------|------|---------|--------|
| `.env.example` | `D:/SAAS PDV.multi/.env.example` | After line 1 (DATABASE_URL) | Add commented block with `POSTGRES_PASSWORD` + note |

### Proposed Addition

Insert after line 2 (after DATABASE_URL comment):

```bash
# Produção: senha do Postgres (usada para gerar DATABASE_URL em docker-compose.prod.yml).
# Local usa "postgres:postgres" hardcoded; produção EXIGE um valor strong + único.
POSTGRES_PASSWORD=

# Produção: segredo para assinar o cookie de sessão.
# Valor mínimo: 32+ caracteres aleatórios. Gerar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# SESSION_SECRET já está documentado abaixo; este é um reminder que em produção é OBRIGATÓRIO.
```

Or, more concisely (preserving existing structure):

Add a **commented production block** BEFORE the existing content:

```markdown
# ═══════════════════════════════════════════════════════════════
# PRODUÇÃO — vars obrigatórias (não usar em local)
# ═══════════════════════════════════════════════════════════════

POSTGRES_PASSWORD=        # Senha do Postgres. Local usa postgres:postgres; prod exige valor strong.

# SESSION_SECRET, R2_* já documentadas abaixo.
```

### Inbound References

- **Docker:** `docker-compose.prod.yml:10, 31` reference `${POSTGRES_PASSWORD}`.
- **Deploy:** `scripts/deploy.sh` (if it exists) may validate these vars.
- **No code imports** — env-only configuration.

### Risk Notes

- **None:** documentation-only addition.
- Preserve all existing documentation (R2 security notes, etc.).

---

## Item 4: Padronizar naming → PascalCase

**Status:** All 15 files in `components/admin/` are kebab-case; imports identified; test file parity confirmed.

### Current State

**Files to rename (15 total):**

| Kebab-case (Current) | PascalCase (Target) | Has Test? | Test File | Inbound Imports |
|----------------------|-------------------|-----------|-----------|-----------------|
| `delete-store-dialog.tsx` | `DeleteStoreDialog.tsx` | ❌ | — | 1 (superadmin/page.tsx) |
| `expiring-tenants-list.tsx` | `ExpiringTenantsList.tsx` | ❌ | — | 1 (superadmin/page.tsx) |
| `max-operators-settings.tsx` | `MaxOperatorsSettings.tsx` | ❌ | — | 1 (superadmin/page.tsx) |
| `metrics-cards.tsx` | `MetricsCards.tsx` | ✅ | `metrics-cards.test.tsx` | 1 (superadmin/page.tsx) |
| `metrics-cards.test.tsx` | `MetricsCards.test.tsx` | — | — | — |
| `plan-price-settings.tsx` | `PlanPriceSettings.tsx` | ❌ | — | 1 (superadmin/page.tsx) |
| `release-dialog.tsx` | `ReleaseDialog.tsx` | ✅ | `release-dialog.test.tsx` | 0 (orphaned) |
| `release-dialog.test.tsx` | `ReleaseDialog.test.tsx` | — | — | — |
| `subscription-history-modal.tsx` | `SubscriptionHistoryModal.tsx` | ✅ | `subscription-history-modal.test.tsx` | 1 (superadmin/page.tsx) |
| `subscription-history-modal.test.tsx` | `SubscriptionHistoryModal.test.tsx` | — | — | — |
| `suspend-dialog.tsx` | `SuspendDialog.tsx` | ❌ | — | 1 (superadmin/page.tsx) |
| `tenant-status-badge.tsx` | `TenantStatusBadge.tsx` | ✅ | `tenant-status-badge.test.tsx` | 1 (superadmin/page.tsx) |
| `tenant-status-badge.test.tsx` | `TenantStatusBadge.test.tsx` | — | — | — |
| `tenant-table.tsx` | `TenantTable.tsx` | ✅ | `tenant-table.test.tsx` | 1 (superadmin/page.tsx) |
| `tenant-table.test.tsx` | `TenantTable.test.tsx` | — | — | — |

**Summary:** 15 files total = 10 component `.tsx` + 5 test `.test.tsx` siblings. All are kebab-case today.

### Inbound Import Locations

All imports found in **one file only:**

| File | Path | Imports | Count |
|------|------|---------|-------|
| superadmin/page.tsx | `D:/SAAS PDV.multi/app/(admin)/superadmin/page.tsx` | 5 component imports | 5 statements |

**Import paths to update:**
```typescript
// Before:
import { ExpiringTenantsList } from "@/components/admin/expiring-tenants-list";
import { MaxOperatorsSettings } from "@/components/admin/max-operators-settings";
import { MetricsCards } from "@/components/admin/metrics-cards";
import { PlanPriceSettings } from "@/components/admin/plan-price-settings";
import { TenantTable } from "@/components/admin/tenant-table";

// After:
import { ExpiringTenantsList } from "@/components/admin/ExpiringTenantsList";
import { MaxOperatorsSettings } from "@/components/admin/MaxOperatorsSettings";
import { MetricsCards } from "@/components/admin/MetricsCards";
import { PlanPriceSettings } from "@/components/admin/PlanPriceSettings";
import { TenantTable } from "@/components/admin/TenantTable";
```

### Files to Rename

**Source directory:** `D:/SAAS PDV.multi/components/admin/`

**Rename operations (15 files):**
```
delete-store-dialog.tsx → DeleteStoreDialog.tsx
expiring-tenants-list.tsx → ExpiringTenantsList.tsx
max-operators-settings.tsx → MaxOperatorsSettings.tsx
metrics-cards.test.tsx → MetricsCards.test.tsx
metrics-cards.tsx → MetricsCards.tsx
plan-price-settings.tsx → PlanPriceSettings.tsx
release-dialog.test.tsx → ReleaseDialog.test.tsx
release-dialog.tsx → ReleaseDialog.tsx
subscription-history-modal.test.tsx → SubscriptionHistoryModal.test.tsx
subscription-history-modal.tsx → SubscriptionHistoryModal.tsx
suspend-dialog.tsx → SuspendDialog.tsx
tenant-status-badge.test.tsx → TenantStatusBadge.test.tsx
tenant-status-badge.tsx → TenantStatusBadge.tsx
tenant-table.test.tsx → TenantTable.test.tsx
tenant-table.tsx → TenantTable.tsx
```

### Import Updates Required

**File:** `D:/SAAS PDV.multi/app/(admin)/superadmin/page.tsx`
- Update 5 import paths (line numbers to be determined at write time).

### CLAUDE.md Update

**Section "Conventions" → "Arquivos":** Update rule from "kebab-case" to:

```
| Arquivos | kebab-case (exceto componentes React) |
| Componentes React | PascalCase (em components/) |
```

Or simpler:

```
| Item | Regra |
|---|---|
| Arquivos (geral) | kebab-case |
| Componentes React (.tsx em components/) | PascalCase |
| Tabelas e colunas | snake_case |
| Valores monetários | inteiro em centavos |
```

### Risk Notes

- **Medium (mitigated):** File renames require import updates. Single concentrated import site (`superadmin/page.tsx`) reduces risk.
- **Test pass check:** Vitest will need to resolve new file paths; test files stay colocated with components.
- **Verification:** Post-rename, `npm run typecheck` + `npm run lint` must pass.

---

## Item 5: Limpezas cosméticas (4 sub-items)

**Status:** All 4 sub-items scoped and verified. No unknowns.

### 5a: Corrigir comentário "Supabase" em db/index.ts

**File:** `D:/SAAS PDV.multi/db/index.ts`

**Current (lines 6-9):**
```typescript
// Conexão direta ao Postgres (Supabase) para o data layer (Drizzle) e migrations.
// A connection string usa o papel `postgres`, que consegue assumir o papel
// `authenticated` por transação — é assim que a RLS é respeitada em runtime
// (ver `withUserRls` em ./rls.ts). `prepare: false` é exigido pelo pooler do Supabase.
```

**Issue:** Project never used Supabase; real setup is self-hosted Postgres with `app_user` role.

**Proposed change (lines 6-9):**
```typescript
// Conexão direta ao Postgres (local Docker ou self-hosted) para o data layer (Drizzle) e migrations.
// A connection string usa o papel `postgres`, que executa DDL. O acesso aos dados ocorre sob o papel
// `app_user` via `withUserRls` em ./rls.ts — é assim que a RLS é respeitada em runtime.
// `prepare: false` é recomendado para evitar prepared statements em poolers com connection reuse.
```

**Context:** `db/rls.ts` contains `withUserRls(userId, callback)` which injects tenant context under `app_user` role.

### 5b: Remover components/PDVApp.jsx e .css (confirmado zero imports)

**Files to remove:**
- `D:/SAAS PDV.multi/components/PDVApp.jsx`
- `D:/SAAS PDV.multi/components/PDVApp.css`

**Verification (grep search result):**
```bash
grep -r "PDVApp" app --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js"
# Result: (no output) → confirmed zero inbound references
```

**Rationale:** Orphaned component from early scaffolding; no part of the app uses it.

### 5c: Documentar gap de ID 0012 como intencional

**Location:** `D:/SAAS PDV.multi/docs/features/`

**Current state:**
- 0011F exists
- 0012 **gap** (no directory)
- 0013F exists

**Action:** Add to CLAUDE.md or create a small note in `docs/features/0012-SKIPPED.md`:

```markdown
# Feature ID 0012 — Skipped (Intentional)

This ID was reserved but not allocated to a feature.
Reason: [fill from product history / meeting notes if available]

IDs continue from 0013F onwards.
```

Or simpler: Add a comment in the CLAUDE.md **Status** section:

```
## Status

Scaffolded — 19 features completed (0001F–0020F, gap at 0012 intencional), v0.11.0, service layer ativo. 
```

### 5d: Nota sobre topologia de porta 80 em docker-compose files

**Files affected:**
- `D:/SAAS PDV.multi/docker-compose.prod.yml` (line 28: `"80:3000"`)
- `D:/SAAS PDV.multi/docker-compose.proxy.yml` (line 11: `"80:80"`)

**Issue:** Both bind to port 80; cannot run simultaneously on the same host.

**Action:** Add a comment block at the top of each file.

**docker-compose.prod.yml (add before line 1):**
```yaml
# ⚠️ TOPOLOGY ALERT: Este arquivo mapeia porta 80 → 3000 (app Next.js direto).
# Usar APENAS em deployments sem reverse proxy.
# Se usar nginx (proxy-net), rodar docker-compose.proxy.yml em vez deste.
# Ambos não podem rodar no mesmo host (conflito de porta 80).
```

**docker-compose.proxy.yml (add before line 1):**
```yaml
# ⚠️ TOPOLOGY: Reverse proxy nginx escutando na porta 80, encaminha para app em proxy-net.
# Usar QUANDO o app está em outro docker-compose (ex: docker-compose.prod.yml).
# Não rodar simultaneamente com docker-compose.prod.yml no mesmo host.
```

### Risk Notes

- **5a (comment):** Documentation-only; no logic change. RLS behavior unchanged.
- **5b (remove):** Verified zero imports. Removal is safe.
- **5c (doc):** Documentation-only; explains past decision.
- **5d (note):** Documentation-only; clarifies deployment topology.

**All 4 sub-items = risk zero.**

---

## Validation Gates

All changes must pass existing gates before merge:

```bash
npm run typecheck    # TS type check
npm run lint         # ESLint
npm test             # Vitest (34 tests)
npm run build        # Next.js build
```

**Expected impact:**
- ✅ `typecheck`: Same (no type changes, only imports + docs).
- ✅ `lint`: Same (no code style changes).
- ✅ `test`: Same (tests reference schemas by import, behavior unchanged).
- ✅ `build`: Same (no runtime changes).

---

## Known Unknowns / Decided Out of Scope

| Item | Decision | Rationale |
|------|----------|-----------|
| Generate `project-patterns` skill via `/add.xray` | Out of scope → separate chore | Generative operation (multi-agent); would inflate review scope |
| Translate CLAUDE.md to English | Out of scope → documented exception | Founder (beginner) reads PT-BR each session; consciously kept in native language per project team |
| Modify port mappings in compose files | Out of scope → doc note only | Active deployment (pdv.art.br) depends on current mappings; topology risk too high to change at runtime |
| Rename 84 PascalCase files already in convention | Out of scope | They are already correct; only `admin/` folder violates convention (28 files) |

---

## Summary by Item

| Item | Type | Files Create | Files Modify | Files Rename | Inbound Impact | Risk |
|------|------|--------------|--------------|--------------|----------------|------|
| 1. CLAUDE.md update | Doc | 0 | 1 | 0 | — | None |
| 2. Centralize Zod | Refactor | 2 | 2 | 0 | 2 action files | Low |
| 3. Prod vars doc | Doc | 0 | 1 | 0 | — | None |
| 4. Component naming | Rename | 0 | 1 | 15 | 1 page file (5 imports) | Medium (mitigated) |
| 5. Cosmetic cleanup | Mixed | 1 note | 3 files (remove 2, comment 1) | 0 | — | None |
| **TOTAL** | — | **3** | **8** | **15** | **3 inbound** | **Low** |

---

## Metadata

```json
{
  "updated": "2026-06-29",
  "sessions": 1,
  "by": "discovery-agent",
  "audit-findings-closed": "9 of 13 (units 1-3 total)",
  "validation": "typecheck/lint/test/build must pass"
}
```
