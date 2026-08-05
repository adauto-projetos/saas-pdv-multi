---
id: 0026F-discovery
type: discovery
created: 2026-08-04
updated: 2026-08-04
related: [0019H, 0020F, 0016F, 0011F, 0002F, 0003F]
---

# Discovery: 0026F — Instalação Local (Packaging & Data Migration)

## Summary

Feature packages the existing PDV SaaS (currently cloud-only at pdv.art.br) for single-client installation on their own Windows PC, with Postgres local + repeatable update mechanism. **Critical dependencies:** push-only migrations (0020F), boot verification hardening (0019H), and RLS regression suite. **Scope complexity:** medium-high (touches Docker, DB migration, env configuration, photo storage offline fallback). **Core unknowns:** subscription unlock strategy for local, photo handling when R2 is unavailable, whether Docker Desktop is acceptable friction for target user (small shop owner, non-technical).

```json
{
  "complexity": "medium-high",
  "risk_areas": ["multi-tenant RLS integrity in migration", "R2 photo storage offline", "subscription state unlock", "Docker friction for non-technical user"],
  "affected_layers": ["database", "infrastructure", "scripts", "docker configuration"],
  "decision_blockers": ["photo strategy (strip/fallback/download)", "subscription auto-unlock vs. migrate-as-is", "Docker Desktop requirement acceptance"],
  "estimated_scope": "7–12 days (including migration script, Docker setup docs, photo fallback, update mechanism, testing)"
}
```

---

## Technical Context

### Current Deployment Architecture (Cloud)

**Status:** v0.16.0 on pdv.art.br (Hetzner VPS via SSH)

**Build & Packaging:**
- Multi-stage Dockerfile (builder → runner) builds Next.js app
- `npm ci` (frozen lockfile) for reproducibility
- `npm run build` produces `.next/` bundle
- Runtime copies everything from builder (includes `drizzle-kit` as devDep)

**Database Schema & Migration:**
- **Strategy:** Push-only (0020F decision)
  - Drizzle schema in `db/schema/` is source of truth
  - `npm run db:setup` = `drizzle-kit push --force` + `tsx scripts/apply-rls.ts`
  - No `db:migrate`; no versioned migration files (except RLS policies in `db/migrations/*_rls.sql`)
  - RLS policies applied separately after push (workaround: `drizzle-kit push` drops them; `apply-rls.ts` recreates)

**Boot Sequence (Dockerfile CMD):**
```bash
npm run db:setup \                                # push schema + apply RLS
  && npx tsx scripts/seed-product-categories.ts \ # seed default categories (0025F)
  && npm run verify:prod \                        # SESSION_SECRET + RLS validation (0019H)
  && npm start                                     # Next.js server on port 3000
```

**Key File Paths:**
| Item | Path |
|------|------|
| Dockerfile | `Dockerfile` (lines 1–33) |
| Local docker-compose | `docker-compose.yml` (Postgres 16, no app container) |
| Prod docker-compose | `docker-compose.prod.yml` (Postgres + app, port 80:3000 direct) |
| Prod deploy script | `scripts/deploy.sh` (bumps version, commits, SSH deploys) |
| RLS application | `scripts/apply-rls.ts` |
| Boot verification | `scripts/verify-prod.ts` |
| Product category seed | `scripts/seed-product-categories.ts` |
| Package.json scripts | `package.json` lines 5–21 |

**Environment Variables (Production):**
```
DATABASE_URL = postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/pdv
POSTGRES_PASSWORD = (strong, from secrets)
SESSION_SECRET = (32+ chars, random)
R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL = (0016F)
NODE_ENV = production
PORT = 3000
```

**Versioning & Release:**
- Manual: `scripts/deploy.sh` runs `npm version patch --no-git-tag-version`, commits, tags, and SSHs to Hetzner
- Version bumps correlate to feature merges (git log shows pattern: chore(release): bump version para X.X.X)
- Git tags: `v0.1.0` → `v0.16.0`, sequential semver

---

## Multi-Tenancy & RLS Model (CRITICAL)

### Schema Structure
Every business table has mandatory `tenant_id` column (FK to `tenants.id`). RLS enforces isolation via `app_user` role:

**RLS Pattern (example: `products` table, db/migrations/0002_product_rls.sql):**
```sql
CREATE POLICY "tenant_isolation" ON "products"
  FOR ALL TO app_user
  USING ("tenant_id" IN (SELECT current_app_tenants()))
  WITH CHECK ("tenant_id" IN (SELECT current_app_tenants()));
```

**Tables with `tenant_id` (20 total, from regression test db/__tests__/tenant-isolation-regression.test.ts lines 21–26):**
products, product_categories, customers, sales, sale_items, comandas, comanda_items, kitchen_order_seqs, print_logs, stock_movements, cash_sessions, cash_movements, receivables, receivable_payments, payables, payable_payments, subscription_log, override_log, user_permissions, tenant_members

**Session Context Injection (db/rls.ts lines 25–42):**
```typescript
withUserRls(userId: string, fn: (tx: RlsTx) => Promise<T>): Promise<T>
  ├─ SET app.current_user_id = ${userId}  (GUC injected into session)
  ├─ SET role app_user                    (no bypass, RLS active)
  └─ Executes fn(tx) — all queries filter by current_app_user()
```

**Risk for Migration:** A dump of a single tenant's data that loses `tenant_id` integrity or RLS policies will violate the multi-tenant contract. Boot verification (0019H) catches this, but migration script must be meticulous.

---

## Database Migration Path: Cloud → Local

### Current State
- Production: Single Postgres on Hetzner (`db_pdv_pgdata` named volume)
- Local dev: Docker `docker-compose.yml` with empty Postgres 16
- No existing dump/restore tooling; no migration script

### Migration Requirements

**1. Dump Single Tenant's Data**
- Must include schema (tables, constraints, RLS policies)
- Must include data: all rows where `tenant_id` = target tenant
- Foreign key integrity: e.g., if `sales` row references `customers.id`, that customer must be in dump
- Orphan risk: products without categories, sales without customers, etc.

**2. Schema + RLS Integrity**
- Option A (Recommended): Full schema dump (all tables, structure) + single tenant's data
  - Preserves exact RLS policies from production
  - Safest approach but largest dump
- Option B (Minimal): Just target tenant's data rows + recreate schema via `npm run db:setup`
  - Smaller dump, but relies on schema snapshot (db/schema/) being up-to-date
  - RLS policies auto-applied by apply-rls.ts
  - If production has schema drift, small risk

**3. Subscription State Decision**
- Production tenant likely has `subscriptions.valid_until` in past (locked)
- Local install must be usable immediately (no "subscription expired" gate)
- **Decision required:** 
  - Auto-extend `valid_until` to +1 year?
  - Seed with trial subscription?
  - Migrate as-is and handle UI "offline mode" gracefully?

**4. Photo References (0016F Conflict)**
- `image_url` columns point to R2: `https://<id>.r2.cloudflarestorage.com/…`
- Local install has no R2 access
- **Decision required:**
  - Strip `image_url` + `image_key` during migration (lose photo history)?
  - Keep references but show fallback emoji (graceful degrade, links dead)?
  - Download from R2 and store locally? (requires R2 credentials + local storage solution)

**Concrete pg_dump Flow (Concept):**
```bash
# On Hetzner production (or backup):
pg_dump --host db --username postgres --dbname pdv \
  --schema public \
  --table 'tenants' \
  --table 'users' \
  --table 'products' \
  --table 'sales' \
  --table 'stock_movements' \
  ... (all 20+ tenant_id tables) \
  --where "tenants.id = '${TARGET_TENANT_ID}'" \
  > tenant_dump.sql

# On local machine:
docker compose -f docker-compose.yml up -d db  # wait for healthy
psql -U postgres -d pdv < tenant_dump.sql
npm run db:setup  # reapply schema + RLS (idempotent)
npm run verify:prod  # assert RLS intact
```

**Testing Migration Integrity:**
```bash
npm test  # should run tenant-isolation-regression.test.ts if DATABASE_URL set
# Regression suite auto-discovers all tenant_id tables and verifies isolation
```

---

## Docker Desktop Friction for Non-Technical User

### Requirement
- Target: Small shop owner (lanchonete, mercado) on Windows PC
- Technical level: Non-technical (can navigate file system, download files, not developer)
- Machine: Windows 11 Pro (available in .env context; WSL2 capable)

### Docker Desktop Prerequisites

| Requirement | Windows 11 Feasibility | Friction Level |
|---|---|---|
| **WSL2 enabled** | Required; Windows 11 Pro has it but may need activation | Medium — needs one-time setup (Enable-WindowsOptionalFeature -FeatureName VirtualMachinePlatform) |
| **Docker Desktop installed** | Free version available; ~700 MB download | Low — straightforward installer |
| **~2–4 GB RAM allocated to WSL2** | Depends on machine; small shops may have limited RAM | Medium-High — some machines may struggle; guidance needed |
| **Port 5432 (Postgres) + port 3000 (app) available** | Likely; conflict if other services run | Low — advise user to check |

### Current Docker Configuration
- `docker-compose.yml` uses `Postgres 16` (latest stable alpine)
- App container in prod uses Node 22-alpine (lightweight)
- No resource limits set (no `resources.limits` in compose); will use host defaults

### Mitigation Recommendations (for about.md/plan)
1. **Setup guide:** Step-by-step: Windows → WSL2 activation → Docker Desktop installer → verify with `docker ps`
2. **Resource check:** Script to warn if <2 GB RAM available or port 3000/5432 in use
3. **Alternative (future):** Portable standalone (SQLite + embedded Node) — eliminates Docker friction but trades off architecture simplicity

---

## RLS Boot Verification (0019H Integration)

### Existing Guard: `scripts/verify-prod.ts`
Runs in container startup BEFORE `npm start`. Fails the container (exit 1) if:

**Condition 1: SESSION_SECRET in Production**
```typescript
// lines 27–35
if (process.env.NODE_ENV === "production") {
  if (!value || value.length < 32 || value === "dev-insecure-secret-change-me") {
    throw new Error("SESSION_SECRET ausente, fraco ou igual ao default de dev em produção...")
  }
}
```

**Condition 2: RLS Policies Intact**
```typescript
// lines 46–61: Catalog query discovers all tables with tenant_id column
SELECT c.relname, c.relrowsecurity, EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS has_policy
FROM pg_class c JOIN pg_namespace n ON ... WHERE a.attname = 'tenant_id'
```

For each table:
- ✅ RLS enabled (`relrowsecurity = true`)?
- ✅ At least one policy exists (`has_policy`)?

Failure example: If `drizzle-kit push` ran without subsequent `apply-rls.ts`, container fails immediately.

### Impact on Local Install
- **Same guard applies:** Local install must also run `db:setup` (push + RLS) before `verify:prod`
- **Benefit:** Catches misconfiguration early; prevents serving with isolation broken
- **No changes needed to verify-prod.ts** — just ensure `npm run db:setup` runs first

---

## Photo Storage & R2 Offline Fallback (0016F Conflict)

### Current Implementation (0016F — Feature Active)

**Files Touched:**
- `lib/services/storage/r2-client.ts` — lazy-initialized R2 client
- `lib/services/products/image-service.ts` — upload, resize, store in R2
- `app/api/products/[id]/upload/route.ts` — FormData endpoint
- `db/schema/products.ts` — columns: `image_key`, `image_url` (nullable)
- `.env.example` — 5 R2 vars documented (lines 19–30)
- `scripts/r2-check.ts` — validates R2 env at boot

**Upload Flow:**
```
POST /api/products/[id]/upload
  → image-service.uploadProductImage(tenantId, productId, File)
    → r2-client.putObject(key, buffer)
    → update DB: products.image_key, products.image_url
  ✅ Success: photo stored in R2, URL persisted
  ❌ Fail (R2 unavailable): error thrown, product update fails
```

**Display Logic (fallback, components/products/ProductCard.tsx or similar):**
Presumably: foto (R2) → emoji → generic icon

### Problem for Local Installs
- R2 requires: 5 env vars (account, bucket, credentials, URL)
- Local install unlikely to have Cloudflare R2 access
- Uploading new photos will fail at runtime
- Existing photos (migrated) will reference dead R2 URLs

### Solution Options (Decision Needed in about.md)

**Option A: Strip Photos During Migration**
```sql
UPDATE products SET image_key = NULL, image_url = NULL WHERE tenant_id = ?
```
Pros: Clean, no dead links. Cons: Lose photo history.

**Option B: Local File Storage Fallback**
Add conditional logic: if R2 env vars absent, store photos locally (e.g., `/opt/pdv/photos/` mounted in docker-compose)
- Requires: New `LocalStorageService` or config toggle in image-service
- Moderate implementation effort
- Preserves upload functionality

**Option C: Download from R2 During Migration (if credentials available)**
Include script to download photos from production R2 bucket and store locally
- Requires: R2 credentials passed to migration process
- Heaviest implementation
- Best UX (preserves photo history + upload works)

**Recommendation for Scope:** Start with **Option A** (strip) for 0026F MVP. Photo re-upload is possible locally if user has them saved. **Option B or C can be Phase 2.**

---

## Update Mechanism (Version Delivery to Local Install)

### Current Release Process (Production)
1. Merge feature branch to master
2. Run `bash scripts/deploy.sh`
   - Bumps version via `npm version patch`
   - Commits + tags + pushes to GitHub
   - SSHs to Hetzner, `git pull`, rebuilds Docker, restarts

### Local Install Update Requirements
- No CI/CD pipeline on user's machine
- User should NOT run `bash scripts/deploy.sh` (requires SSH key, GitHub push access)
- Simple update path: **"Download latest release, run setup script"**

### Proposed Update Mechanism (for 0026F scope)

**Option 1: GitHub Releases + Manual Download**
- Publisher: Runs existing `deploy.sh`, which auto-tags `v0.16.0`
- User: Downloads `v0.16.0.zip` (compiled app + Dockerfile) from GitHub Releases
- User: Runs local update script: `bash scripts/update-local.sh` (pulls new version, rebuilds Docker, restarts)
- Effort: Minimal (leverage existing versioning, add 1 script)

**Option 2: Auto-Update Checker (App UI)**
- App boots, checks GitHub Releases API for newer version
- If newer available, shows "Update Available" button in UI
- User clicks → downloads + restarts app
- Effort: Medium (HTTP client, UI component, restart logic)

**Option 3: Update Script + Installer (Beginner-Friendly)**
- Ship `install-local.sh` (one-time: downloads v0.16.0, sets up docker-compose, creates shortcuts)
- Ship `update-local.sh` (periodic: `git pull`, rebuilds, restarts)
- Effort: Medium (shell scripts, error handling, user guidance)

**Recommendation for 0026F:** **Option 1** (leverages existing `deploy.sh` versioning, minimal new code). Later: Option 2 for better UX.

**Versioning Integration:**
- No changes needed to `package.json` version bumping (existing deploy.sh handles it)
- No changes to git tagging (existing deploy.sh handles it)
- New file: `scripts/update-local.sh` (pulls latest tag, rebuilds, restarts containers)

---

## SESSION_SECRET Management for Local Installs

### Current Guard (lib/auth/session.ts lines 16–30)
```typescript
const MIN_SECRET_LEN = 32;
const DEV_SECRET = "dev-insecure-secret-change-me";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!value || value.length < 32 || value === DEV_SECRET) {
      throw new Error("SESSION_SECRET ausente, fraco ou igual ao default...")
    }
  }
  return value ?? DEV_SECRET
}
```

### Local Install Requirement
- Local install runs in `NODE_ENV=production` (docker-compose.prod.yml line 34)
- If `.env` file is missing or SESSION_SECRET absent, boot fails
- **Solution:** Generate strong SESSION_SECRET during initial setup

### Proposed Approach (for 0026F scope)
1. **Setup Script generates SECRET:**
   ```bash
   # install-local.sh or initial docker-compose up
   SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   echo "SESSION_SECRET=$SESSION_SECRET" >> .env
   ```
   
2. **Document in .env file:**
   - Copy `.env.example` to `.env`
   - Script replaces `SESSION_SECRET=troque-por-um-valor-aleatorio-bem-longo` with actual random value
   - User never handles the secret manually

3. **No Changes to Codebase:**
   - `lib/auth/session.ts` guard remains as-is
   - `scripts/verify-prod.ts` remains as-is
   - Only setup script logic changes (shell script, not TypeScript)

---

## Hardcoded Domain/Cookie Assumptions

### Analysis: Cookie Configuration
**File:** `lib/auth/session.ts` lines 53–61
```typescript
store.set(COOKIE_NAME, sign(userId), {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: MAX_AGE,
});
```

**Observations:**
- ✅ **No hardcoded domain:** Not set (allows localhost, 192.168.x.x, any domain accessing the server)
- ✅ **sameSite: "lax":** Permissive; fine for local machine
- ✅ **secure flag tied to NODE_ENV:** In local, secure=false (over HTTP); in prod, secure=true (over HTTPS)
- ✅ **Path: "/":** Works everywhere

**No Changes Needed:** Cookie logic is generic; works on localhost, LAN IP, any domain.

### Analysis: Hardcoded URLs
**Grep Result:** No `pdv.art.br`, `localhost:3000`, or domain-specific references in TypeScript/React code
- `playwright.config.ts` may have test URLs (ignored for runtime)
- `.md` docs mention pdv.art.br (documentation only, not code)

**No Changes Needed:** App is domain-agnostic; works at http://localhost:3000, http://192.168.1.100:3000, etc.

### Analysis: CORS / API Calls
- Next.js 16 uses server actions (not REST API + fetch)
- No `fetch()` from browser to external APIs (except R2, which is lazy/optional)
- No CORS headers needed

**No Changes Needed:** No CORS friction for local installs.

### Conclusion: Cookie & Domain
**No modifications to codebase required.** App runs unmodified on localhost or LAN IP. Only `.env` changes (DATABASE_URL, SESSION_SECRET, R2_* optional).

---

## Related Features

This feature depends on and integrates with the following prior features:

| Feature | Type | Domain | Integration with 0026F | Ref |
|---------|------|--------|------------------------|-----|
| {{doc:0019H}} | Hotfix | Boot verification, SESSION_SECRET hardening | Local installs must preserve boot guards (fail-fast for missing SECRET, broken RLS) | `scripts/verify-prod.ts` |
| {{doc:0020F}} | Feature | Push-only migrations, RLS regression suite | Migration must preserve schema via push-only path; regression test validates isolation post-migration | `npm run db:setup`, `db/__tests__/tenant-isolation-regression.test.ts` |
| {{doc:0016F}} | Feature | R2 photo storage | Photos cannot be uploaded locally without R2 creds; existing photos reference dead R2 URLs; decision: strip/fallback/download | `lib/services/storage/r2-client.ts`, `.env` R2_* vars |
| {{doc:0011F}} | Feature | Subscription lifecycle, super-admin | Local install subscription likely locked (past valid_until); decision: auto-unlock vs. migrate as-is | `db/schema/subscriptions.ts`, `lib/services/subscriptions/` |
| {{doc:0002F}} | Feature | Sales & RLS patterns | Migration must preserve sales history + `tenant_id` isolation; RLS pattern reusable for local | `lib/services/sales/`, `db/schema/sales.ts` |
| {{doc:0003F}} | Feature | Inventory ledger & RLS | Migration must preserve stock movements (immutable ledger) + `tenant_id` isolation | `lib/services/stock/`, `db/schema/stock-movements.ts` |

---

## Identified Prerequisites

### 1. Database Schema Snapshot (0020F)
- **Prerequisite:** Drizzle schema in `db/schema/` must be up-to-date
- **Why:** Migration will use `npm run db:setup` (push-only) to recreate schema locally
- **Status:** ✅ 0020F completed; schema is canonical
- **Action:** No changes needed

### 2. RLS Policies (0020F)
- **Prerequisite:** `*_rls.sql` files in `db/migrations/` must be complete
- **Why:** `apply-rls.ts` applies them after push; missing policies fail boot verification
- **Status:** ✅ 0020F completed; 20+ tables covered
- **Action:** No changes needed

### 3. Boot Verification (0019H)
- **Prerequisite:** `verify-prod.ts` must pass (SESSION_SECRET + RLS check)
- **Why:** Local install boot will reuse same verification
- **Status:** ✅ 0019H completed; guard is in place
- **Action:** No changes needed

### 4. Subscription Model (0011F)
- **Prerequisite:** Understanding of subscription state machine (trial → active → locked)
- **Why:** Migrated tenant's subscription will likely be locked (past expiry); scope decision needed
- **Status:** ✅ 0011F completed; model is defined
- **Action:** Decide: auto-extend or migrate as-is (add to about.md questionnaire)

### 5. Photo Upload Logic (0016F)
- **Prerequisite:** Understanding of R2 lazy-loading and fallback display
- **Why:** Local install cannot upload without R2 creds; need graceful degrade strategy
- **Status:** ✅ 0016F completed; lazy-load pattern + fallback emoji exist
- **Action:** Decide: strip/fallback/download (add to about.md questionnaire)

---

## Identified Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **RLS Policy Loss in Migration** | Migrated data usable only by first user; subsequent users see data from other tenants (data leak) | Test with regression suite post-migration; verify-prod.ts catches missing policies at boot |
| **Foreign Key Orphans** | Products without categories, sales without customers — referential integrity broken | Include validation script: scan for orphans before dump; backfill or exclude orphan data |
| **Subscription Locked** | Local install boots but all business operations gated by "subscription expired" — app unusable | Auto-extend valid_until +1 year during migration, OR document "offline mode" UI behavior |
| **Photo URLs Dead** | Migrated photos show broken links (or emoji fallback) | Decide early: strip photos (cleanest), or implement fallback storage |
| **Docker Desktop Friction** | Non-technical user unable to install WSL2 / Docker — no local install possible | Provide step-by-step setup guide; consider alternative (SQLite portable) as Phase 2 |
| **Update Script Fails** | User cannot update to new version — stuck on old version | Test update script thoroughly; include rollback logic (e.g., keep previous docker-compose volumes) |
| **SESSION_SECRET Collision** | If setup script generates weak secret, boot fails but misleadingly | Use `crypto.randomBytes(32)` (cryptographically strong); no custom generation |
| **Database Restore Fails** | `pg_restore` fails mid-way, leaving DB in inconsistent state | Dump schema + data together; test restore on clean machine before distributing |
| **Port 3000 Already In Use** | Docker bind fails; app doesn't start | Check/document port conflict check; offer alternative port mapping in update script |

---

## Delivery Completeness Check

**Question:** With this scope, can the end user **USE** the feature?

| Validated Requirement | Layer | Included? | User Can Use? |
|---|---|---|---|
| Extract tenant data from production | Backend/DB | ⚠️ TBD (migration script to build) | ❌ Without script |
| Import into local Postgres | Backend/DB | ⚠️ TBD (docker-compose setup) | ⚠️ Partial (compose exists, import process TBD) |
| Boot & run app locally | Frontend/Backend | ✅ (Dockerfile unchanged) | ✅ Yes (existing flow works) |
| RLS + multi-tenant isolation verified | Backend/DB | ✅ (verify-prod.ts + regression suite) | ✅ Yes (automated check) |
| Update to new version | Backend/DevOps | ⚠️ TBD (update script to build) | ❌ Without script |
| Upload new photos locally | Frontend/Backend | ⚠️ Partial (R2 unavailable, fallback TBD) | ⚠️ Maybe (depends on option A/B/C) |

**Scope Recommendation for 0026F MVP:**
- ✅ **In scope:** Docker setup for local, `db:setup` + `verify-prod` flow, RLS validation, SESSION_SECRET generation
- ✅ **In scope:** Migration script (pg_dump wrapper) for single tenant
- ⚠️ **Decide in about.md:** Photo strategy (recommend Option A: strip for MVP)
- ⚠️ **Decide in about.md:** Subscription unlock strategy (recommend: extend valid_until +1 year)
- ✅ **In scope:** Update mechanism (recommend Option 1: GitHub Releases + simple shell script)
- ❌ **Not in scope:** WSL2 auto-installer (out of scope; provide guide instead)
- ❌ **Not in scope:** Portable SQLite alternative (Phase 2)

---

## Affected Files & Changes (Preliminary)

### Create
- `scripts/install-local.sh` — Downloads release, sets up docker-compose, generates SESSION_SECRET
- `scripts/update-local.sh` — Pulls latest tag, rebuilds app container, restarts
- `scripts/migrate-tenant-local.ts` — Dumps single tenant from production, imports locally
- `docs/features/0026F-instalacao-local/SETUP.md` — Step-by-step for non-technical user
- `docs/features/0026F-instalacao-local/UPDATE.md` — How to update local install

### Modify
- `docker-compose.prod.yml` — May add version label / env for auto-update detection (Optional for Phase 2)
- `.env.example` — No changes (already documents all vars; local install uses subset)

### No Changes
- `Dockerfile` — Reuse as-is (push-only + RLS + seed + verify already in place)
- `lib/auth/session.ts` — Cookie logic is domain-agnostic
- `scripts/verify-prod.ts` — Guard logic is reusable
- `db/schema/` — Push-only strategy unchanged

---

## Assumptions & Open Questions

**Technical Assumptions (to verify in discovery phase):**
1. ✅ Docker-compose local flow (`docker compose up -d db` + `npm run db:setup`) is repeatable (no statefulness, idempotent schema push)
2. ⚠️ `pg_dump + pg_restore` preserves tenant_id integrity (assumption: no triggers/sequences that break)
3. ⚠️ RLS policies survive `pg_restore` (or are reliably reapplied by apply-rls.ts)
4. ✅ Boot verification guards (verify-prod.ts) don't rely on Hetzner-specific environment

**Business Assumptions (to clarify in about.md questionnaire):**
1. **Photo Storage Decision:** For MVP, strip photos (Option A) or implement fallback (Option B)?
2. **Subscription Unlock:** Auto-extend local subscription +1 year, or migrate locked state + show "offline mode" UI?
3. **Update Frequency:** How often should updates be pushed (per feature, per hotfix, per release)?
4. **Support Scope:** Is local installation expected to be "supported" (bug reports, patches), or best-effort only?
5. **Cutover Trigger:** When does local install become primary (vs. cloud as backup)? Founder-initiated toggle, or automatic after X days?

**Technical Unknowns (to resolve in plan phase):**
1. Does `pg_dump` on production Hetzner database correctly serialize RLS policies, or are they lost and must be recreated?
2. What is the actual size of single-tenant data dump (affects download/setup time for user)?
3. Are there any startup scripts or cron jobs on Hetzner that don't exist in local setup (e.g., daily backups)?

---

## Existing Patterns to Reuse

| Pattern | Location | Reuse in 0026F |
|---------|----------|---|
| **Push-only migrations** | 0020F + `npm run db:setup` | Use for local schema setup; no changes |
| **RLS regression validation** | `db/__tests__/tenant-isolation-regression.test.ts` | Run post-migration to assert isolation intact |
| **Boot verification** | `scripts/verify-prod.ts` | Reuse in Docker CMD for local; no changes |
| **Session cookie signing** | `lib/auth/session.ts` | Works domain-agnostic; no changes |
| **Drizzle schema as source of truth** | `db/schema/` | Use for local schema recreation |
| **Product category seeding** | `scripts/seed-product-categories.ts` | Reuse for local install (idempotent) |
| **Multi-tenant data isolation** | `withUserRls(userId, tx)` | Works unchanged; RLS enforced at DB layer |
| **Versioning via npm + git tags** | `scripts/deploy.sh` | Reuse for release mechanism; new update script |

---

## Technical Dependencies

### Internal
- `drizzle-orm@0.45.2` — ORM for schema + queries
- `drizzle-kit@0.31.10` — CLI for push-only migrations
- `postgres@3.4.9` — DB driver
- `next@16.2.7` — app framework (no schema-aware changes needed)
- `tsx@4.22.4` — TypeScript runner for scripts (seed, verify, migrate)

### External
- `PostgreSQL 16` (Docker) — local database
- `Node 22-alpine` (Docker) — runtime
- `Docker Desktop` — local orchestration (friction point)
- GitHub Releases (future) — version distribution

---

## Planning Summary

**Complexity:** Medium-high. Touches infrastructure (Docker), DB operations (dump/restore/RLS validation), scripts (migration + update), and requires user-facing setup documentation.

**Critical Path:**
1. Finalize scope decisions (photo strategy, subscription unlock) via about.md questionnaire
2. Implement migration script (pg_dump wrapper + tenant filtering + validation)
3. Add setup + update scripts (shell, non-TypeScript, for accessibility)
4. Test end-to-end: Docker + migrate + boot verification + RLS regression suite
5. Write user documentation (step-by-step setup for non-technical user)

**Attention Points:**
- RLS integrity is non-negotiable; regression suite must pass post-migration
- Photo handling (strip vs. fallback) impacts UX for first-time local user
- Subscription unlock strategy affects immediate usability
- Docker Desktop friction for non-technical user; may need fallback plan

**Prerequisite Features (already complete):**
- 0020F (push-only, RLS policies, regression suite)
- 0019H (boot verification, SESSION_SECRET guard)
- 0016F (photo upload logic; need to decide local fallback)
- 0011F (subscription model; need to decide unlock strategy)

---

## Updates

| Date | Change |
|------|--------|
| 2026-08-04 | Initial discovery: mapped Docker architecture, multi-tenancy model, migration path, RLS validation flow, photo storage conflict (0016F), subscription state decision (0011F), update mechanism options, Docker Desktop friction analysis, SESSION_SECRET + cookie domain assumptions. Identified 5 related features + 8 open questions for about.md questionnaire. |

---

## Metadata

```json
{
  "updated": "2026-08-04",
  "feature": "0026F-instalacao-local",
  "type": "discovery",
  "sessions": 1,
  "by": "discovery-agent",
  "related_features": [0019, 0020, 0016, 0011, 0002, 0003],
  "risks_identified": 8,
  "prerequisites_verified": 5,
  "unknowns": 3,
  "scope_decisions_needed": 2
}
```
