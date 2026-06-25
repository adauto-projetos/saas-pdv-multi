---
id: 0011F
type: feature-plan
created: 2026-06-22
updated: 2026-06-22
related: [0011F]
---

## TL;DR

Plano de SF01-assinatura-lifecycle (epic 0011F): migração de schema (valid_until/suspended_at em tenants, is_founder em users, subscription_log), guard de escrita centralizado em 16 server actions, banners in-app de aviso/travada no layout server component. Fundação que SF02 consome.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)
- [Test Specification](#test-specification)
- [Database](#database)
- [Backend](#backend)
- [Frontend](#frontend)
- [Overview](#overview)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Context

{{doc:0011F}} — toda loja hoje vive perpétuamente sem pagar; não há mecanismo de trial, bloqueio ou aviso. SF01 adiciona a máquina de estados derivada (testando/ativa/travada), o guard `requireActiveTenant` em toda mutation de escrita e banners in-app. SF02 consome `getTenantStatus`, as colunas de assinatura e `subscription_log` criados aqui.

## Architecture Decisions

| Decisão | Rationale | Alternativa rejeitada | Constraint |
|---|---|---|---|
| Status derivado (não coluna) | Nunca desincroniza; zero cron | Coluna gravada por job — pode ficar defasada | Sem infra de agendamento |
| `suspended_at` coluna separada | Suspensão manual persiste além de `valid_until` | Flag booleana — perderia timestamp | Casos de inadimplência/fraude além de vencimento |
| Carência 2 dias | Evita travar cliente que paga na manhã do vencimento | Zero carência — atrito desnecessário | PIX manual; renovação não-instantânea |
| `requireActiveTenant` na action, não no service | Actions já agregam validações pré-serviço; services ficam agnósticos | Guard no service — polui com lógica transversal | Clean Architecture + multi-tenancy |
| `is_founder` em users (não env var) | Auditável, transacional, expansível | Email em env — frágil e não rastreável | Auditoria de acesso admin |
| Banners no layout.tsx server, não no AppTopBar client | Sem flash; dados de assinatura server-authoritative | AppTopBar é `use client` — sem fetch async | Next.js RSC model |

## Tasks

→ Detalhado em `tasks.md` (gerado a seguir). Inline por dependência:

- [ ] database: migration (3 ALTERs + CREATE subscription_log + RLS policy) — migration aplicada e policies ativas
- [ ] database: 6 métodos de repositório (`lib/services/subscriptions/`) — chamáveis em integração
- [ ] backend: `lib/services/subscriptions/subscription-status.ts` (getTenantStatus + selectHasRenewed) — T04–T09 passam
- [ ] backend: `lib/auth/tenant-guard.ts` (TenantLockedError + requireActiveTenant) — T12–T14 passam
- [ ] backend: add `'TENANT_LOCKED'` em `lib/services/errors.ts` — typecheck limpo
- [ ] backend: `lib/services/tenants/onboarding.ts` — valid_until + trial_started atômico — T01–T03 passam
- [ ] backend: 16 write actions com `requireActiveTenant` — T15–T18 passam; todas as 16 listadas no plan-backend
- [ ] backend: `db/seeds/founder.ts` (FOUNDER_EMAIL → is_founder=true) — T25–T26 passam
- [ ] frontend: `SubscriptionWarningBanner` + `SubscriptionLockedBanner` em `components/layout/` — T20–T23 passam
- [ ] frontend: `app/(app)/layout.tsx` modificado — banners condicionais sobre AppTopBar
- [ ] frontend: toast.error() em call-sites de actions bloqueadas — T24 passa

## Risks

| Risco | Prob | Impacto | Mitigação |
|---|---|---|---|
| Guard faltante em write action | Média | Escrita em loja travada | T15–T18 cobrem 4 paths; checklist das 16 actions em tasks.md |
| `requireActiveTenant` > 50ms | Baixa | Latência em toda mutation | PK lookup indexado (T19 integration); monitorar em produção |
| Founder não seeded antes de SF02 | Média | /admin inacessível para o founder | `db/seeds/founder.ts` como passo obrigatório de deploy |
| `TenantLockedError` não capturada | Baixa | Falha silenciosa, RF06 quebra | T24 garante toast; `toActionError` já existe em `lib/services/errors.ts` |

## Validation

Todos T01–T26 passam (100% coverage de RF/RN). Gates adicionais:
- `npm run typecheck && npm run lint && npm run test` — exit 0 com Docker Postgres ativo
- Banner amarelo visível quando `valid_until < hoje + 3 dias`
- Banner vermelho visível e não-dispensável quando `suspended_at IS NOT NULL`
- `finalizeSaleAction` retorna `{ ok: false }` sem DB write para tenant travada

---

## Test Specification

### Contract Tests (from RFs/RNs)

| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | Trial: new tenant gets valid_until +7d | backend | RN01, RF01 | `createUserWithTenant({name, email, password})` | `tenant.valid_until ≈ NOW() + 7 days` | `Math.abs(tenant.valid_until - (Date.now() + 7*86400*1000)) < 5000` |
| T02 | Trial: subscription_log trial_started inserted atomically | backend | RN01, RF01 | `createUserWithTenant({name, email, password})` | `subscription_log` row with `action='trial_started'` and `valid_until_after ≈ NOW()+7d` | `SELECT COUNT(*) FROM subscription_log WHERE tenant_id=$id AND action='trial_started'` = 1 |
| T03 | Trial: no partial state if transaction fails | backend | RN01, RF01 | DB failure mid-transaction (mock) | No tenant row AND no subscription_log row | Both tables empty for that `tenant_id` after error |
| T04 | getTenantStatus: suspended_at set → travada | backend | RN02, RN03 | `tenant = { valid_until: future, suspended_at: pastDate }` | `'travada'` | `getTenantStatus(tenant, anyHasRenewed) === 'travada'` |
| T05 | getTenantStatus: valid_until + 2d < now → travada | backend | RN02 | `tenant = { valid_until: NOW()-3d, suspended_at: null }` | `'travada'` | `getTenantStatus(tenant, anyHasRenewed) === 'travada'` |
| T06 | getTenantStatus: within 2-day grace → NOT travada | backend | RN02 | `tenant = { valid_until: NOW()-1d, suspended_at: null }` | `'testando'` or `'ativa'` (not `'travada'`) | `getTenantStatus(tenant, false) !== 'travada'` |
| T07 | getTenantStatus: no renewed log → testando | backend | RN02 | `tenant = { valid_until: future, suspended_at: null }, hasRenewed = false` | `'testando'` | `getTenantStatus(tenant, false) === 'testando'` |
| T08 | getTenantStatus: has renewed log → ativa | backend | RN02 | `tenant = { valid_until: future, suspended_at: null }, hasRenewed = true` | `'ativa'` | `getTenantStatus(tenant, true) === 'ativa'` |
| T09 | suspended_at overrides valid_until (not expired) | backend | RN03 | `tenant = { valid_until: future+30d, suspended_at: NOW()-1h }` | `'travada'` | `getTenantStatus(tenant, true) === 'travada'` |
| T10 | subscription_log: no DELETE allowed | database | RN04 | `DELETE FROM subscription_log WHERE id=$id` as `app_user` | Permission denied / RLS blocks | Statement raises error; row count still 1 |
| T11 | subscription_log: no UPDATE allowed | database | RN04 | `UPDATE subscription_log SET action='renewed' WHERE id=$id` as `app_user` | Permission denied / RLS blocks | Statement raises error; original row unchanged |
| T12 | requireActiveTenant: active tenant → no throw | backend | RF02 | `requireActiveTenant(tenantId)` where tenant is `testando`/`ativa` | Returns without throwing | Function resolves successfully |
| T13 | requireActiveTenant: travada → throws TenantLockedError | backend | RF02 | `requireActiveTenant(tenantId)` where `suspended_at` is set | Throws `TenantLockedError` with `code = 'TENANT_LOCKED'` | Caught error is instanceof `TenantLockedError` |
| T14 | requireActiveTenant: reads via owner db (no RLS) | backend | RF02 | `requireActiveTenant(tenantId)` with a tenant outside current user's membership | Returns tenant data (not RLS-filtered empty) | No error; tenant resolved correctly |
| T15 | finalizeSaleAction blocked when travada | backend | RF03 | `finalizeSaleAction(data)` with travada tenant | `{ ok: false, error: '...' }` — no DB write | `sales` table unchanged |
| T16 | recordEntryAction blocked when travada | backend | RF03 | `recordEntryAction(data)` with travada tenant | `{ ok: false, error: '...' }` | `stock_movements` unchanged |
| T17 | registerCashInflowAction blocked when travada | backend | RF03 | `registerCashInflowAction(data)` with travada tenant | `{ ok: false, error: '...' }` | `cash_movements` unchanged |
| T18 | openComandaAction blocked when travada | backend | RF03 | `openComandaAction(data)` with travada tenant | `{ ok: false, error: '...' }` | `comandas` unchanged |
| T19 | requireActiveTenant resolves under 50ms (integration) | backend | RNF01 | `requireActiveTenant(tenantId)` against live DB | Function resolves | Elapsed time < 50ms measured via `performance.now()` |
| T20 | SubscriptionWarningBanner shown at valid_until - 2d | frontend | RF04 | Layout renders with `valid_until = NOW()+2d, status != 'travada'` | `<SubscriptionWarningBanner>` present in DOM | Element with yellow banner and `daysLeft=2` visible |
| T21 | SubscriptionWarningBanner not shown when ok | frontend | RF04 | Layout renders with `valid_until = NOW()+10d, status = 'testando'` | No `<SubscriptionWarningBanner>` in DOM | Banner element absent |
| T22 | SubscriptionLockedBanner shown when travada | frontend | RF05 | Layout renders with `status = 'travada'` | `<SubscriptionLockedBanner>` present in DOM | Red banner with WhatsApp `13 99130-6911` visible |
| T23 | SubscriptionLockedBanner is not dismissable | frontend | RF05 | User attempts to close banner when `status = 'travada'` | Banner remains visible | No dismiss button; banner stays after interaction |
| T24 | Blocked action shows visible error toast | frontend | RF06 | `finalizeSaleAction` returns `{ ok: false, error: 'Loja travada...' }` | `toast.error()` called with message | Toast with error text visible in UI; no silent failure |
| T25 | setFounderByEmail sets is_founder = true | backend | RF07 | `setFounderByEmail(db, existingEmail)` | `users.is_founder = true` for that row | `SELECT is_founder FROM users WHERE email=$email` = `true` |
| T26 | setFounderByEmail errors on unknown email | backend | RF07 | `setFounderByEmail(db, 'nonexistent@example.com')` | Throws error (0 rows updated) | Function throws / rejects with meaningful message |

### Test File Mapping

| Area | Test File | Test IDs |
|------|-----------|----------|
| backend (unit) | `tests/unit/subscription-status.test.ts` | T04–T09 |
| backend (unit) | `tests/unit/tenant-guard.test.ts` | T12–T14 |
| backend (integration) | `tests/integration/onboarding.test.ts` | T01–T03 |
| backend (integration) | `tests/integration/tenant-guard.test.ts` | T15–T19 |
| backend (integration) | `tests/integration/founder-seed.test.ts` | T25–T26 |
| database (integration) | `tests/integration/subscription-log-rls.test.ts` | T10–T11 |
| frontend (component) | `tests/components/SubscriptionWarningBanner.test.tsx` | T20–T21 |
| frontend (component) | `tests/components/SubscriptionLockedBanner.test.tsx` | T22–T23 |
| frontend (component) | `tests/components/layout-subscription.test.tsx` | T24 |

### Coverage vs Requirements

| RF/RN | Test Cases | Covered? |
|-------|------------|----------|
| RN01 | T01, T02, T03 | YES |
| RN02 | T04, T05, T06, T07, T08 | YES |
| RN03 | T04, T09 | YES |
| RN04 | T10, T11 | YES |
| RF01 | T01, T02, T03 | YES |
| RF02 | T12, T13, T14 | YES |
| RF03 | T15, T16, T17, T18 | YES |
| RNF01 | T19 | YES |
| RF04 | T20, T21 | YES |
| RF05 | T22, T23 | YES |
| RF06 | T24 | YES |
| RF07 | T25, T26 | YES |

---

## Database

### Entities

| Entity | Table | Key Fields | Reference |
|--------|-------|------------|-----------|
| Tenant (extended) | `tenants` | `valid_until` (timestamptz nullable), `suspended_at` (timestamptz nullable) | Similar: `db/schema/tenants.ts` |
| User (extended) | `users` | `is_founder` (boolean not null default false) | Similar: `db/schema/users.ts` |
| Subscription Log | `subscription_log` | `id`, `tenant_id` FK, `action` (text check), `valid_until_before` (timestamptz nullable), `valid_until_after` (timestamptz nullable), `by_user_id` (uuid nullable FK), `at` (timestamptz default now) | Similar: `db/schema/print-logs.ts` (append-only audit log pattern) |

### Migration

- ALTER TABLE: `tenants` — add `valid_until timestamp with time zone` (nullable)
- ALTER TABLE: `tenants` — add `suspended_at timestamp with time zone` (nullable)
- ALTER TABLE: `users` — add `is_founder boolean NOT NULL DEFAULT false`
- CREATE TABLE: `subscription_log` — append-only; `tenant_id` FK ON DELETE CASCADE; `by_user_id` FK ON DELETE SET NULL (nullable); check constraint `action IN ('trial_started','renewed','suspended','released')`; index `(tenant_id, at DESC)` para histórico; index `(tenant_id, action)` para `hasRenewed` (RN02)
- RLS policy: SELECT + INSERT para `app_user` em `subscription_log`; sem UPDATE/DELETE (append-only, RN04)
- Reference: `db/migrations/0007_impressao_rls.sql`; `db/migrations/0000_perfect_mikhail_rasputin.sql` (ALTER TABLE pattern)

### Repository

| Method | Purpose |
|--------|---------|
| `selectTenantById(db, tenantId)` | Fetch tenant por PK via owner connection (sem RLS) — usado por `requireActiveTenant` (RNF01: PK lookup < 50ms) |
| `insertSubscriptionLog(tx, data)` | Append um log: tenant_id, action, valid_until_before, valid_until_after, by_user_id — chamado no onboarding transaction (RF01) |
| `selectHasRenewed(tx, tenantId)` | Boolean: existe pelo menos um `action='renewed'` para o tenant — resolve flag `hasRenewed` (RN02) |
| `updateTenantValidUntil(db, tenantId, validUntil)` | SET `valid_until` — chamado por SF02 ao renovar |
| `updateTenantSuspendedAt(db, tenantId, suspendedAt)` | SET `suspended_at` (null para liberar) — chamado por SF02 ao suspender/liberar |
| `setFounderByEmail(db, email)` | SET `is_founder = true` WHERE email = $1 — seed do founder (RF07); erro se 0 rows updated |

Reference: `lib/services/tenants/onboarding.ts` (owner-connection + db.transaction); `lib/services/profit/cash-session-data.ts` (Executor type)

---

## Backend

### Utilities & Guards (sem endpoints HTTP em SF01)

| Export | File | Purpose |
|--------|------|---------|
| `getTenantStatus(tenant, hasRenewed)` | `lib/services/subscriptions/subscription-status.ts` | Pure fn: deriva `testando \| ativa \| travada` de valid_until, suspended_at e hasRenewed |
| `selectHasRenewed(db, tenantId)` | `lib/services/subscriptions/subscription-status.ts` | Query subscription_log para `action='renewed'` |
| `TenantLockedError` | `lib/auth/tenant-guard.ts` | Extends AppError com code `TENANT_LOCKED`; capturado por `toActionError` |
| `requireActiveTenant(tenantId)` | `lib/auth/tenant-guard.ts` | Lê tenant via owner `db` (sem RLS); chama getTenantStatus; lança TenantLockedError se travada |

### DTOs / Types

| Type | Fields | Notes |
|------|--------|-------|
| `TenantStatus` | `'testando' \| 'ativa' \| 'travada'` | Union type; exportado de subscription-status.ts; nunca gravado em coluna |
| `TenantLockedError` | herda AppError (`message`, `code: 'TENANT_LOCKED'`) | `toActionError` em `lib/services/errors.ts` mapeia para `{ ok: false, error: message }` |

`ErrorCode` em `lib/services/errors.ts` deve ser estendido com `'TENANT_LOCKED'`.

### Commands / Actions Modified

| Action File | Change | Guard Order |
|------------|--------|-------------|
| `app/(app)/caixa/actions.ts` — `finalizeSaleAction` | Add `await requireActiveTenant(ctx.tenantId)` | `requireAuthContext` → `requireActiveTenant` → `withUserRls` |
| `app/(app)/estoque/actions.ts` — `recordEntryAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/estoque/actions.ts` — `recordAdjustmentAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/financeiro/caixa/actions.ts` — `registerCashInflowAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/financeiro/caixa/actions.ts` — `registerCashOutflowAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/financeiro/receber/actions.ts` — `createReceivableAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/financeiro/receber/actions.ts` — `recordReceivablePaymentAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/financeiro/pagar/actions.ts` — `createPayableAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/financeiro/pagar/actions.ts` — `recordPayablePaymentAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/lucro/actions.ts` — `openCashSessionAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/lucro/actions.ts` — `closeCashSessionAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/comandas/actions.ts` — `openComandaAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/comandas/actions.ts` — `addComandaItemAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/comandas/actions.ts` — `removeComandaItemAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/comandas/actions.ts` — `closeComandaAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `app/(app)/comandas/actions.ts` — `cancelComandaAction` | Add `await requireActiveTenant(ctx.tenantId)` | idem |
| `lib/services/tenants/onboarding.ts` — `createUserWithTenant` | Set `valid_until = NOW() + 7d`; insert `subscription_log(trial_started)` no mesmo `db.transaction` | Sem guard — owner db, pré-sessão |

### Service Structure

```
lib/auth/
+-- tenant-guard.ts              (new: TenantLockedError, requireActiveTenant)
lib/services/subscriptions/
+-- subscription-status.ts       (new: TenantStatus, getTenantStatus, selectHasRenewed)
lib/services/tenants/
+-- onboarding.ts                (MODIFY: valid_until + subscription_log no createUserWithTenant)
lib/services/errors.ts           (MODIFY: add 'TENANT_LOCKED' ao ErrorCode union)
db/seeds/
+-- founder.ts                   (new: lê FOUNDER_EMAIL, chama setFounderByEmail)
```

Reference: `lib/auth.ts` (requireAuthContext pattern); `db/rls.ts` (owner db vs withUserRls); `lib/services/tenants/onboarding.ts` (db.transaction); `app/(app)/caixa/actions.ts` (ordem de guards)

---

## Frontend

### Pages

(Nenhuma página nova em SF01 — apenas modificações no layout)

### Components

```json
{"SubscriptionWarningBanner":{"location":"components/layout/","purpose":"Banner amarelo fixo com contagem regressiva e WhatsApp","props":"daysLeft: number"},"SubscriptionLockedBanner":{"location":"components/layout/","purpose":"Banner vermelho fixo não-dispensável quando status=travada","props":"none (static text)"}}
```

### Layout Modifications

| File | Change | Condition |
|------|--------|-----------|
| `app/(app)/layout.tsx` | Fetch `tenants.valid_until` e `tenants.suspended_at` via owner `db` (sem RLS) após `getAuthUser()`; derivar status com `getTenantStatus` | Sempre — server component |
| `app/(app)/layout.tsx` | Renderizar `<SubscriptionWarningBanner daysLeft={...} />` acima do `<AppTopBar />` | `valid_until - 3 dias < agora` E `status !== 'travada'` |
| `app/(app)/layout.tsx` | Renderizar `<SubscriptionLockedBanner />` acima do `<AppTopBar />` | `status === 'travada'` |
| `components/layout/AppTopBar.tsx` | Sem alteração — banners ficam no layout.tsx server, não no AppTopBar client | — |

### Hooks & Data

```json
{"hooks":{"nenhum hook client-side":{"type":"Server Component fetch","purpose":"valid_until e suspended_at lidos no layout.tsx via owner db — sem useEffect"}},"errorHandling":"TenantLockedError → toActionError → { ok: false, error: '...' } → toast.error() via sonner (Toaster já em components/ui/sonner.tsx)"}
```

### Types (mirror from backend)

```json
{"TenantStatus":{"fields":"'testando' | 'ativa' | 'travada'","sourceType":"importar de lib/services/subscriptions/subscription-status.ts — não redefinir"}}
```

Reference: `app/(app)/layout.tsx` (server fetch pattern); `components/ui/sonner.tsx` (Toaster para RF06); `components/layout/AppTopBar.tsx` (adjacente — banners no server layout)

---

## Overview

SF01 resolve a ausência total de controle de acesso por assinatura. Toda loja criada hoje vive perpétuamente sem pagar — SF01 introduz trial de 7 dias, status derivado (testando/ativa/travada), guard de escrita em 16 mutations e banners in-app de aviso e bloqueio. É a fundação que SF02 (painel founder) consome para exibir e controlar o estado de cada loja.

## Main Flow

1. **Signup** → `createUserWithTenant()` seta `valid_until = NOW() + 7d` + insere `subscription_log(trial_started)` atomicamente
2. **Qualquer request** → `app/(app)/layout.tsx` (server) lê `valid_until` e `suspended_at` → deriva `getTenantStatus()` → renderiza banner adequado (ou nenhum)
3. **Mutation de escrita** → action chama `requireAuthContext()` → `requireActiveTenant(tenantId)` → `withUserRls(userId, fn)` → service → DB
4. **Tenant travada** → `requireActiveTenant` lança `TenantLockedError` → `toActionError` retorna `{ ok: false, error: '...' }` → call-site exibe `toast.error()`
5. **Seed do founder** → `db/seeds/founder.ts` lê `FOUNDER_EMAIL` do env → `setFounderByEmail(db, email)` → `users.is_founder = true`

## Implementation Order

1. **Database** — migration (3 ALTERs + CREATE subscription_log + RLS) + métodos de repositório
2. **Backend** — `subscription-status.ts` + `tenant-guard.ts` + errors.ts + onboarding.ts + 16 actions + seed
3. **Frontend** — SubscriptionWarningBanner + SubscriptionLockedBanner + layout.tsx + toast nos call-sites

## Quick Reference

| Padrão | Onde buscar |
|---|---|
| Schema tenants/users | `db/schema/tenants.ts`, `db/schema/users.ts` |
| Owner connection (sem RLS) | `db/index.ts`, `lib/services/tenants/onboarding.ts` |
| withUserRls pattern | `db/rls.ts` |
| requireAuthContext pattern | `lib/auth.ts` |
| AppError subclass + toActionError | `lib/services/errors.ts` |
| Server component layout | `app/(app)/layout.tsx` |
| Toast (sonner) | `components/ui/sonner.tsx` |
| Audit log append-only | `db/schema/print-logs.ts` |
