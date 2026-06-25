---
id: 0011F
type: feature-plan
created: 2026-06-22
updated: 2026-06-22
related: [0011F]
---

## TL;DR

Plano de SF02-painel-super-admin (epic 0011F): guard `requireFounder()` em `lib/auth/admin.ts`, serviço cross-tenant `tenant-admin-service.ts` (métricas de dashboard), 3 server actions de billing (liberar/suspender/desbloquear), rota `/admin` no shell existente e 7 componentes React. Toda query do painel usa `db` (owner connection, bypassa RLS); mutations reutilizam os métodos de repositório criados em SF01.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)
- [Test Specification](#test-specification)
- [Backend](#backend)
- [Frontend](#frontend)
- [Overview](#overview)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Context

{{doc:0011F}} — SF01 adicionou as colunas de assinatura (`valid_until`, `suspended_at`, `is_founder`) e os métodos de repositório. SF02 constrói sobre essa fundação: expõe um painel exclusivo do founder em `/admin` para visualizar métricas de todas as lojas e executar ações de billing via 3 server actions. Sem SF02, o controle de billing exige acesso direto ao banco via SSH + psql.

---

## Architecture Decisions

| Decisão | Rationale | Alternativa rejeitada | Constraint |
|---------|-----------|----------------------|------------|
| Queries via `db` (owner connection) | Único ponto sem filtro RLS que vê todos os tenants; `requireFounder()` é a guarda | Role `app_admin` no Postgres com policies — mais peças para manter, sem ganho real | Isolamento multi-tenant exige que queries cross-tenant não passem por RLS |
| `requireFounder()` em `lib/auth/admin.ts` | Separação clara: admin guard ≠ tenant auth | Adicionar param a `requireAuthContext()` — mistura os dois contextos | Clean Architecture: cada guard tem um propósito |
| Rota `/admin` dentro do grupo `(app)` | Reutiliza sidebar/topbar existentes (link condicional); zero duplicação de shell | Grupo `(admin)` separado — duplica layout sem ganho | Founder vê o mesmo shell; só o link é novo |
| History modal com lazy fetch | Carrega logs só quando o modal abre; evita buscar histórico de todas as lojas | Fetch de todo o histórico na carga da página — dado desnecessário na maioria dos casos | Até 200 lojas × N entradas de log = payload grande desnecessariamente |
| Mutations reutilizam repo methods de SF01 | Sem duplicação de lógica; SF01 já tem os métodos testados | Re-implementar mutations em SF02 — risco de dessincronia | SF02 é consumidor, não proprietário dessas colunas |

---

## Tasks

→ Detalhado em `tasks.md`. Inline por dependência:

- [ ] backend: `lib/auth/admin.ts` — `requireFounder()` guard — T01, T02, T03 passam
- [ ] backend: `lib/services/admin/tenant-admin-service.ts` — `listAllTenantsWithStats`, `getExpiringTenants`, `getTenantSubscriptionHistory` — T10–T20, T44 passam
- [ ] backend: `app/(app)/admin/actions.ts` — 3 server actions (release/suspend/releaseFromSuspension) — T24–T43 passam
- [ ] frontend: `components/layout/AppSidebar.tsx` — add `isFounder?: boolean` prop + link "/admin" condicional — T07–T09 passam
- [ ] frontend: `app/(app)/layout.tsx` — expandir SELECT para incluir `is_founder`; passar à `AppSidebar` — T07, T08 passam
- [ ] frontend: `app/(app)/admin/page.tsx` — server component; `requireFounder()` + `Promise.all` fetch — T04–T06 passam
- [ ] frontend: `components/admin/` — 7 componentes (MetricsCards, ExpiringTenantsList, TenantTable, TenantStatusBadge, ReleaseDialog, SuspendDialog, SubscriptionHistoryModal) — T12, T21–T23, T29–T30, T35–T37, T45–T46 passam

---

## Risks

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| `listAllTenantsWithStats` lento para muitos tenants | Baixa | P95 > 2s (RNF01) | Indexes em `sales(tenant_id, created_at)` e `stock_movements(tenant_id, created_at)` criados em SF01 |
| `is_founder` não seeded antes do deploy | Média | /admin inacessível ao founder | `db/seeds/founder.ts` (SF01) — passo obrigatório de deploy; documentar em README |
| SF02 deployado antes de SF01 | Alta | Column not found — crash em runtime | Deploy gate: SF01 migration deve preceder SF02; CI/CD mantém ordem |
| `requireFounder()` retorna false positivo | Baixa | Segurança comprometida | T01–T03 cobrem todos os casos; guard usa `db` (owner), sem filtro de app_user |

---

## Validation

Todos T01–T46 passam com Docker Postgres ativo e `FOUNDER_EMAIL` seed executado:
- `npm run typecheck && npm run lint` — exit 0
- `/admin` retorna 200 para founder; redireciona para `/` para não-founder
- Dashboard carrega < 2s com ≥ 10 lojas (verificação manual)
- Botões "Liberar" e "Suspender" abrem dialog de confirmação antes de executar
- "Liberar suspensão" executa sem dialog (RF20)
- `subscription_log` recebe entrada para cada ação executada

---

## Test Specification

### Contract Tests (from RFs/RNs)

| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | requireFounder rejects unauthenticated caller | backend | RF01 | `getAuthUser()` returns null | throws `UnauthorizedError` | `await expect(requireFounder()).rejects.toBeInstanceOf(UnauthorizedError)` |
| T02 | requireFounder rejects non-founder user | backend | RF01 | valid session, `is_founder = false` | throws `UnauthorizedError` | same |
| T03 | requireFounder resolves for founder user | backend | RF01 | valid session, `is_founder = true` | resolves with `{ userId }` | `await expect(requireFounder()).resolves.toEqual({ userId })` |
| T04 | /admin redirects non-founder to / | backend | RF02, RF03 | GET `/admin` with `is_founder=false` | redirect to `/` | assert redirect location |
| T05 | /admin redirects unauthenticated to / | backend | RF02, RF03 | GET `/admin` no session | redirect to `/` | assert redirect |
| T06 | /admin accessible for founder | backend | RF02 | GET `/admin` with valid founder session | 200 OK | assert status 200 |
| T07 | AppSidebar hides Admin link when isFounder false | frontend | RF04 | `<AppSidebar isFounder={false} ...>` | no link to `/admin` | `queryByRole('link',{name:/admin/i})` is null |
| T08 | AppSidebar shows Admin link when isFounder true | frontend | RF04 | `<AppSidebar isFounder={true} ...>` | link to `/admin` present | `getByRole('link',{name:/admin/i})` has href `/admin` |
| T09 | Admin link has Shield icon and secondary position | frontend | RF05 | `<AppSidebar isFounder={true} ...>` | Shield icon + after secondary nav | assert icon node; assert DOM order |
| T10 | listAllTenantsWithStats returns all tenants cross-tenant | backend | RF06 | two tenants in DB | both returned | `expect(result).toHaveLength(2)` |
| T11 | listAllTenantsWithStats derives status correctly | backend | RF06 | tenant with `suspended_at IS NOT NULL` | `status='travada'` | assert status field |
| T12 | MetricsCards displays counts per status | frontend | RF06 | `stats={testando:2,ativa:5,travada:1}` | cards show 2, 5, 1 | getByText for each count |
| T13 | getExpiringTenants returns stores expiring in 3 days | backend | RF07 | tenant `valid_until=NOW()+2d,suspended_at=null` | included | contains tenantId |
| T14 | getExpiringTenants excludes beyond 3 days | backend | RF07 | tenant `valid_until=NOW()+5d` | excluded | not contains tenantId |
| T15 | getExpiringTenants excludes suspended stores | backend | RF07 | tenant `valid_until=NOW()+1d,suspended_at IS NOT NULL` | excluded | not contains tenantId |
| T16 | getExpiringTenants orders by valid_until ASC | backend | RF07 | two expiring tenants | earlier first | `result[0].valid_until <= result[1].valid_until` |
| T17 | listAllTenantsWithStats sums revenue current month only | backend | RF08 | sale this month 1000c, prior month 500c | `revenue_cents=1000` | assert field |
| T18 | listAllTenantsWithStats returns 0 revenue no sales | backend | RF08 | tenant with no sales | `revenue_cents=0` | `toBe(0)` |
| T19 | listAllTenantsWithStats null last_activity new tenant | backend | RF09 | tenant no sales/stock | `last_activity_at=null` | `toBeNull()` |
| T20 | listAllTenantsWithStats picks MAX across tables | backend | RF09 | sale at T1, stock_movement at T2>T1 | `last_activity_at=T2` | assert equals T2 |
| T21 | TenantTable renders all required columns | frontend | RF10 | one AdminTenantRow | name, badge, valid_until, revenue, last_activity, actions visible | assert headers+cells |
| T22 | TenantStatusBadge shows correct color per status | frontend | RF11 | status='testando' | blue; 'ativa'=green; 'travada'=red | assert color token per status |
| T23 | TenantTable default sort: travada first then valid_until ASC | frontend | RF12 | mixed status rows | travada row first, then by valid_until | assert first row status='travada' |
| T24 | releaseSubscriptionAction accumulates from future valid_until | backend | RF13, RN01 | `valid_until=NOW()+15d` | `new_valid_until=valid_until+30d` | assert equals original+30d |
| T25 | releaseSubscriptionAction uses NOW when valid_until past | backend | RF13, RN01 | `valid_until=NOW()-5d` | `new_valid_until≈NOW()+30d` | assert approx NOW+30d |
| T26 | releaseSubscriptionAction updates valid_until and clears suspended_at | backend | RF14 | call with travada tenant | `valid_until` updated; `suspended_at=null` | query tenant after; assert both |
| T27 | releaseSubscriptionAction clears suspended_at | backend | RF14 | tenant with `suspended_at IS NOT NULL` | `suspended_at=null` | `toBeNull()` |
| T28 | releaseSubscriptionAction inserts subscription_log renewed | backend | RF15 | call by founder | log row `action='renewed'`, correct fields | query log; assert |
| T29 | ReleaseDialog opens before action fires | frontend | RF16a | click "Liberar +30 dias" | dialog visible; action NOT called yet | assert dialog open; mock not called |
| T30 | ReleaseDialog confirm calls releaseSubscriptionAction | frontend | RF16a | click confirm | action called with correct tenantId | assert mock called once |
| T31 | releaseSubscriptionAction rejects unauthenticated | backend | RF02 | no session | UnauthorizedError in ActionResult | assert error |
| T32 | releaseSubscriptionAction rejects non-founder | backend | RF02 | `is_founder=false` | UnauthorizedError in ActionResult | assert error |
| T33 | suspendTenantAction sets suspended_at | backend | RF17 | call by founder | `suspended_at IS NOT NULL` | assert field set |
| T34 | suspendTenantAction inserts subscription_log suspended | backend | RF18 | call by founder | log `action='suspended'`, `by_user_id` | query log; assert |
| T35 | SuspendDialog opens before action fires | frontend | RF19 | click "Suspender" | dialog visible; action NOT called | assert dialog; mock not called |
| T36 | SuspendDialog confirm calls suspendTenantAction | frontend | RF19 | click confirm | action called with tenantId | assert mock called once |
| T37 | SuspendDialog confirm button is destructive (red) | frontend | RF19 | `<SuspendDialog open={true} ...>` | confirm button has red/destructive style | assert color or variant |
| T38 | suspendTenantAction forces travada even with valid_until future | backend | RN02 | `valid_until=NOW()+10d,suspended_at=null` → call suspend | `suspended_at IS NOT NULL`; status='travada' | assert |
| T39 | suspendTenantAction forces travada for testando tenant | backend | RN02 | testando tenant → call suspend | `suspended_at IS NOT NULL` | assert field set |
| T40 | releaseFromSuspensionAction clears suspended_at | backend | RF20 | tenant with suspended_at → call release | `suspended_at=null` | `toBeNull()` |
| T41 | releaseFromSuspensionAction does NOT change valid_until | backend | RF20, RN03 | `valid_until=D_original` → release | `valid_until` unchanged | assert equals D_original |
| T42 | expired valid_until stays travada after release suspension | backend | RN03 | `valid_until=past,suspended_at IS NOT NULL` → release | status='travada' after | assert status |
| T43 | releaseFromSuspensionAction inserts subscription_log released | backend | RF21 | call by founder | log `action='released'`, `by_user_id` | assert |
| T44 | getTenantSubscriptionHistory ordered by at DESC | backend | RF22 | 3 log entries T1<T2<T3 | returned T3,T2,T1 | `result[0].at >= result[1].at` |
| T45 | SubscriptionHistoryModal renders entries correctly | frontend | RF22 | open modal with 2 entries | action badge, valid_until_before/after, at; by at DESC | assert rows |
| T46 | SubscriptionHistoryModal lazy-fetches on open | frontend | RF22 | modal closed then opened | no fetch before open; fetch triggered on open | assert service not called until open=true |

### Test File Mapping

| Area | Test File | Test IDs |
|------|-----------|----------|
| backend — auth guard | `lib/auth/admin.test.ts` | T01, T02, T03 |
| backend — admin service | `lib/services/admin/tenant-admin-service.test.ts` | T10, T11, T13–T20, T44 |
| backend — server actions | `app/(app)/admin/actions.test.ts` | T24–T28, T31–T34, T38–T43 |
| backend — integration (DB) | `db/__tests__/admin-rls.test.ts` | T04, T05, T06 |
| frontend — AppSidebar | `components/layout/AppSidebar.test.tsx` | T07, T08, T09 |
| frontend — MetricsCards | `components/admin/metrics-cards.test.tsx` | T12 |
| frontend — TenantStatusBadge | `components/admin/tenant-status-badge.test.tsx` | T22 |
| frontend — TenantTable | `components/admin/tenant-table.test.tsx` | T21, T23, T29, T30, T35, T36, T37 |
| frontend — SubscriptionHistoryModal | `components/admin/subscription-history-modal.test.tsx` | T45, T46 |

### Coverage vs Requirements

| RF/RN | Test Cases | Covered? |
|-------|------------|----------|
| RF01 | T01, T02, T03 | YES |
| RF02 | T04–T06, T31, T32 | YES |
| RF03 | T04, T05 | YES |
| RF04 | T07, T08 | YES |
| RF05 | T09 | YES |
| RF06 | T10, T11, T12 | YES |
| RF07 | T13, T14, T15, T16 | YES |
| RF08 | T17, T18 | YES |
| RF09 | T19, T20 | YES |
| RNF01 | (performance — validação manual / load test) | DEFERRED |
| RF10 | T21 | YES |
| RF11 | T22 | YES |
| RF12 | T23 | YES |
| RF13 | T24, T25 | YES |
| RF14 | T26, T27 | YES |
| RF15 | T28 | YES |
| RF16 | T26 (revalidatePath → re-render automático) | YES |
| RF16a | T29, T30 | YES |
| RF17 | T33 | YES |
| RF18 | T34 | YES |
| RF19 | T35, T36, T37 | YES |
| RF20 | T40, T41 | YES |
| RF21 | T43 | YES |
| RF22 | T44, T45, T46 | YES |
| RN01 | T24 (valid_until futuro), T25 (valid_until passado) | YES |
| RN02 | T38 (ativa→travada), T39 (testando→travada) | YES |
| RN03 | T41 (valid_until inalterado), T42 (expirado→travada após release) | YES |

---

## Backend

### Auth Guard

| Export | File | Purpose | Auth flow |
|--------|------|---------|-----------|
| `requireFounder()` | `lib/auth/admin.ts` | Verifica que o usuário logado tem `is_founder=true`; lança `UnauthorizedError` se não autenticado ou flag falsa | `getAuthUser()` → null lança `UnauthorizedError` → `db` (owner) SELECT `is_founder` WHERE `id=userId` → false lança `UnauthorizedError` |

### Admin Service — lib/services/admin/tenant-admin-service.ts

| Method | Query basis | Purpose |
|--------|-------------|---------|
| `listAllTenantsWithStats()` | JOIN `tenants` + subquery `SUM(sales.total_cents)` WHERE `created_at >= início do mês` + subquery `MAX(created_at)` UNION `sales`∪`stock_movements` por tenant; owner `db` | Retorna `AdminTenantRow[]` com status derivado via `getTenantStatus()` para lista e métricas (RF06–RF10) |
| `getExpiringTenants(days: number)` | `valid_until BETWEEN NOW() AND NOW()+$days days AND suspended_at IS NULL ORDER BY valid_until ASC`; owner `db` | Lista lojas que vencem em N dias (RF07); chamado com `days=3` |
| `getTenantSubscriptionHistory(tenantId)` | `subscription_log WHERE tenant_id=$tenantId ORDER BY at DESC`; owner `db` | Entries para o modal de histórico (RF22); lazy fetch |

*Mutation methods (`updateTenantValidUntil`, `updateTenantSuspendedAt`, `insertSubscriptionLog`) são REUSADOS de SF01 (`lib/services/subscriptions/`) — não redeclarar.*

### Server Actions — app/(app)/admin/actions.ts

| Action | RF | Input | Logic | Response |
|--------|----|-------|-------|----------|
| `releaseSubscriptionAction(tenantId)` | RF13–RF16a | `tenantId: string` | `requireFounder()` → `selectTenantById` → `new_valid_until=GREATEST(valid_until??NOW(),NOW())+30d` → `db.transaction`: `updateTenantValidUntil`+`updateTenantSuspendedAt(null)`+`insertSubscriptionLog('renewed')` → `revalidatePath('/admin')` | `ActionResult<{new_valid_until:Date}>` |
| `suspendTenantAction(tenantId)` | RF17–RF19 | `tenantId: string` | `requireFounder()` → `db.transaction`: `updateTenantSuspendedAt(NOW())`+`insertSubscriptionLog('suspended')` → `revalidatePath('/admin')` | `ActionResult<void>` |
| `releaseFromSuspensionAction(tenantId)` | RF20–RF21 | `tenantId: string` | `requireFounder()` → `db.transaction`: `updateTenantSuspendedAt(null)`+`insertSubscriptionLog('released')` → `revalidatePath('/admin')` | `ActionResult<void>` |

### DTOs / Types

| Type | Fields | Source |
|------|--------|--------|
| `AdminTenantRow` | `id,name,status:TenantStatus,valid_until:Date\|null,suspended_at:Date\|null,revenue_cents:number,last_activity_at:Date\|null` | novo — output de `listAllTenantsWithStats()`; status via `getTenantStatus()` de SF01 |
| `SubscriptionLogEntry` | `id,action:'trial_started'\|'renewed'\|'suspended'\|'released',valid_until_before:Date\|null,valid_until_after:Date\|null,by_user_id:string\|null,at:Date` | espelha `subscription_log` |

### Service Structure

```
lib/auth/
+-- admin.ts                               (new: requireFounder)
lib/services/admin/
+-- tenant-admin-service.ts                (new: 3 cross-tenant query methods)
app/(app)/admin/
+-- actions.ts                             (new: 3 server actions)
```

Reference: `lib/auth.ts` (requireAuthContext pattern); `db/index.ts` (owner `db`); `lib/services/subscriptions/subscription-status.ts` (getTenantStatus, TenantStatus); `app/(app)/caixa/actions.ts` (server action pattern)

---

## Frontend

### Pages

| Route | File | Component | Purpose |
|-------|------|-----------|---------|
| /admin | `app/(app)/admin/page.tsx` | AdminPage | Server component; `requireFounder()` (redirect `/` se não founder — RF03); `Promise.all([listAllTenantsWithStats(), getExpiringTenants(3)])` para RNF01; deriva contagens por status para MetricsCards |

### Modifications (Existing Files)

| File | Change | Notes |
|------|--------|-------|
| `components/layout/AppSidebar.tsx` | Add `isFounder?: boolean` a `AppSidebarProps`; import `Shield` de lucide-react; renderizar `<Link href="/admin">` condicional após bloco NAV_SECONDARY, só quando `isFounder===true` | "use client" — isFounder deve chegar como prop, nunca buscado dentro |
| `app/(app)/layout.tsx` | Expandir `db.select` para incluir `is_founder: users.is_founder`; passar `isFounder={userRow?.is_founder??false}` a `<AppSidebar>` | Única query, sem round-trip extra; coluna criada em SF01 |

### New Components — components/admin/

| Component | File | Purpose | Key props |
|-----------|------|---------|-----------|
| `MetricsCards` | `metrics-cards.tsx` | 3 stat cards por status (testando=blue, ativa=green, travada=red) — RF06 | `stats:{testando,ativa,travada}:number` |
| `ExpiringTenantsList` | `expiring-tenants-list.tsx` | Lista lojas que vencem em 3 dias — RF07 | `tenants:Array<{id,name,valid_until}>` |
| `TenantTable` | `tenant-table.tsx` | Lista completa com colunas RF10; sort travada-first RF12; abre dialogs de ação | `tenants:AdminTenantRow[]`; "use client" para estado de dialog |
| `TenantStatusBadge` | `tenant-status-badge.tsx` | Badge colorido puro por TenantStatus — RF11 | `status:TenantStatus` |
| `ReleaseDialog` | `release-dialog.tsx` | Confirmação antes de chamar releaseSubscriptionAction; exibe novo valid_until calculado — RF16a | `tenant,open,onOpenChange,onConfirm` |
| `SuspendDialog` | `suspend-dialog.tsx` | Confirmação destrutiva (botão vermelho) antes de suspendTenantAction — RF19 | `tenant,open,onOpenChange,onConfirm` |
| `SubscriptionHistoryModal` | `subscription-history-modal.tsx` | Modal com entries de subscription_log por loja; lazy fetch em `getTenantSubscriptionHistory` ao abrir — RF22 | `tenantId,tenantName,open,onOpenChange` |

### Hooks & State

Todos os dados do painel são server-side. `TenantTable` gerencia estado local "use client": qual dialog (release/suspend/history) está aberto por `tenantId|null`. `releaseFromSuspensionAction` dispara diretamente sem dialog (RF20–RF21). `revalidatePath('/admin')` em cada action atualiza o server component automaticamente (RF16).

### Types (mirror from backend)

`AdminTenantRow`, `SubscriptionLogEntry`, e `TenantStatus` são importados de `lib/services/admin/tenant-admin-service.ts` e `lib/services/subscriptions/subscription-status.ts` — não redefinir.

### Formatting Utilities

| Utility | Purpose |
|---------|---------|
| `formatRevenue(cents:number)` | `(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})` → "R$ X,XX" |
| `formatDate(d:Date\|null)` | `d?.toLocaleDateString('pt-BR') ?? 'nunca'` |

Reference: `components/layout/AppSidebar.tsx`; `app/(app)/layout.tsx`; `app/(app)/caixa/page.tsx` (server fetch pattern); `app/(app)/admin/actions.ts`

---

## Overview

SF02 entrega o painel exclusivo do founder em `/admin`: dashboard com métricas de saúde (lojas por estado, vencimentos próximos, faturamento, último acesso) e controle de billing com 3 ações (liberar +30 dias, suspender, liberar suspensão). Toda acesso cross-tenant usa a conexão `db` (owner, bypassa RLS), protegida pelo guard `requireFounder()`. As mutations reutilizam os métodos de repositório criados em SF01 — SF02 é exclusivamente consumidor das colunas e tabelas que SF01 cria.

## Main Flow

1. **Acesso ao painel** → `GET /admin` → `requireFounder()` verifica `is_founder` via `db` → redireciona `/` se false (RF03)
2. **Carga do dashboard** → `Promise.all([listAllTenantsWithStats(), getExpiringTenants(3)])` via owner `db` → AdminPage renderiza MetricsCards + ExpiringTenantsList + TenantTable
3. **Liberar +30 dias** → clique "Liberar" → ReleaseDialog abre com `new_valid_until` calculado (RF16a) → confirmar → `releaseSubscriptionAction(tenantId)` → `GREATEST(valid_until, NOW()) + 30d` → mutations SF01 → `revalidatePath('/admin')`
4. **Suspender** → clique "Suspender" → SuspendDialog abre (RF19) → confirmar → `suspendTenantAction(tenantId)` → `suspended_at=NOW()` → log 'suspended' → `revalidatePath('/admin')`
5. **Liberar suspensão** → clique direto (sem dialog) → `releaseFromSuspensionAction(tenantId)` → `suspended_at=null` → log 'released' → `revalidatePath('/admin')` (RN03: valid_until inalterado)
6. **Histórico** → clique "Histórico" por loja → SubscriptionHistoryModal abre → lazy fetch `getTenantSubscriptionHistory(tenantId)` → exibe entries por at DESC (RF22)

## Implementation Order

1. **Backend** — `lib/auth/admin.ts` → `lib/services/admin/tenant-admin-service.ts` → `app/(app)/admin/actions.ts`
2. **Frontend** — modificações AppSidebar + layout.tsx → `app/(app)/admin/page.tsx` → componentes `components/admin/`

## Quick Reference

| Padrão | Onde buscar |
|--------|-------------|
| requireAuthContext pattern (base de requireFounder) | `lib/auth.ts` |
| Owner connection (db sem RLS) | `db/index.ts`, `lib/services/tenants/onboarding.ts` |
| getTenantStatus + TenantStatus | `lib/services/subscriptions/subscription-status.ts` (SF01) |
| Repo methods de billing (updateTenantValidUntil, etc.) | `lib/services/subscriptions/` (SF01) |
| Server action pattern (try/catch + toActionError + revalidatePath) | `app/(app)/caixa/actions.ts` |
| AppSidebar prop pattern | `components/layout/AppSidebar.tsx` |
| Server component fetch pattern | `app/(app)/layout.tsx` |
| subscription_log schema | `db/schema/` (SF01 migration) |
