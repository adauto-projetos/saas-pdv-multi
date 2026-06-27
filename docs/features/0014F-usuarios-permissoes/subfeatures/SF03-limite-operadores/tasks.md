# Tasks: SF03 — Limite de Operadores

## Metadata
| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 8 |
| Services | database, backend, frontend, test |

## Requirements Coverage
- [x] RF01 — Migração adiciona `platform_settings.max_operators integer not null default 3`
- [x] RF02 — Painel super admin exibe e edita `max_operators` (server action protegida por `requireFounder()`), mesma UX da edição de preço
- [x] RF03 — Antes de criar operador, conta operadores ativos da loja (`tenant_members` onde `role='operator'` e `is_active=true`)
- [x] RF04 — Se a contagem ≥ `max_operators`, o cadastro é bloqueado com mensagem indicando o limite
- [x] RF05 — Tela "Usuários" mostra "X de N operadores" com base na contagem ativa e em `max_operators`
- [x] RN01 — `max_operators` é global (uma linha em `platform_settings`) enquanto houver um único plano
- [x] RN02 — O `owner` não entra na contagem
- [x] RN03 — Operador desativado não conta — desativar libera um slot
- [x] RN04 — Baixar `max_operators` abaixo da contagem atual não desativa ninguém (grandfather); o teto só vale para novos cadastros
- [x] RNF01 — Checagem + criação atômicas o suficiente para não exceder por concorrência (contagem + insert na mesma transação na conexão owner)

## TDD
- [x] T-TEST-01 `get/setMaxOperators`: lê default (3 / 0 sem linha conforme leitura) e upsert persiste na linha singleton — `lib/services/platform/settings-repository.max-operators.test.ts` (gate HAS_DB)
- [x] T-TEST-02 enforcement no `createOperator`: count==max bloqueia com o limite; count<max passa; owner não conta (RN02); desativado não conta / libera slot (RN03); baixar max não desativa existentes (RN04) — `lib/services/users/operator-service.test.ts` (gate HAS_DB)

## Execution
- [x] T01 Testes de enforcement do limite (falham primeiro)
  - Service: test
  - Files: `lib/services/users/operator-service.test.ts`
  - Deps: SF01-T11 (`createOperator` existe)
  - Verify: `npm test -- operator-service.test` (vermelho/skip sem DB: gate de limite ainda não existe)
- [x] T02 Testes de `get/setMaxOperators`
  - Service: test
  - Files: `lib/services/platform/settings-repository.max-operators.test.ts`
  - Deps: -
  - Verify: `npm test -- settings-repository.max-operators` (vermelho/skip sem DB)
- [x] T03 Schema: `max_operators` em `platform_settings`
  - Service: database
  - Files: `db/schema/platform-settings.ts`
  - Deps: -
  - Verify: `npm run db:push` (sobe sem erro; coluna `max_operators` default 3); depois `npm run db:rls`
- [x] T04 `getMaxOperators`/`setMaxOperators` (owner `db`, upsert singleton)
  - Service: backend
  - Files: `lib/services/platform/settings-repository.ts`
  - Deps: T02, T03
  - Verify: `npm test -- settings-repository.max-operators` verde (com Docker)
- [x] T05 `maxOperatorsSchema` (int ≥ 1) no validation da plataforma
  - Service: backend
  - Files: `lib/validation/platform.ts`
  - Deps: -
  - Verify: `npm run typecheck`; valor < 1 rejeitado
- [x] T06 Gate de contagem no `createOperator` (mesma transação owner)
  - Service: backend
  - Files: `lib/services/users/operator-service.ts`
  - Deps: T01, T03, SF01-T11
  - Verify: `npm test -- operator-service.test` verde (com Docker)
- [x] T07 `updateMaxOperatorsAction` + campo no painel super admin
  - Service: frontend
  - Files: `app/(admin)/superadmin/actions.ts`, `app/(admin)/superadmin/page.tsx`, `components/admin/max-operators-settings.tsx`
  - Deps: T04, T05
  - Verify: `npm run dev` → editar `max_operators` no painel salva sem deploy (gated por `requireFounder`)
- [x] T08 Indicador "X de N operadores" na tela "Usuários"
  - Service: frontend
  - Files: `app/(app)/usuarios/page.tsx`, `app/(app)/usuarios/actions.ts`, `app/(app)/usuarios/UsuariosClient.tsx`
  - Deps: T04, SF01-T15
  - Verify: `npm run dev` → "X de N operadores" reflete contagem ativa vs `max_operators`

## Acceptance Checklist
- [x] `platform_settings.max_operators integer not null default 3` existe após migração (RF01)
- [x] `updateMaxOperatorsAction` (gated por `requireFounder`) edita o campo no painel com a UX da edição de preço (RF02)
- [x] `createOperator` conta `tenant_members` `role='operator'` AND `is_active=true` antes de inserir (RF03)
- [x] Cadastro com contagem ≥ `max_operators` é bloqueado com mensagem citando o limite (RF04)
- [x] Tela "Usuários" exibe "X de N operadores" (contagem ativa vs `max_operators`) (RF05)
- [x] `max_operators` é uma única linha singleton em `platform_settings` (global) (RN01)
- [x] Owner (`role='owner'`) não entra na contagem (RN02)
- [x] Operador `is_active=false` não conta; desativar libera um slot (RN03)
- [x] Baixar `max_operators` abaixo da contagem atual não desativa nenhum operador existente (RN04)
- [x] Contagem + insert ocorrem na mesma `db.transaction` (owner); corrida count==max-1 não excede via `pg_advisory_xact_lock` por tenant (RNF01)

## Validation Gates
- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
