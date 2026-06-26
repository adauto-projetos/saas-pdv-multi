# Tasks: 0013F — Liberação Flexível de Meses

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 9 |
| Services | test, database, backend, frontend |

## Requirements Coverage

- [x] RF01 — Campo numérico de meses no diálogo, pré-preenchido com 1
- [x] RF02 — Preview da nova validade ao vivo conforme o número digitado
- [x] RF03 — Confirmar avança N meses de calendário a partir da base
- [x] RF04 — Liberação destrava a loja suspensa (volta ao estado ativo)
- [x] RF05 — Registra meses liberados, validade resultante e autor
- [x] RN01 — Inteiro 1–24; rejeitado na tela e revalidado no servidor
- [x] RN02 — Meses de calendário com ajuste de fim-de-mês (clamp)
- [x] RN03 — Base = max(validUntil, hoje); não recupera tempo vencido
- [x] RNF01 — Liberação restrita ao founder

## TDD

- [x] T-TEST-01 Util puro addCalendarMonths — meses de calendário e clamp (RN02) — `lib/format/calendar-month.test.ts` (T49–T53)
- [x] T-TEST-02 Zod releaseMonthsSchema — boundaries 1–24 e tipo (RN01) — `lib/validation/subscription.test.ts` (T54–T58)
- [x] T-TEST-03 Integração da action — base, destrava, log, defesa-em-profundidade, founder (RF03/RF04/RF05/RN01/RN03/RNF01) — `app/(admin)/superadmin/actions.test.ts` (T59–T65)
- [x] T-TEST-04 Componente ReleaseDialog — default 1, preview ao vivo, guard de range (RF01/RF02/RN01) — `components/admin/release-dialog.test.tsx` (T66–T68)

## Execution

- [x] T01 Escrever testes puros do util e do schema
  - Service: test
  - Files: `lib/format/calendar-month.test.ts`, `lib/validation/subscription.test.ts`
  - Deps: -
  - Verify: `npm test -- calendar-month subscription` (vermelho até T03/T04)

- [x] T02 Adicionar coluna nullable months_released
  - Service: database
  - Files: `db/schema/subscriptions.ts`
  - Deps: -
  - Verify: `npm run db:setup` (db:push + db:rls; reaplica RLS)

- [x] T03 Criar util addCalendarMonths (calendário + clamp)
  - Service: backend
  - Files: `lib/format/calendar-month.ts`
  - Deps: T01
  - Verify: `npm test -- calendar-month`

- [x] T04 Criar releaseMonthsSchema (zod 1–24, pt-BR)
  - Service: backend
  - Files: `lib/validation/subscription.ts`
  - Deps: T01
  - Verify: `npm test -- subscription`

- [x] T05 Ampliar insertSubscriptionLog com monthsReleased
  - Service: backend
  - Files: `lib/services/subscriptions/repository.ts`
  - Deps: T02
  - Verify: `npm run typecheck`

- [x] T06 Atualizar action: months + safeParse + addCalendarMonths + log
  - Service: backend
  - Files: `app/(admin)/superadmin/actions.ts`, `app/(admin)/superadmin/actions.test.ts`
  - Deps: T03, T04, T05
  - Verify: `npm test -- superadmin/actions` (inclui T24/T25 ajustadas p/ `(tenantId, 1)`)

- [x] T07 ReleaseDialog: input default 1, preview ao vivo, guard isValid
  - Service: frontend
  - Files: `components/admin/release-dialog.tsx`
  - Deps: T03, T04
  - Verify: `npm run typecheck` e checagem visual do diálogo

- [x] T08 TenantTable: copy "Liberar meses" e wiring de months
  - Service: frontend
  - Files: `components/admin/tenant-table.tsx`
  - Deps: T07
  - Verify: clicar "Liberar meses" → confirmar N → validade avança

- [x] T09 Escrever testes de integração e de componente
  - Service: test
  - Files: `app/(admin)/superadmin/actions.test.ts`, `components/admin/release-dialog.test.tsx`
  - Deps: T06, T07
  - Verify: `npm test` (T59–T65 pulam sem DATABASE_URL; T66–T68 exigem jsdom/RTL)

## Acceptance Checklist

- [x] Input numérico do `ReleaseDialog` renderiza com valor inicial `1` (RF01)
- [x] Preview da nova validade recalcula ao vivo via `addCalendarMonths` ao digitar (RF02)
- [x] `releaseSubscriptionAction(tenantId, months)` avança a validade N meses de calendário (RF03)
- [x] Action zera `suspendedAt` (loja suspensa volta a ativa) na transação (RF04)
- [x] `insertSubscriptionLog` grava `monthsReleased`, `validUntilAfter` e `byUserId` com `action="renewed"` (RF05)
- [x] Coluna `subscription_log.months_released` (integer, nullable) existe no schema (RF05)
- [x] `releaseMonthsSchema` (`.int().finite().min(1).max(24)`) rejeita 0, 25, 1.5, Infinity, negativos (RN01)
- [x] Action faz `safeParse` e retorna `{ok:false}` antes do try para months fora do range (RN01)
- [x] `ReleaseDialog` desabilita Confirmar + mostra msg pt-BR quando fora de 1–24 (RN01)
- [x] `addCalendarMonths` soma meses de calendário e clampa overflow de fim-de-mês (Jan 31 +1 → Fev 28/29) (RN02)
- [x] Base do cálculo é `max(validUntil, now)`; loja vencida acumula a partir de hoje (RN03)
- [x] `requireFounder()` bloqueia não-founder com erro de acesso (RNF01)
- [x] Quality Gate `npm run typecheck` passa (exit 0)
- [x] Quality Gate `npm run lint` passa (exit 0)
- [x] Quality Gate `npm test` passa (exit 0)
- [x] Quality Gate `npm run build` passa (exit 0)

## Quality Gates

- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures

### Known Issues

- scripts/full-test.mjs:242,360 — 2 lint warnings (no-unused-vars) pré-existentes em arquivo não tocado por esta feature
