# Documentation Report

**Generated on:** 2026-06-29
**Score:** 8.0/10
**Status:** 🟡 Good with stale spots

---

## Summary

Documentation health is strong: `CLAUDE.md` is dense, accurate as an architecture contract, and almost every path it references resolves on disk. The implementation-patterns skill (`.codeadd/skills/project-patterns/`) and per-feature docs are well structured and current. The main problems are a stale `Status` line (version + domain count drift), a default `create-next-app` `README.md` with zero project-specific onboarding, and a handful of Portuguese-label vs. real-directory-name mismatches that could mislead an AI doing file lookups.

---

## Analyzed Documents

| Document | Status | Compliance |
|----------|--------|------------|
| CLAUDE.md | ✅ Exists | ~90% — accurate contract, stale Status line |
| README.md | ⚠️ Boilerplate | 0% — unmodified create-next-app template |
| .env.example | ✅ Exists | High — richly commented (DB, SESSION_SECRET, R2) |
| docs/product/{product,owner}.md | ✅ Exists | Referenced and present |
| .codeadd/skills/project-patterns/ | ✅ Exists | backend/database/frontend.md + SKILL.md present |
| docs/features/* | ✅ Exists | 21 feature dirs, structured (about/discovery/plan/changelog) |
| docs/code-quality-review.md | ✅ Exists | Referenced and present |

---

## Issues Found

### 🔴 Critical

None. No broken structural references, no missing critical docs, no multi-tenancy contract drift.

---

### 🟠 High

#### [DOC-001] README.md is unmodified create-next-app boilerplate
**File:** `README.md` (lines 1–40)
**Problem:** The README is the stock Next.js template ("bootstrapped with create-next-app", `yarn dev`/`pnpm dev`/`bun dev`, "Deploy on Vercel"). It contradicts the project's actual setup (npm-only, Docker Postgres, `npm run db:setup`, Hetzner/pdv.art.br deploy) documented in CLAUDE.md and `.env.example`. The real onboarding flow lives only in CLAUDE.md line 7.
**Impact:** A human contributor (or AI) landing on the repo root README gets wrong, misleading setup instructions. Mentions `yarn`/`pnpm`/`bun` even though the project is npm-only.
**Fix:** Replace README with project-specific onboarding (the `docker compose up -d` → `.env.local` → `npm run db:setup` → `npm run dev` flow), or make it point to CLAUDE.md.

---

#### [DOC-002] Stale Status line in CLAUDE.md — version and domain count
**File:** `CLAUDE.md:7` (and the title-line context at top)
**Problems:**
- States **v0.11.0**; `package.json` version is **0.13.0** (two minor bumps behind — 0021C and 0022C shipped per recent commits).
- States services layer has **"~20 domínios"**; actual `lib/services/` has **15 domain directories** (admin, audit, comanda, finance, permissions, platform, print, products, profit, sales, stock, storage, subscriptions, tenants, users).
- States **"19 features entregues (0001F–0020F)"**; `docs/features/` now holds **21 dirs** including 0021C and 0022C (chore IDs, but they are delivered docs), plus hotfixes 0017H/0019H.
**Impact:** The single most-read orientation line is numerically wrong on three counts; erodes trust and can mislead capacity/scope reasoning.
**Fix:** Update to v0.13.0, "~15 domínios", and reflect features through 0022C. Consider sourcing version from package.json rather than hardcoding.

---

### 🟡 Medium

#### [DOC-003] CLAUDE.md uses "usuarios" as a service-domain example, but the directory is `users`
**File:** `CLAUDE.md:7` ("comanda, finance, product, profit, sale, stock, usuarios, etc.")
**Problem:** The listed example domains mix Portuguese labels with English directory names. Actual `lib/services/` dirs are English plural: `users` (not `usuarios`), `products` (not `product`), `sales` (not `sale`), `comanda` (singular — matches). The RLS migration is `0010_usuarios_rls.sql` and the route group is `app/(app)/usuarios/`, so "usuarios" is a real label elsewhere — but not under `lib/services/`.
**Impact:** An AI grepping `lib/services/usuarios` or `lib/services/product` based on this line finds nothing; minor friction.
**Fix:** Align the example list to real directory names (`users`, `products`, `sales`) or note these are domain labels, not paths.

---

#### [DOC-004] "34 passam" test count is narrow and likely stale
**File:** `CLAUDE.md:61`
**Problem:** States "(34 passam)" for DB-touching tests with Docker up. The repo now has 90 test files total (68 `*.test.ts` + 22 `*.test.tsx`); the 34 figure refers only to the DB-integration subset and is unverified against the current suite. It is a brittle hardcoded number.
**Impact:** Low — contextually scoped to DB tests, but a precise count drifts every feature.
**Fix:** Drop the exact number or phrase as "os testes de banco rodam de verdade" without a count.

---

### 🟢 Low

#### [DOC-005] Feature-doc structure is heterogeneous (acceptable but worth noting)
**Files:** `docs/features/*/`
**Observation:** Most features carry `about.md` + `discovery.md` + `plan.md` + `tasks.md` + `changelog.md`. Some chore docs (e.g. `0022C-xray-patterns`) carry only `about.md` + `changelog.md` + `iterations.jsonl` (no discovery/plan), and the earliest feature (`0001F`) lacks `changelog.md` but has `design.md`. This is expected for chore vs. feature workflows, not a defect — flagged only so it is not mistaken for missing docs.
**Fix:** None required; optionally note in CLAUDE.md that chore (C) IDs use a lighter doc set.

#### [DOC-006] ID-skip note slightly understated
**File:** `CLAUDE.md:7`
**Observation:** Notes only that "0012 foi pulado". Correct, but the sequence also interleaves hotfix IDs (0017H, 0019H) and chore IDs (0021C, 0022C) — the "F-only" framing of "19 features" undercounts the actual delivered work. Cosmetic.

---

## Path Verification (CLAUDE.md references → disk)

| Referenced | Exists? |
|---|---|
| `docs/product/product.md`, `docs/product/owner.md` | ✅ |
| `lib/services/` | ✅ (15 domains) |
| `db/rls.ts`, `db/index.ts`, `db/schema/` | ✅ |
| `lib/auth/`, `lib/validation/` | ✅ |
| `app/`, `components/` | ✅ |
| `scripts/apply-rls.ts` | ✅ |
| `db/migrations/*_rls.sql` | ✅ (0001–0010 present) |
| `.codeadd/skills/project-patterns/{SKILL,backend,database,frontend}.md` | ✅ |
| `.codeadd/scripts/pattern-search.sh` (`--list` works) | ✅ → AREAS:backend,database,frontend; TOPICS:36 |
| `docs/code-quality-review.md` | ✅ |
| `.env.example` | ✅ |

**No broken paths found.** All structural references in CLAUDE.md resolve.

---

## Compliance Checklist

### CLAUDE.md
- [x] Exists
- [x] Concise / dense (no filler; JSON for data, tables for rules)
- [x] No extensive code blocks (uses path references)
- [x] Verifiable paths (all resolve)
- [x] Versions included (but stale — see DOC-002)
- [ ] Language: English — **project convention is Portuguese**; CLAUDE.md is in PT-BR. This is intentional per the OWNER profile (beginner founder, PT explanations) and is consistent across the project, so not flagged as a defect despite the skill's English default.
- [x] No aspirational documentation (Vercel/Asaas correctly marked "futuro"/"pós-MVP")

### Features
- [x] `docs/features/` exists
- [x] Features carry structured docs (about/discovery/plan/changelog where applicable)

---

## Recommendations

1. **Refresh the CLAUDE.md Status line (DOC-002):** bump to v0.13.0, correct "~15 domínios", and reflect features through 0022C. Highest-value, lowest-effort fix.
2. **Rewrite README.md (DOC-001):** replace create-next-app boilerplate with the real Docker+npm onboarding flow or redirect to CLAUDE.md — it is the public face of the repo and currently actively misleading.
3. **Align service-domain examples to real directory names (DOC-003)** and drop the hardcoded test count (DOC-004) to reduce future drift.

---

*Document generated by the documentation-analyzer subagent*
