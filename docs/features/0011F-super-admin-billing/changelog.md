---
id: CHG0012
type: changelog
date: 2026-06-25
related: [0011F]
---

## TL;DR

Assinatura mensal com ciclo de vida (trial → ativa → travada) derivado de `valid_until`, painel exclusivo do founder em `/superadmin` para liberar/suspender lojas e ver métricas, e impersonação de qualquer loja para suporte — tudo com isolamento garantido por RLS.

## Changes

- feat(subscriptions): schema de assinatura (`status`, `valid_until`, trial, histórico) + `is_founder` em users — {{doc:0011F}}
- feat(subscriptions): status derivado de `valid_until` (testando/ativa/travada), sem cron — módulo puro em `subscription-status.ts`
- feat(auth): `requireActiveTenant` bloqueia escritas (vendas, estoque, caixa, comandas, financeiro) quando a loja está travada
- feat(ui): `SubscriptionWarningBanner` (vencimento próximo) e `SubscriptionLockedBanner` (loja travada)
- feat(seed): seed do founder + `scripts/seed-test-stores.ts` para popular lojas de teste
- feat(admin): painel `/superadmin` (route group `(admin)` com layout próprio) — métricas, lojas a vencer, tabela de lojas
- feat(admin): ações `releaseFromSuspension` e `suspendTenant` com auditoria em `subscription_log`
- feat(admin): `tenant-admin-service` com queries cross-tenant sob `requireFounder()`
- feat(impersonation): founder entra em qualquer loja via `current_app_tenants()` RLS + cookie httpOnly + `withUserRls`; actions enter/exit + `ImpersonationBanner`
- feat(security): defesa em profundidade — app valida founder (`selectIsFounder`) e SQL valida `current_app_is_founder()`; layout `(admin)` revalida `isFounder`
- fix(superadmin): remove `proxy.ts` (x-pathname) que causava loop de reload; migra para route group idiomático Next 16
- refactor(subscriptions): remove `selectHasRenewed` duplicada — I/O isolado em `repository.ts`
- fix(admin): pending por-linha na tabela de lojas (`pendingId`) — ação numa loja não trava as outras
- fix(ui): tabela com `overflow-x` + `MetricsCards` com grid responsivo (mobile)
- fix(a11y): `aria-label` contextual, `type="button"` e `aria-busy` nos controles do painel e banner
- test: 369 testes passando — RLS de admin/impersonação, status de assinatura, componentes do painel

## Breaking

- Escritas de negócio (vendas, movimentos de estoque/caixa, comandas, contas a pagar/receber) agora são **bloqueadas** quando a loja está `travada`. Afeta toda loja com `valid_until` vencido ou suspensa manualmente. Mitigação: liberar a loja pelo painel `/superadmin` ou renovar a assinatura.
- Migrations `0008`/`0009` adicionam colunas e RLS. `drizzle-kit push` derruba policies — rodar `npm run db:rls` (ou `npm run db:setup`) após aplicar.

## Migration

1. Aplicar schema/migrations: `npm run db:setup` (= `db:push` + `db:rls`) — garante que as policies de `subscription_log` e impersonação fiquem ativas.
2. Semear o founder: rodar `db/seeds/founder.ts` (define `is_founder = true` no usuário fundador).
3. Lojas existentes sem `valid_until` entram como `testando`/trial — ajustar `valid_until` ou liberar pelo painel conforme o caso.
4. Rollback: reverter migrations `0009` e `0008`; remover `is_founder`/colunas de assinatura. Sem dados de assinatura, todas as lojas voltam a operar sem bloqueio.

## Quick Ref

```json
{"id":"F0011","domain":"super-admin billing","touched":["db/schema/","db/migrations/","lib/auth/","lib/services/admin/","lib/services/subscriptions/","app/(admin)/superadmin/","components/admin/","components/layout/"],"patterns":["RLS bypass/scope for admin reads","write-blocking guard middleware","subscription state machine","impersonation via session GUC","conditional route-group layout"],"keywords":["subscription","trial","travada","founder","impersonation","RLS","tenant","superadmin"]}
```
