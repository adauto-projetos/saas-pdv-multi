# Tasks: 0020F — Camada de Dados & Services (Unidade 2 da remediação)

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 9 |
| Services | database, backend, test |

## Requirements Coverage

- [x] RF01 — Acesso a dados super-admin exclusivamente via `lib/services/admin/`
- [x] RF02 — `listOperators` carrega operadores + permissões em ≤ 2 queries
- [x] RF03 — Regressão valida isolamento cross-tenant por tabela com `tenant_id`
- [x] RNF01 — Query de auditoria sobre `override_log` usa índice (sem Seq Scan)
- [x] RNF02 — Sem regressão funcional; gates exit 0; comportamento idêntico
- [x] RN01 — Push-only é a estratégia oficial de evolução de schema
- [x] RN02 — `db:migrate` e migration `0000` stale removidos/aposentados
- [x] RN03 — `tenant_id` como fronteira inviolável travada por contrato de teste

## TDD

- [x] T-TEST-01 Contract test N+1 batch (≤2 queries, empty, map, parity) RF02 — `lib/services/users/__tests__/operator-service.test.ts`
- [x] T-TEST-02 Contract test serviços super-admin (getname/release/suspend/unsuspend) RF01 — `lib/services/admin/__tests__/tenant-admin-service.test.ts`
- [x] T-TEST-03 Assert estrutural: actions super-admin sem import Drizzle RF01 — `app/(admin)/superadmin/__tests__/actions-no-drizzle.test.ts`
- [x] T-TEST-04 Suite regressão isolamento parametrizada (19 tabelas com `tenant_id`, auto-derivada do schema) RF03/RN03 — `db/__tests__/tenant-isolation-regression.test.ts`
- [x] T-TEST-05 EXPLAIN Index Scan + parity de resultado RNF01 — `db/__tests__/override-log-index.test.ts`
- [x] T-TEST-06 Push-only oficial; sem `db:migrate`/`0000` RN01/RN02 — `db/__tests__/migration-strategy.test.ts`

## Execution

- [x] T01 Adicionar índice composto em override_log
  - Service: database
  - Files: `db/schema/override-log.ts`
  - Deps: -
  - Verify: `npm run db:push` aplica; `EXPLAIN` da query de auditoria mostra Index Scan
- [x] T02 Remover migration 0000 stale e script db:migrate
  - Service: database
  - Files: `db/migrations/0000_perfect_mikhail_rasputin.sql`, `package.json`
  - Deps: -
  - Verify: `grep -r "db:migrate" package.json` vazio; arquivo `0000` ausente; `*_rls.sql` intactos
- [x] T03 Documentar push-only oficial no CLAUDE.md
  - Service: database
  - Files: `CLAUDE.md`
  - Deps: T02
  - Verify: seção "Banco"/"Validation Gates" descreve push-only + `db:setup` = push + rls
- [x] T04 Adicionar selectPermissionsByUserIds batch
  - Service: backend
  - Files: `lib/services/permissions/permission-data.ts`
  - Deps: -
  - Verify: `npm test -- operator-service` (ops-RF02-empty, -map passam)
- [x] T05 Refatorar listOperators para batch (≤2 queries)
  - Service: backend
  - Files: `lib/services/users/operator-service.ts`
  - Deps: T04
  - Verify: `npm test -- operator-service` (ops-RF02-batch, -parity passam)
- [x] T06 Criar admin-data.ts com selectTenantName
  - Service: backend
  - Files: `lib/services/admin/admin-data.ts`
  - Deps: -
  - Verify: `npm run typecheck` ok; `getTenantName` consome a função
- [x] T07 Adicionar funções transacionais ao tenant-admin-service
  - Service: backend
  - Files: `lib/services/admin/tenant-admin-service.ts`
  - Deps: T06
  - Verify: `npm test -- tenant-admin-service` (admin-RF01-* passam)
- [x] T08 Limpar actions.ts para chamar só services
  - Service: backend
  - Files: `app/(admin)/superadmin/actions.ts`
  - Deps: T07
  - Verify: `npm test -- actions-no-drizzle` verde; zero import de `db`/`tenants`/drizzle
- [x] T09 Criar suite de regressão de isolamento parametrizada
  - Service: test
  - Files: `db/__tests__/tenant-isolation-regression.test.ts`
  - Deps: -
  - Verify: `npm test -- tenant-isolation-regression` (19 tabelas; read+write bloqueados; allpresent verde)

## Acceptance Checklist

- [x] `lib/services/admin/admin-data.ts` expõe `selectTenantName(tenantId)` via owner db (RF01)
- [x] `tenant-admin-service.ts` expõe `releaseSubscription`, `suspendTenant`, `releaseFromSuspension`, `getTenantName` transacionais (RF01)
- [x] `app/(admin)/superadmin/actions.ts` sem nenhum import de `db`/`tenants`/drizzle (RF01)
- [x] `releaseSubscription` atualiza `valid_until` + grava `subscription_log` "renewed" na mesma tx (RF01)
- [x] `selectPermissionsByUserIds(tenantId, [])` retorna `new Map()` sem ir ao banco (RF02)
- [x] `listOperators` executa ≤ 2 queries independente do nº de operadores; `OperatorDto[]` inalterado (RF02, RNF02)
- [x] Suite parametrizada bloqueia leitura cross-tenant em cada tabela com `tenant_id` (RF03)
- [x] Suite parametrizada bloqueia escrita cross-tenant em cada tabela com `tenant_id` (RF03)
- [x] `iso-RN03-allpresent` falha se uma tabela com `tenant_id` ficar fora da suite (RN03)
- [x] Tabela com `tenant_id` sem policy faz a suite ficar vermelha (RN03)
- [x] Índice `(tenant_id, created_at, action_code)` presente em `override_log`; `EXPLAIN` sem Seq Scan (RNF01)
- [x] Resultado da query de auditoria idêntico antes/depois do índice (RNF01, RNF02)
- [x] `CLAUDE.md` documenta push-only como estratégia oficial; `db:setup` = push + rls (RN01)
- [x] `db:migrate` removido do `package.json`; `0000_*.sql` ausente; `*_rls.sql` preservados (RN02)
- [x] `typecheck`/`lint`/`test`/`build` saem exit 0 (RNF02)

## Validation Gates

- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures

### Known Issues

- Nenhum. Falha de "too many clients" no full-test foi exaustão de conexões do Postgres local (max_connections=100 saturado por conexões acumuladas); resolvida com `docker restart pdv_postgres`. Não é defeito de código.
