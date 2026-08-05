# Past Features Analysis: Local Installation (0026F)

## Executive Summary

**Goal:** Identify existing features and patterns that inform local packaging/deployment for 0026F.

**Key finding:** 0026F depends critically on deployment patterns from 0019H (boot verification) and 0020F (push-only migrations + RLS), and must account for R2 cloud storage conflict (0016F) since offline installs cannot rely on external dependencies.

---

## Matches (Relevant Features)

### 0019H-seguranca-deploy (CRITICAL PREREQUISITE)

**Type:** Hotfix — Security & Deploy hardening (Unit 1 of security remediation)

**Domain:** `seguranca-deploy`

**Relevance to 0026F:**
- Establishes **Docker deployment practices** (build + runtime strategy, CMD sequence)
- Introduces **fail-fast boot verification** (`verify-prod.ts`) that must survive local installs
- Defines **SESSION_SECRET** as critical deployment variable (≥32 chars, non-default)
- Establishes **RLS policy verification on boot** — essential for multi-tenant safety in local copies

**Touched Files:**
- `lib/auth/session.ts` — SESSION_SECRET fail-fast guard (production mode)
- `scripts/verify-prod.ts` — RLS assertion script (checks all `tenant_id` tables have policies)
- `Dockerfile` — CMD sequence: `db:setup && verify:prod && start`
- `package.json` — script `verify:prod`

**Patterns Used:**
- `fail-fast-boot-guard` — errors on startup rather than silent degradation
- `rls-assertion-on-startup` — SQL catalog inspection to verify isolation
- `secure-by-default-no-silent-fallback`

**Key Decisions:**
- Boot failure (non-zero exit) is the correct behavior if SESSION_SECRET missing or RLS broken — no fallback to insecure defaults
- `drizzle-kit push` alone drops RLS policies; must always follow with `db:rls` (handled in `db:setup`)
- Verification happens in container startup (`CMD`), not in CI

**For 0026F:**
- Local installs **must** preserve the `verify-prod.ts` check to ensure migrated data has RLS intact
- Local installs **must** generate a valid SESSION_SECRET (or inherit from production if same key is acceptable)
- `docker-compose.prod.yml` model can be adapted for local; boot sequence pattern is reusable
- If local install process includes `db:setup` (push + RLS), the RLS policies will be automatically applied

**Reference:** `docs/features/0019H-seguranca-deploy/about.md` + `changelog.md`

---

### 0020F-camada-dados-services (CRITICAL PREREQUISITE)

**Type:** Feature — Data layer & services refactoring (Unit 2 of security remediation)

**Domain:** `data-layer-services`, `push-only-migrations`, `rls-regression`

**Relevance to 0026F:**
- **Officially establishes push-only migration strategy** (source of truth: Drizzle snapshot in `db/schema/`)
- Formalizes **RLS on all `tenant_id` tables** as non-negotiable contract
- Provides **RLS regression test suite** that validates isolulation across all 19+ tenant tables
- Removes stale migration `0000` and retires `db:migrate` script — only `db:setup` is canonical

**Touched Files:**
- `db/schema/` — definitive schema source
- `db/__tests__/tenant-isolation-regression.test.ts` — parametrized isolation test for all `tenant_id` tables
- `db/__tests__/override-log-index.test.ts` — performance verification
- `db/__tests__/migration-strategy.test.ts` — push-only validation
- `CLAUDE.md` — officially documents push-only strategy
- `package.json` — `db:setup` (canonical), `db:migrate` removed

**Patterns Used:**
- `push-only-migrations` — schema snapshot is source of truth; no versioned migration files
- `rls-regression-suite` — automated check that every table with `tenant_id` has isolaton policy
- `schema-derived-guards` — test suite auto-discovers tables with `tenant_id` column, ensuring no table can evade RLS

**Key Decisions:**
- `drizzle-kit push --force` + `db:rls` is the only path to deploy schema changes
- No `db:migrate` or manual migration versioning in this project
- RLS policies are separate SQL files (in `db/migrations/*_rls.sql`), not Drizzle-managed
- `db:setup` is idempotent and safe to re-run (it will create/update schema + policies)

**For 0026F:**
- **Database dump/restore from production to local must preserve RLS policies** — they are not re-created by `db:setup` from Drizzle alone; the `*_rls.sql` files must be applied
- **When migrating a tenant's data locally, the regression suite must pass** to verify isolation is intact
- **Local install initialization should run `npm run db:setup`** to apply canonical schema and policies
- **If any RLS policy is missing in the dumped database, the boot verification (0019H's `verify-prod.ts`) will catch it and fail the container**

**Reference:** `docs/features/0020F-camada-dados-services/about.md` + `changelog.md` + `discovery.md`

---

### 0016F-fotos-produto (CONFLICTING ASSUMPTION — OFFLINE RISK)

**Type:** Feature — Product photo upload & storage

**Domain:** `fotos-produto`, `R2-object-storage`, `cloud-integration`

**Relevance to 0026F:**
- **Introduces external dependency (Cloudflare R2) that local/offline installs cannot assume**
- Uses 5 environment variables (`R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`)
- Product photos are stored off-server; local installs will not have R2 credentials or bucket access
- Upload route handler (`POST /api/products/[id]/upload`) depends on R2 client initialization

**Touched Files:**
- `lib/services/storage/r2-client.ts` — lazy-initialized R2 client (reads env vars on first use)
- `lib/services/products/image-service.ts` — upload, resize to WebP 600x600, store in R2
- `lib/services/products/product-service.ts` — calls image-service for upload/delete
- `app/api/products/[id]/upload/route.ts` — FormData handler, delegates to image-service
- `db/schema/products.ts` — `image_key` + `image_url` columns (nullable)
- `.env.example` — documents 5 R2 vars
- `scripts/r2-check.ts` — validates R2 env vars (production check)
- `docker-compose.prod.yml` — passes 5 R2 vars to container

**Patterns Used:**
- `lazy-r2-client` — R2 client not initialized at import time; only when first photo is uploaded (keeps build static)
- `multi-tenant-r2-prefixing` — chave format: `<slug-nome-loja>-<tenantId>/<uuid>.webp` (tenant isolation via prefix, not ACL)
- `decouple-photo-from-product` — upload failure does not block product create/edit (async tolerance)
- `multi-fallback-display` — foto → emoji → ícone generic (graceful degradation if foto missing)

**Breaking for Offline Installs:**
- Product upload route will fail at runtime if R2 vars are absent
- Photos cannot be uploaded in local installs without R2 credentials
- Existing photos (in production) will not be available in local copy (only database references remain)

**For 0026F:**
- **Option A (Strip R2 in local mode):** Disable upload route / feature flag photo upload when R2 vars are absent
- **Option B (Local storage fallback):** Implement local file storage (e.g., `/opt/pdv/photos/`) as alternative when R2 is unavailable
- **Option C (Migrate photos to local):** Include script to download existing photos from R2 bucket during migration
- **Decision needed:** Scope decision — is photo support required in local installs, or acceptable to lose it?

**Impact on Migration:**
- When migrating a tenant from cloud to local, database references (`image_url` + `image_key`) will point to R2 URLs that may or may not be accessible from the local network
- If photos are critical, local install must include either fallback storage or mechanism to download from cloud during cutover

**Reference:** `docs/features/0016F-fotos-produto/about.md` + `changelog.md` + `discovery.md`

---

### 0011F-super-admin-billing (PATTERN — MULTI-TENANT SUBSCRIPTION)

**Type:** Feature — Super-admin panel, subscription lifecycle, founder impersonation

**Domain:** `super-admin-billing`, `subscriptions`, `multi-tenancy-isolation`

**Relevance to 0026F:**
- Defines **subscription state model** (trial → active → locked) that gates all business operations
- Introduces **founder-level operations** (cross-tenant queries under RLS bypass)
- Establishes **impersonation pattern** (founder can enter any tenant, operations still isolated by session GUC)
- Database has `subscriptions` table with `valid_until`, `status` enum, and `is_founder` flag on users

**Touched Files:**
- `db/schema/` — `subscriptions` table, `users.is_founder`
- `lib/services/subscriptions/` — status derivation (no cron; derived from `valid_until`)
- `lib/services/admin/tenant-admin-service.ts` — cross-tenant queries (upgraded in 0020F)
- `app/(admin)/superadmin/` — founder-only admin panel

**Patterns Used:**
- `subscription-state-machine` — status is derived (no background jobs); all operations check status at write time
- `owner-bypass-connection` — founder reads cross-tenant data via separate `app_user` role mode (not admin DB user)
- `conditional-route-group-layout` — `(admin)` route group with custom layout (isolated from app navigation)

**For 0026F:**
- **Local installs need a strategy for subscription state:** options include:
  - Seed local install with unlocked subscription (trial or perpetual)
  - Migrate production subscription state as-is (locked if expired)
  - Auto-unlock or extend `valid_until` for local copy to maintain functionality
- **Founder credentials:** if the migrated tenant is the founder, ensure `is_founder` flag is preserved
- **Decision needed:** What subscription state should a local install start in?

**Reference:** `docs/features/0011F-super-admin-billing/changelog.md` (no separate about.md; see BRN reference)

---

### 0002F-venda-rapida-mercado (PATTERN — RLS & TRANSACTIONS)

**Type:** Feature — Fast checkout/POS screen

**Domain:** `vendas`, `caixa`, `rls-multitenancy`, `transactional-service`

**Relevance to 0026F:**
- Establishes **RLS isolation pattern** in services (all queries within `withUserRls` tx context)
- Defines **transactional consistency** across `sales` + `sale_items` + `stock_movements` (retrofit in 0003F)
- Snapshot isolation model: server resolves price/name at sell time, never trusts client

**Patterns Used:**
- `server-actions` — async boundaries for mutations
- `rls-multitenancy` — `withUserRls` wraps all data access
- `transactional-service` — multi-table changes in single Postgres transaction

**For 0026F:**
- **Database migration must preserve sales history** (including `tenant_id` isolation)
- **RLS must remain intact on `sales` + `sale_items` tables** during migration
- Service patterns are reusable (no changes needed for local deployment)

**Reference:** `docs/features/0002F-venda-rapida-mercado/changelog.md`

---

### 0003F-estoque (PATTERN — LEDGERS & RLS)

**Type:** Feature — Inventory management

**Domain:** `estoque`, `stock-movements`, `rls-multitenancy`

**Relevance to 0026F:**
- Introduces **signed-delta ledger pattern** (`stock_movements` table with +/−/± deltas)
- Establishes **RLS on movement history** (production tenants cannot see other tenants' inventory)
- Retrofit pattern: 0002F (sales) calls into 0003F (stock moves) within same transaction

**Patterns Used:**
- `signed-delta-ledger` — movements are immutable; corrections are new entries
- `retrofit-integration` — feature A (venda) retroactively integrates with feature B (estoque)
- `rls-multitenancy`

**For 0026F:**
- **Ledger integrity:** when dumping/restoring stock_movements, referential integrity to sales must be preserved
- **RLS validation:** regression suite (0020F) will verify estoque table isolation

**Reference:** `docs/features/0003F-estoque/changelog.md`

---

## No Match (Briefly Evaluated, Not Relevant)

- **0004F-financeiro** — domain-specific (receivables, payables); uses same RLS patterns but no deployment novelty
- **0005F-lucro** — reporting only; no data structure or migration impact
- **0006F-comanda-mesa** — domain-specific (table management); no deployment impact
- **0007F-impressao** — domain-specific (receipt printing); no deployment impact
- **0010F-mobile-responsive** — layout refactor; no data or deployment changes
- **0013F-liberacao-meses** — feature flag; no structural impact
- **0014F-usuarios-permissoes** — RLS patterns exist; introduces `user_permissions` and `override_log` tables but no unique deployment concern beyond 0020F RLS patterns already captured
- **0015F-manual-ajuda** — documentation feature; no deployment impact
- **0017H-super-admin-bypass-permissoes** — admin override patterns; covered under 0011F/0020F
- **0018F-rebrand-logo** — UI only; no data or deployment impact
- **0021C-doc-convencoes**, **0022C-xray-patterns** — internal documentation; no impact
- **0023H-inputs-visiveis-login-mobile**, **0024H-produto-mobile-layout-salvar**, **0025F-categorias-produto** — UI/domain features; use existing patterns but no new deployment concerns

---

## Critical Context: Production Deployment Model (from CLAUDE.md + observed Dockerfile)

**Current (Cloud) Architecture:**
1. **Build:** Multi-stage Dockerfile (`builder` → `runner`)
2. **Dependencies:** `npm ci` (frozen lockfile)
3. **Schema:** `npm run db:setup` on boot (push + RLS)
4. **Seed:** `seed-product-categories.ts` (idempotent, seeded categories for new tenants)
5. **Verification:** `npm run verify:prod` (SESSION_SECRET + RLS policy check)
6. **Runtime:** `npm start` (Next.js server on port 3000)
7. **Environment:** DATABASE_URL, SESSION_SECRET, R2_* (5 vars)
8. **Storage:** Postgres (RDS-like or self-hosted), Cloudflare R2 (photos)
9. **Orchestration:** Docker (manual `docker-compose.prod.yml` or Coolify/Docker)

**Relevant Container Commands (from Dockerfile):**
```dockerfile
CMD ["sh", "-c", "npm run db:setup && npx tsx scripts/seed-product-categories.ts && npm run verify:prod && npm start"]
```

This sequence must be preserved or adapted for local installs to ensure:
- Schema is current (push-only)
- RLS policies exist
- Boot verification catches configuration errors early
- Seed data is available (categories in this case)

---

## Database Migration Checklist for 0026F

1. **Schema + RLS Integrity:**
   - Dump must preserve all `tenant_id` columns and their type constraints
   - `*_rls.sql` policies must be applied during restore (or via `db:setup` if schema push)
   - Regression suite (`tenant-isolation-regression.test.ts` from 0020F) should pass post-restore

2. **Multi-Tenant Data:**
   - All business tables have `tenant_id` FKs; foreign keys should remain valid
   - Historical data (sales, movements, etc.) must retain tenant isolation
   - No orphaned records (e.g., sales without a matching tenant)

3. **Photos (0016F Risk):**
   - `image_key` + `image_url` columns are nullable; missing R2 access is tolerable
   - Decision: keep references (links dead in local) or clear columns during migration?

4. **Subscription State (0011F):**
   - `subscriptions.valid_until` will likely be in the past post-migration
   - Decision: unlock locally, extend `valid_until`, or migrate as-is (locked)?

5. **Environment Variables:**
   - Local install will have different DATABASE_URL (local Postgres)
   - Must generate new SESSION_SECRET (≥32 chars, non-default)
   - R2_* variables: omit or provide dummy values (feature gracefully degrades)

---

## Dependency Graph (for 0026F)

```
0026F (local install packaging)
  ├─→ 0019H (boot verification, SESSION_SECRET hardening)
  ├─→ 0020F (push-only migrations, RLS regression suite)
  ├─→ 0016F (photo storage — CONFLICT: R2 not available offline)
  ├─→ 0011F (subscription model — decide local unlock strategy)
  ├─→ 0002F–0009F (core features using RLS patterns — no changes needed)
  └─→ (Docker + `docker-compose.prod.yml` as foundation)
```

---

## Metadata

```json
{
  "updated": "2026-08-04",
  "feature": "0026F-instalacao-local",
  "matches": 5,
  "total_analyzed": 21,
  "conflicts": 1,
  "prerequisites": 2,
  "patterns": 8,
  "by": "discovery-agent"
}
```
