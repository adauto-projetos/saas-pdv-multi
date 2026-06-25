# Tasks: SF03 — Impersonate Loja

## Metadata

| Field | Value |
|-------|-------|
| Complexity | COMPLEX |
| Total tasks | 14 |
| Services | database, backend, frontend, test |

## Requirements Coverage

- [x] RF01 — cookie `pdv_impersonate` httpOnly guarda tenant impersonado
- [x] RF02 — `getImpersonatedTenantId()` seguro fora de request (try/catch → null)
- [x] RF03 — `enterStoreAction` valida founder + tenant existe, grava cookie, redireciona
- [x] RF04 — `exitStoreAction` limpa cookie e volta para `/superadmin`
- [x] RF05 — botão "Entrar na loja" em cada linha do painel
- [x] RF06 — função SQL `current_app_is_founder()`
- [x] RF07 — função SQL `current_app_tenants()` (memberships ∪ impersonado se founder)
- [x] RF08 — 16 políticas `tenant_isolation` usam `current_app_tenants()`
- [x] RF09 — políticas de `tenants` usam `current_app_tenants()`
- [x] RF10 — `withUserRls` injeta GUC `app.impersonate_tenant_id` para founder
- [x] RF11 — `requireAuthContext` resolve tenant impersonado para founder sem loja
- [x] RF12 — barra de impersonação no topo do app
- [x] RF13 — layout usa tenant efetivo e não redireciona founder impersonando
- [x] RN01 — cookie só tem efeito para founder
- [x] RN02 — GUC sempre `SET LOCAL` (escopo de transação)
- [x] RN03 — gate em profundidade: GUC para não-founder não concede acesso

## TDD

- [x] T-TEST-01 RLS impersonate — `db/__tests__/impersonation-rls.test.ts` (T01–T05)
- [x] T-TEST-02 requireAuthContext impersonando — `lib/auth.test.ts` (T06)

## Execution

- [x] T01 Criar migration `0009_impersonation_rls.sql`: `current_app_is_founder()`, `current_app_tenants()`, repolicy de todas as tabelas + `tenants`
  - Service: database
  - Files: `db/migrations/0009_impersonation_rls.sql`
  - Deps: -
  - Verify: `npm run db:rls` aplica sem erro
- [x] T02 Aplicar RLS (`npm run db:rls`)
  - Service: database
  - Deps: T01
  - Verify: script imprime `✓ RLS aplicada: 0009_impersonation_rls.sql`
- [x] T03 Criar `lib/auth/impersonation.ts` (cookie set/get/clear seguro)
  - Service: backend
  - Files: `lib/auth/impersonation.ts`
  - Deps: -
  - Verify: typecheck; `getImpersonatedTenantId` não lança fora de request
- [x] T04 Adicionar `selectIsFounder(userId)` no repository
  - Service: backend
  - Files: `lib/services/subscriptions/repository.ts`
  - Deps: -
  - Verify: typecheck
- [x] T05 Modificar `withUserRls` para injetar GUC de impersonação (founder + cookie)
  - Service: backend
  - Files: `db/rls.ts`
  - Deps: T03, T04
  - Verify: typecheck; testes RLS existentes continuam passando
- [x] T06 Modificar `requireAuthContext` para resolver tenant impersonado
  - Service: backend
  - Files: `lib/auth.ts`
  - Deps: T03, T04
  - Verify: typecheck
- [x] T07 Criar `app/(app)/superadmin/impersonation-actions.ts` (enter/exit)
  - Service: backend
  - Files: `app/(app)/superadmin/impersonation-actions.ts`
  - Deps: T03
  - Verify: typecheck
- [x] T08 Botão "Entrar na loja" na tabela do painel
  - Service: frontend
  - Files: `components/admin/tenant-table.tsx`
  - Deps: T07
  - Verify: typecheck; botão chama `enterStoreAction`
- [x] T09 Criar `components/layout/ImpersonationBanner.tsx`
  - Service: frontend
  - Files: `components/layout/ImpersonationBanner.tsx`
  - Deps: T07
  - Verify: typecheck
- [x] T10 Integrar banner + tenant efetivo no `layout.tsx`
  - Service: frontend
  - Files: `app/(app)/layout.tsx`
  - Deps: T03, T09
  - Verify: typecheck; founder impersonando vê o app, não é redirecionado
- [x] T11 Criar `db/__tests__/impersonation-rls.test.ts` (T01–T05)
  - Service: test
  - Files: `db/__tests__/impersonation-rls.test.ts`
  - Deps: T01, T02
  - Verify: testes passam com DB no ar
- [x] T12 Teste `requireAuthContext` impersonando (T06)
  - Service: test
  - Files: `lib/auth.test.ts`
  - Deps: T06
  - Verify: teste passa
- [x] T13 Rodar validation gates (typecheck, lint, test, build)
  - Service: test
  - Deps: T01–T12
  - Verify: todos exit 0
- [x] T14 Log iteration + checkpoint tag + epic SF03 done
  - Service: -
  - Deps: T13
  - Verify: `iterations.jsonl` atualizado, tag criada, epic.md marca SF03 done

## Acceptance Checklist

- [x] Founder entra numa loja pelo painel e vê os dados dela no app
- [x] Founder cria/edita dados dentro da loja impersonada (acesso total)
- [x] Barra de impersonação aparece e "Sair da loja" volta ao painel
- [x] Teste negativo: não-founder com GUC setada não acessa o tenant
- [x] Teste de isolamento: impersonando loja A, loja B continua invisível
- [x] Testes RLS pré-existentes continuam passando (sem regressão)

## Validation Gates

- [x] typecheck (`npm run typecheck`)
- [x] lint (`npm run lint`)
- [x] test (`npm test`)
- [x] build (`npm run build`)
