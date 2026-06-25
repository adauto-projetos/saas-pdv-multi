---
id: 0011F-SF01
type: feature-tasks
created: 2026-06-22
updated: 2026-06-23
related: [0011F]
---

# Tasks: SF01 — Assinatura Lifecycle

## Metadata

| Field | Value |
|-------|-------|
| Complexity | COMPLEX |
| Total tasks | 26 |
| Services | database, backend, frontend, test |

## Requirements Coverage

- [x] RN01 — Trial set on tenant creation (valid_until +7d + subscription_log trial_started)
- [x] RN02 — getTenantStatus deriva testando/ativa/travada com carencia de 2 dias
- [x] RN03 — suspended_at forca travada independente de valid_until
- [x] RN04 — subscription_log append-only (sem DELETE nem UPDATE por app_user)
- [x] RF01 — createUserWithTenant seta valid_until + subscription_log atomicamente
- [x] RF02 — requireActiveTenant le via owner db e lanca TenantLockedError quando travada
- [x] RF03 — 16 write actions chamam requireActiveTenant antes de qualquer mutacao
- [x] RNF01 — requireActiveTenant resolve em menos de 50ms
- [x] RF04 — Banner amarelo quando valid_until - 3d < agora e status nao-travada
- [x] RF05 — Banner vermelho quando status = travada (nao dispensavel)
- [x] RF06 — Acoes bloqueadas retornam erro visivel (toast), nunca silencioso
- [x] RF07 — db/seeds/founder.ts seta is_founder=true via FOUNDER_EMAIL

## TDD

- [ ] T-TEST-01 Testes unitarios de getTenantStatus (T04–T09) — `tests/unit/subscription-status.test.ts`
- [ ] T-TEST-02 Testes unitarios de requireActiveTenant/TenantLockedError (T12–T14) — `tests/unit/tenant-guard.test.ts`
- [ ] T-TEST-03 Testes de integracao de createUserWithTenant com trial (T01–T03) — `tests/integration/onboarding.test.ts`
- [ ] T-TEST-04 Testes de integracao de requireActiveTenant contra DB real (T15–T19) — `tests/integration/tenant-guard.test.ts`
- [ ] T-TEST-05 Testes de integracao de founder seed (T25–T26) — `tests/integration/founder-seed.test.ts`
- [ ] T-TEST-06 Testes de integracao de RLS append-only em subscription_log (T10–T11) — `tests/integration/subscription-log-rls.test.ts`
- [ ] T-TEST-07 Testes de componente SubscriptionWarningBanner (T20–T21) — `tests/components/SubscriptionWarningBanner.test.tsx`
- [ ] T-TEST-08 Testes de componente SubscriptionLockedBanner (T22–T23) — `tests/components/SubscriptionLockedBanner.test.tsx`
- [ ] T-TEST-09 Teste de componente layout com banners de assinatura (T24) — `tests/components/layout-subscription.test.tsx`

## Execution

- [x] T01 Migration: ALTER tenants, ALTER users, CREATE subscription_log
  - Service: database
  - Files: `db/migrations/0008_subscription_lifecycle.sql`
  - Deps: -
  - Verify: `npm run db:push` aplica sem erro; `\d tenants` mostra valid_until e suspended_at; `\d users` mostra is_founder; `\d subscription_log` existe

- [x] T02 RLS policy append-only em subscription_log
  - Service: database
  - Files: `db/migrations/0008_subscription_rls.sql`
  - Deps: T01
  - Verify: `npm run db:rls` exitcode 0; T-TEST-06 passa (DELETE e UPDATE bloqueados para app_user)

- [x] T03 Schema Drizzle: tenants, users, subscription_log
  - Service: database
  - Files: `db/schema/tenants.ts`, `db/schema/users.ts`, `db/schema/subscriptions.ts`
  - Deps: T01
  - Verify: `npm run typecheck` limpo; exports de schema referenciados sem erro

- [x] T04 Repository: selectTenantById e insertSubscriptionLog
  - Service: backend
  - Files: `lib/services/subscriptions/repository.ts`
  - Deps: T03
  - Verify: `npm run typecheck` limpo; funcoes exportadas e tipos corretos

- [x] T05 Repository: selectHasRenewed, updateTenantValidUntil, updateTenantSuspendedAt, setFounderByEmail
  - Service: backend
  - Files: `lib/services/subscriptions/repository.ts`
  - Deps: T04
  - Verify: `npm run typecheck` limpo; setFounderByEmail lanca erro quando 0 rows updated

- [x] T06 subscription-status.ts: TenantStatus union type e getTenantStatus
  - Service: backend
  - Files: `lib/services/subscriptions/subscription-status.ts`
  - Deps: T03
  - Verify: T-TEST-01 passa (T04–T09 todos verdes); funcao pura sem side effects

- [x] T07 errors.ts: adicionar TENANT_LOCKED ao ErrorCode union
  - Service: backend
  - Files: `lib/services/errors.ts`
  - Deps: -
  - Verify: `npm run typecheck` limpo; 'TENANT_LOCKED' reconhecido por toActionError

- [x] T08 tenant-guard.ts: TenantLockedError e requireActiveTenant
  - Service: backend
  - Files: `lib/auth/tenant-guard.ts`
  - Deps: T06, T07
  - Verify: T-TEST-02 passa (T12–T14 todos verdes); importa owner db (sem RLS)

- [x] T09 onboarding.ts: valid_until +7d e trial_started atomico
  - Service: backend
  - Files: `lib/services/tenants/onboarding.ts`
  - Deps: T05, T08
  - Verify: T-TEST-03 passa (T01–T03 todos verdes); transacao atomica confirmada

- [x] T10 Guard: caixa/actions.ts — finalizeSaleAction
  - Service: backend
  - Files: `app/(app)/caixa/actions.ts`
  - Deps: T08
  - Verify: T-TEST-04 T15 passa; finalizeSaleAction retorna {ok:false} sem DB write quando travada

- [x] T11 Guard: estoque/actions.ts — recordEntryAction e recordAdjustmentAction
  - Service: backend
  - Files: `app/(app)/estoque/actions.ts`
  - Deps: T08
  - Verify: T-TEST-04 T16 passa; mutations de estoque bloqueadas quando travada

- [x] T12 Guard: financeiro/caixa/actions.ts — registerCashInflowAction e registerCashOutflowAction
  - Service: backend
  - Files: `app/(app)/financeiro/caixa/actions.ts`
  - Deps: T08
  - Verify: T-TEST-04 T17 passa; cash_movements nao alterados quando travada

- [x] T13 Guard: financeiro/receber e financeiro/pagar — 4 actions
  - Service: backend
  - Files: `app/(app)/financeiro/receber/actions.ts`, `app/(app)/financeiro/pagar/actions.ts`
  - Deps: T08
  - Verify: createReceivableAction, recordReceivablePaymentAction, createPayableAction, recordPayablePaymentAction bloqueadas quando travada

- [x] T14 Guard: lucro/actions.ts — openCashSessionAction e closeCashSessionAction
  - Service: backend
  - Files: `app/(app)/lucro/actions.ts`
  - Deps: T08
  - Verify: cash_sessions nao alteradas quando travada; `npm run typecheck` limpo

- [x] T15 Guard: comandas/actions.ts — 5 actions (open, add, remove, close, cancel)
  - Service: backend
  - Files: `app/(app)/comandas/actions.ts`
  - Deps: T08
  - Verify: T-TEST-04 T18 passa; comandas nao alteradas quando travada

- [x] T16 db/seeds/founder.ts: le FOUNDER_EMAIL e chama setFounderByEmail
  - Service: backend
  - Files: `db/seeds/founder.ts`
  - Deps: T05
  - Verify: T-TEST-05 passa (T25–T26); lanca erro se email nao existe; `npm run typecheck` limpo

- [x] T17 SubscriptionWarningBanner: banner amarelo com daysLeft e WhatsApp
  - Service: frontend
  - Files: `components/layout/SubscriptionWarningBanner.tsx`
  - Deps: -
  - Verify: T-TEST-07 passa (T20–T21); banner visivel com daysLeft correto; nao renderiza quando status ok

- [x] T18 SubscriptionLockedBanner: banner vermelho fixo nao-dispensavel
  - Service: frontend
  - Files: `components/layout/SubscriptionLockedBanner.tsx`
  - Deps: -
  - Verify: T-TEST-08 passa (T22–T23); sem botao de fechar; WhatsApp 13 99130-6911 visivel

- [x] T19 layout.tsx: fetch valid_until/suspended_at e renderizar banners condicionais
  - Service: frontend
  - Files: `app/(app)/layout.tsx`
  - Deps: T06, T17, T18
  - Verify: T-TEST-09 T24 passa (parcial — sem toast); banner amarelo aparece com valid_until-3d<agora; banner vermelho aparece quando travada

- [x] T20 Toast call-sites: toast.error() em actions que retornam {ok:false}
  - Service: frontend
  - Files: `components/caixa/CashierScreen.tsx`, `components/estoque/StockMovementDialog.tsx`, `components/comandas/OpenComandaDialog.tsx`
  - Deps: T10, T11, T15
  - Verify: T-TEST-09 T24 passa (completo); toast.error visivel; nenhuma falha silenciosa (call-sites ja tinham toast.error no !res.ok)

## Acceptance Checklist

- [x] `tenants` tem coluna `valid_until timestamptz` nullable apos migration (RN01, RF01)
- [x] `tenants` tem coluna `suspended_at timestamptz` nullable apos migration (RN03)
- [x] `users` tem coluna `is_founder boolean NOT NULL DEFAULT false` apos migration (RF07)
- [x] Tabela `subscription_log` criada com check constraint action IN ('trial_started','renewed','suspended','released') (RN04)
- [x] `subscription_log` tem indices em (tenant_id, at DESC) e (tenant_id, action) (RNF01)
- [x] RLS de `subscription_log` permite SELECT e INSERT para app_user; bloqueia UPDATE e DELETE (RN04)
- [x] `createUserWithTenant` define `valid_until = NOW() + INTERVAL '7 days'` na mesma transacao (RN01, RF01)
- [x] `createUserWithTenant` insere `subscription_log(action='trial_started')` na mesma transacao (RN01, RF01)
- [x] Falha no meio da transacao de signup nao deixa tenant nem subscription_log parciais (RF01)
- [x] `getTenantStatus` retorna 'travada' quando `suspended_at IS NOT NULL`, mesmo com valid_until no futuro (RN03)
- [x] `getTenantStatus` retorna 'travada' quando `valid_until + 2 dias < NOW()` (RN02)
- [x] `getTenantStatus` nao retorna 'travada' dentro da carencia de 2 dias (valid_until ontem) (RN02)
- [x] `getTenantStatus` retorna 'testando' quando nao travada e hasRenewed=false (RN02)
- [x] `getTenantStatus` retorna 'ativa' quando nao travada e hasRenewed=true (RN02)
- [x] `requireActiveTenant` le tenant via owner db (sem RLS) — acessa tenants fora do tenant do usuario (RF02)
- [x] `requireActiveTenant` lanca `TenantLockedError` com code='TENANT_LOCKED' quando travada (RF02, RF06)
- [x] `requireActiveTenant` nao lanca quando status e 'testando' ou 'ativa' (RF02)
- [x] `requireActiveTenant` resolve em menos de 50ms em integracao com DB real (RNF01)
- [x] `finalizeSaleAction` chama `requireActiveTenant` antes de `withUserRls` (RF03)
- [x] `recordEntryAction` e `recordAdjustmentAction` chamam `requireActiveTenant` (RF03)
- [x] `registerCashInflowAction` e `registerCashOutflowAction` chamam `requireActiveTenant` (RF03)
- [x] `createReceivableAction`, `recordReceivablePaymentAction`, `createPayableAction`, `recordPayablePaymentAction` chamam `requireActiveTenant` (RF03)
- [x] `openCashSessionAction` e `closeCashSessionAction` chamam `requireActiveTenant` (RF03)
- [x] `openComandaAction`, `addComandaItemAction`, `removeComandaItemAction`, `closeComandaAction`, `cancelComandaAction` chamam `requireActiveTenant` (RF03)
- [x] `TenantLockedError` e capturada por `toActionError` e retorna `{ ok: false, error: '...' }` (RF06)
- [x] Banner amarelo `<SubscriptionWarningBanner>` exibido quando `valid_until - 3d < agora` e status nao e 'travada' (RF04)
- [x] Banner amarelo exibe contagem regressiva de dias e mensagem com WhatsApp 13 99130-6911 (RF04)
- [x] Banner amarelo nao exibido quando valid_until esta a mais de 3 dias no futuro (RF04)
- [x] Banner vermelho `<SubscriptionLockedBanner>` exibido quando status = 'travada' (RF05)
- [x] Banner vermelho nao tem botao de fechar (nao dispensavel) (RF05)
- [x] Acao bloqueada exibe `toast.error()` com mensagem — sem falha silenciosa (RF06)
- [x] `db/seeds/founder.ts` le FOUNDER_EMAIL do ambiente e seta `is_founder=true` (RF07)
- [x] `setFounderByEmail` lanca erro se o email nao existe na tabela users (RF07)

## Validation Gates

- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
