# Infrastructure Report

**Generated on:** 2026-06-28
**Score:** 8/10
**Status:** 🟢 Good (with actionable items)

---

## Summary

The infrastructure is in good shape for a self-hosted stack: PostgreSQL runs in Docker (local and prod composes present), environment variables are fully documented in `.env.example`, no secrets are committed to git, and `.gitignore` correctly excludes `.env*`. The dependency tree has 7 known advisories (1 high in `undici`, 6 moderate), of which the `undici` issue is auto-fixable. **Note on stack:** this project does NOT use Supabase — it uses self-hosted/local PostgreSQL with Drizzle ORM and Postgres Row Level Security. There is no Supabase MCP and none is expected; live DB introspection (MCP) is unavailable, so database/RLS analysis here is **static only** (schema files + RLS setup + migrations).

---

## Tools Status

| Tool | Status | Impact |
|------|--------|--------|
| Live DB introspection (MCP) | ❌ N/A by design | RLS/schema analysis is static-only (no live queries) |
| `.env.example` | ✅ | Environment variables fully documented |
| Docker Compose (local) | ✅ | Local Postgres environment defined |
| Docker Compose (prod) | ✅ | Production app + db stack defined |
| `package-lock.json` | ✅ | Reproducible dependency installs |
| npm audit | ✅ | Vulnerability analysis ran successfully |

---

## Database Analysis Tooling (Adapted — no Supabase)

### Status: Static analysis only

This project does not use Supabase and has no MCP-based DB introspection. **No live DB introspection tool is available**, and none is expected for this stack. Database and RLS analysis is performed by reading source artifacts statically:

| Artifact | Path | Purpose |
|----------|------|---------|
| Drizzle schema | `db/schema/` | Table/column definitions, `tenant_id` FKs |
| RLS setup | `db/rls.ts` + `npm run db:rls` | RLS policies, `withUserRls`, `app_user` role, `app.current_user_id` GUC |
| Migrations | Drizzle migration output / `npm run db:push` | Applied schema changes |

> ⚠️ `drizzle-kit push` drops RLS policies (it does not know them). `npm run db:rls` must run after any standalone `db:push` — or use `npm run db:setup`. This is a real operational footgun worth noting in any DB review.

### Available Capabilities

| Analysis | Available | Method |
|----------|-----------|--------|
| List tables | ✅ (static) | Read `db/schema/` |
| Check RLS policies | ⚠️ (static) | Read `db/rls.ts`; cannot confirm live-applied state |
| Execute queries | ❌ | No live connection in this audit |
| View migrations | ✅ (static) | Read migration files |

---

## Environment Variables

### Documented in `.env.example`

| Variable | Category | Sensitive |
|----------|----------|-----------|
| `DATABASE_URL` | Database | ✅ |
| `SESSION_SECRET` | Auth (cookie signing) | ✅ |
| `R2_ACCOUNT_ID` | Object storage (R2) | ⚠️ (identifier) |
| `R2_BUCKET` | Object storage (R2) | ❌ |
| `R2_ACCESS_KEY_ID` | Object storage (R2) | ✅ |
| `R2_SECRET_ACCESS_KEY` | Object storage (R2) | ✅ |
| `R2_PUBLIC_URL` | Object storage (R2) | ❌ |

Production-only variables (referenced by `docker-compose.prod.yml`, sourced from `/opt/pdv/.env` on the host, not in `.env.example`): `POSTGRES_PASSWORD`. All `R2_*` and `SESSION_SECRET` are also injected in prod via the host `.env`.

### Secret Hygiene

- ✅ **No `.env`, `.env.local`, or `.env.production` files are tracked in git.** `git ls-files | grep -iE '\.env'` returned `NO_ENV_FILES_TRACKED`.
- ✅ `.gitignore` contains `.env*`, so env files are excluded by default.
- ✅ `.env.example` contains only placeholder values (`troque-por-um-valor-aleatorio-bem-longo`, empty R2 secrets, local default DB creds) — no real secrets.
- ⚠️ The local dev Postgres password is `postgres` (default) in `docker-compose.yml` and `DATABASE_URL`. Acceptable for local Docker only; prod correctly parameterizes `POSTGRES_PASSWORD`.

### Issues

None critical. `.env.example` exists and is complete relative to the documented features.

#### [INF-001] Prod-only var not documented in `.env.example`
**Impact:** Low. `POSTGRES_PASSWORD` is required by `docker-compose.prod.yml` but absent from `.env.example`, so a new deployer must infer it.
**Fix:** Add a commented prod section to `.env.example` listing `POSTGRES_PASSWORD` (and note `R2_*`/`SESSION_SECRET` are required in prod too).

---

## Dependencies

`package-lock.json` is present (≈504 KB) — reproducible installs are possible.

`npm audit` summary: **7 total** — 0 critical, **1 high**, 6 moderate, 0 low.

### Vulnerabilities Found

| Package | Severity | Description | Fix |
|---------|----------|-------------|-----|
| `undici` | 🟠 High | Multiple: TLS cert validation bypass (SOCKS5 ProxyAgent), Set-Cookie header injection, WebSocket DoS, response queue poisoning, cross-origin routing, SameSite downgrade, cache info disclosure. Range 7.0.0–7.27.2 | ✅ Auto-fixable (`npm audit fix`, non-breaking) |
| `next` | 🟡 Moderate | Transitive via `postcss` (CSS Stringify XSS). Current: 16.2.7 | Fix marked semver-major (downgrade) — **do not apply**; track upstream |
| `postcss` | 🟡 Moderate | XSS via unescaped `</style>` in CSS Stringify output | Via `next`; resolves when next bumps postcss |
| `esbuild` | 🟡 Moderate | Dev server allows arbitrary cross-origin requests / file read (Windows). Dev-only | Fix marked semver-major via `drizzle-kit` downgrade — **do not apply** |
| `drizzle-kit` | 🟡 Moderate | Transitive via `@esbuild-kit/*` → `esbuild`. Dev dependency | Same as esbuild — dev-only |
| `@esbuild-kit/core-utils` | 🟡 Moderate | Via `esbuild` | Dev-only |
| `@esbuild-kit/esm-loader` | 🟡 Moderate | Via `@esbuild-kit/core-utils` | Dev-only |

### Recommendation

```bash
npm audit fix   # safely resolves the high-severity undici advisory (non-breaking)
```

The remaining moderate items split into two buckets:
- **`next`/`postcss`**: runtime, but the only offered "fix" is a semver-major downgrade to next 9 — **do not downgrade**; wait for an upstream next patch that bumps postcss.
- **`esbuild`/`drizzle-kit`/`@esbuild-kit/*`**: **dev/tooling only** (not shipped in the production bundle); the esbuild advisory affects the dev server. Low real-world risk; track for a future drizzle-kit upgrade.

---

## Local Environment (Docker)

### `docker-compose.yml` (local dev)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `db` | `postgres:16` | 5432 → 5432 | Local PostgreSQL (user/pass/db = postgres/postgres/pdv), volume `pdv_pgdata`, healthcheck via `pg_isready` |

### `docker-compose.prod.yml` (production)

| Service | Image / Build | Port | Description |
|---------|---------------|------|-------------|
| `db` | `postgres:16-alpine` | (internal only) | Prod Postgres; password from `${POSTGRES_PASSWORD}`, volume `pdv_pgdata`, healthcheck |
| `app` | build `./Dockerfile` | 80 → 3000 | Next.js app; env: `DATABASE_URL`, `SESSION_SECRET`, `R2_*`; `depends_on` db healthy |

### `docker-compose.proxy.yml` (reverse proxy)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `nginx` | `nginx:alpine` | 80 → 80 | Reverse proxy on external `proxy-net`; config mounted read-only from `./nginx/nginx.conf` |

> Note: `app` (prod) and `nginx` (proxy) both bind host port 80. They are intended for different compose files / deployment modes (direct app vs. behind nginx), not run simultaneously on the same host. Confirm which is active in production to avoid a port conflict.

The local environment is documented in `CLAUDE.md` (`docker compose up -d` → `.env.local` → `npm run db:setup` → `npm run dev`).

---

## Issues Found

### 🔴 Critical

None. No committed secrets; no critical CVEs.

### 🟠 High

#### [INF-002] High-severity `undici` advisory
**Package:** `undici` (7.0.0–7.27.2), transitive dependency.
**Impact:** TLS validation bypass, header injection, DoS, and cache disclosure vectors.
**Fix:** `npm audit fix` (non-breaking, fix available).

### 🟡 Medium

#### [INF-003] Moderate runtime advisory in `next`/`postcss`
**Impact:** CSS Stringify XSS (low practical exposure for a server-rendered PDV).
**Fix:** Track upstream next patch; do NOT apply the offered semver-major downgrade.

#### [INF-004] `POSTGRES_PASSWORD` absent from `.env.example`
**Impact:** Low; prod deployer must infer the var.
**Fix:** Document prod vars in `.env.example` (commented section).

---

## Recommendations

1. **[Priority 1]** Run `npm audit fix` to clear the high-severity `undici` advisory (non-breaking).
2. **[Priority 2]** Add a commented "production" block to `.env.example` documenting `POSTGRES_PASSWORD` and reaffirming `SESSION_SECRET`/`R2_*` are required in prod.
3. **[Priority 3]** Monitor `next`/`postcss` and `drizzle-kit`/`esbuild` advisories for non-breaking upstream patches; the esbuild chain is dev-only and low risk.
4. **[Priority 4]** Confirm the production deployment mode (direct `app:80` vs. `nginx:80`) to avoid host port-80 contention between the prod and proxy composes.

---

## Analysis Limitations

Due to the stack and the scope of this audit, the following could NOT be performed:

| Analysis | Reason | How to Enable |
|----------|--------|---------------|
| Live RLS introspection | No running DB connection used in this audit; project has no Supabase/MCP introspection by design | Connect to a running Postgres (Docker) and inspect `pg_policies` / run `npm run db:rls` against it; review live policy state |
| Live table/column inventory | Static only — read from `db/schema/` | Same as above (live `\dt`/`information_schema` query) |
| Runtime query/EXPLAIN analysis | No live DB connection | Run against a seeded local DB |
| `npm outdated` freshness report | Not run (out of audit scope) | `npm outdated` against the lockfile |

**Static analysis only:** RLS correctness was not verified against a live database. The `drizzle-kit push` / `db:rls` ordering footgun (RLS policies dropped on push) is a known operational risk that live verification would catch but this static pass cannot confirm in any deployed environment.

---

### Evidence

- Committed env check: `git ls-files | grep -iE '\.env'` → `NO_ENV_FILES_TRACKED`
- `.gitignore` contains `.env*` (and `next-env.d.ts`)
- `.env.example`: `d:\SAAS PDV.multi\.env.example` (7 documented vars, placeholders only)
- Lockfile: `d:\SAAS PDV.multi\package-lock.json` (present, ~504 KB)
- `npm audit --json` metadata.vulnerabilities: `{"info":0,"low":0,"moderate":6,"high":1,"critical":0,"total":7}`
- Compose files: `d:\SAAS PDV.multi\docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.proxy.yml`
- DB/RLS artifacts referenced: `db/schema/`, `db/rls.ts`, `npm run db:rls` / `db:setup` (per `CLAUDE.md`)

---

*Document generated by the infrastructure-check subagent*
