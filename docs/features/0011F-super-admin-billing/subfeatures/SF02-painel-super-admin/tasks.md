# Tasks: SF02 — Painel Super Admin

## Metadata

| Field | Value |
|-------|-------|
| Complexity | COMPLEX |
| Total tasks | 26 |
| Services | test, backend, frontend |

## Requirements Coverage

- [x] RF01 — `requireFounder()` verifica sessão e `is_founder` via owner db
- [x] RF02 — todo server component e action de `/admin` chama `requireFounder()`
- [x] RF03 — acesso sem `is_founder` redireciona para `/`
- [x] RF04 — link "Admin" no AppSidebar renderizado condicionalmente via `isFounder`
- [x] RF05 — link "Admin" na seção secundária do sidebar com ícone Shield
- [x] RF06 — painel de contagem de lojas por estado (testando / ativa / travada)
- [x] RF07 — lista "vence em 3 dias" ordenada por `valid_until` ASC, excluindo suspensas
- [x] RF08 — faturamento do mês: `SUM(sales.total_cents)` por tenant no mês corrente
- [x] RF09 — último acesso: `MAX(created_at)` de sales/stock_movements por tenant
- [ ] RNF01 — dashboard carrega em até 2s para até 200 lojas (índices em tenant_id+created_at)
- [x] RF10 — tabela completa com colunas nome, estado, valid_until, faturamento, último acesso, ações
- [x] RF11 — estados com cores distintas: testando=azul, ativa=verde, travada=vermelho
- [x] RF12 — ordenação padrão: travadas primeiro, depois valid_until ASC
- [x] RF13 — `new_valid_until = GREATEST(valid_until, NOW()) + 30 dias`
- [x] RF14 — seta `valid_until = new_valid_until` e zera `suspended_at = NULL`
- [x] RF15 — insere `subscription_log(action='renewed')` com campos obrigatórios
- [x] RF16 — UI reflete novo estado imediatamente após ação via `revalidatePath`
- [x] RF16a — dialog de confirmação antes de executar liberar, exibe novo valid_until
- [x] RF17 — seta `suspended_at = NOW()` ao suspender
- [x] RF18 — insere `subscription_log(action='suspended')` com `by_user_id`
- [x] RF19 — confirmação explícita antes de suspender; botão confirmar destrutivo (vermelho)
- [x] RF20 — zera `suspended_at = NULL` ao liberar suspensão; não altera `valid_until`
- [x] RF21 — insere `subscription_log(action='released')` com `by_user_id`
- [x] RF22 — modal de histórico: entradas do `subscription_log` por tenant, ordenadas por `at` DESC
- [x] RN01 — dias acumulam: +30 parte de `valid_until` futuro, não de hoje
- [x] RN02 — suspensão força `travada` imediatamente para qualquer estado atual
- [x] RN03 — liberar suspensão não altera `valid_until`; loja pode continuar `travada` por vencimento

## TDD

- [x] T-TEST-01 Auth guard — `lib/auth/admin.test.ts` (T01, T02, T03)
- [x] T-TEST-02 RLS integration /admin — `db/__tests__/admin-rls.test.ts` (T04, T05, T06)
- [x] T-TEST-03 AppSidebar isFounder prop — `components/layout/AppSidebar.test.tsx` (T07, T08, T09)
- [x] T-TEST-04 Admin service queries — `lib/services/admin/tenant-admin-service.test.ts` (T10, T11, T13–T20, T44)
- [x] T-TEST-05 MetricsCards render — `components/admin/metrics-cards.test.tsx` (T12)
- [x] T-TEST-06 TenantStatusBadge cores — `components/admin/tenant-status-badge.test.tsx` (T22)
- [x] T-TEST-07 TenantTable colunas e sort — `components/admin/tenant-table.test.tsx` (T21, T23, T29, T30, T35, T36, T37)
- [x] T-TEST-08 Server actions billing — `app/(app)/admin/actions.test.ts` (T24–T28, T31–T34, T38–T43)
- [x] T-TEST-09 SubscriptionHistoryModal — `components/admin/subscription-history-modal.test.tsx` (T45, T46)

## Execution

- [x] T01 Criar `lib/auth/admin.test.ts` com T01–T03
  - Service: test
  - Files: `lib/auth/admin.test.ts`
  - Deps: -
  - Verify: arquivo existe com `expect` para UnauthorizedError em T01, T02; resolve em T03

- [x] T02 Criar `db/__tests__/admin-rls.test.ts` com T04–T06
  - Service: test
  - Files: `db/__tests__/admin-rls.test.ts`
  - Deps: -
  - Verify: arquivo existe com asserts de redirect e status 200

- [x] T03 Adicionar casos T07–T09 em `AppSidebar.test.tsx`
  - Service: test
  - Files: `components/layout/AppSidebar.test.tsx`
  - Deps: -
  - Verify: arquivo contém `queryByRole` e `getByRole` para link `/admin`

- [x] T04 Criar `lib/services/admin/tenant-admin-service.test.ts` com T10–T20, T44
  - Service: test
  - Files: `lib/services/admin/tenant-admin-service.test.ts`
  - Deps: -
  - Verify: arquivo cobre `listAllTenantsWithStats`, `getExpiringTenants`, `getTenantSubscriptionHistory`

- [x] T05 Criar testes de componentes admin (MetricsCards, TenantStatusBadge, TenantTable)
  - Service: test
  - Files: `components/admin/metrics-cards.test.tsx`, `components/admin/tenant-status-badge.test.tsx`, `components/admin/tenant-table.test.tsx`
  - Deps: -
  - Verify: arquivos contêm `expect` para T12, T22, T21/T23/T29/T30/T35/T36/T37

- [x] T06 Criar `app/(app)/admin/actions.test.ts` com T24–T43 relevantes
  - Service: test
  - Files: `app/(app)/admin/actions.test.ts`
  - Deps: -
  - Verify: cobre releaseSubscriptionAction, suspendTenantAction, releaseFromSuspensionAction

- [x] T07 Criar `components/admin/subscription-history-modal.test.tsx` com T45–T46
  - Service: test
  - Files: `components/admin/subscription-history-modal.test.tsx`
  - Deps: -
  - Verify: testa render de entries e lazy fetch (T46: mock não chamado antes de `open=true`)

- [x] T08 Implementar `lib/auth/admin.ts` — guard `requireFounder()`
  - Service: backend
  - Files: `lib/auth/admin.ts`
  - Deps: T01
  - Verify: `npm test -- lib/auth/admin.test.ts` → T01, T02, T03 passam

- [x] T09 Implementar `lib/services/admin/tenant-admin-service.ts` — 3 métodos de query
  - Service: backend
  - Files: `lib/services/admin/tenant-admin-service.ts`
  - Deps: T04, T08
  - Verify: `npm test -- tenant-admin-service.test.ts` → T10, T11, T13–T20, T44 passam

- [x] T10 Implementar `app/(app)/admin/actions.ts` — 3 server actions de billing
  - Service: backend
  - Files: `app/(app)/admin/actions.ts`
  - Deps: T06, T08, T09
  - Verify: `npm test -- admin/actions.test.ts` → T24–T43 passam

- [x] T11 Modificar `components/layout/AppSidebar.tsx` — prop `isFounder` + link condicional
  - Service: frontend
  - Files: `components/layout/AppSidebar.tsx`
  - Deps: T03
  - Verify: `npm test -- AppSidebar.test.tsx` → T07, T08, T09 passam

- [x] T12 Modificar `app/(app)/layout.tsx` — expandir SELECT com `is_founder`; passar para AppSidebar
  - Service: frontend
  - Files: `app/(app)/layout.tsx`
  - Deps: T11
  - Verify: prop `isFounder` presente no render de `<AppSidebar>` na saída do layout

- [x] T13 Criar `app/(app)/admin/page.tsx` — AdminPage server component
  - Service: frontend
  - Files: `app/(app)/admin/page.tsx`
  - Deps: T02, T08, T09, T12
  - Verify: `db/__tests__/admin-rls.test.ts` → T04, T05, T06 passam

- [x] T14 Criar `components/admin/tenant-status-badge.tsx` — badge colorido por TenantStatus
  - Service: frontend
  - Files: `components/admin/tenant-status-badge.tsx`
  - Deps: T06
  - Verify: `npm test -- tenant-status-badge.test.tsx` → T22 passa (cores por status)

- [x] T15 Criar `components/admin/metrics-cards.tsx` — 3 stat cards por estado
  - Service: frontend
  - Files: `components/admin/metrics-cards.tsx`
  - Deps: T05
  - Verify: `npm test -- metrics-cards.test.tsx` → T12 passa (contagens por status)

- [x] T16 Criar `components/admin/expiring-tenants-list.tsx` — lista "vence em 3 dias"
  - Service: frontend
  - Files: `components/admin/expiring-tenants-list.tsx`
  - Deps: T09
  - Verify: componente aceita `tenants: Array<{id,name,valid_until}>` e renderiza sem erro de tipo

- [x] T17 Criar `components/admin/release-dialog.tsx` — confirmação liberar +30 dias
  - Service: frontend
  - Files: `components/admin/release-dialog.tsx`
  - Deps: T06, T10
  - Verify: `npm test -- tenant-table.test.tsx` → T29, T30 passam (dialog abre; action chamada só no confirm)

- [x] T18 Criar `components/admin/suspend-dialog.tsx` — confirmação suspender (destrutiva)
  - Service: frontend
  - Files: `components/admin/suspend-dialog.tsx`
  - Deps: T06, T10
  - Verify: `npm test -- tenant-table.test.tsx` → T35, T36, T37 passam (dialog abre; botão vermelho)

- [x] T19 Criar `components/admin/subscription-history-modal.tsx` — modal histórico lazy
  - Service: frontend
  - Files: `components/admin/subscription-history-modal.tsx`
  - Deps: T07, T09
  - Verify: `npm test -- subscription-history-modal.test.tsx` → T45, T46 passam

- [x] T20 Criar `components/admin/tenant-table.tsx` — tabela completa com sort e dialogs
  - Service: frontend
  - Files: `components/admin/tenant-table.tsx`
  - Deps: T14, T17, T18, T19
  - Verify: `npm test -- tenant-table.test.tsx` → T21, T23 passam (colunas e sort travada-first)

- [x] T21 Integrar componentes na AdminPage
  - Service: frontend
  - Files: `app/(app)/admin/page.tsx`
  - Deps: T13, T15, T16, T20
  - Verify: `npm run typecheck` no arquivo sem erros; page renderiza MetricsCards + ExpiringTenantsList + TenantTable

- [x] T22 Adicionar utilitários de formatação ao TenantTable
  - Service: frontend
  - Files: `components/admin/tenant-table.tsx`
  - Deps: T20
  - Verify: `formatRevenue(1000)` → "R$ 10,00"; `formatDate(null)` → "nunca" (verificação manual ou inline test)

## Acceptance Checklist

- [x] `requireFounder()` lança `UnauthorizedError` quando sessão ausente (RF01)
- [x] `requireFounder()` lança `UnauthorizedError` quando `is_founder = false` (RF01)
- [x] `requireFounder()` resolve com `{ userId }` quando `is_founder = true` (RF01)
- [x] `GET /admin` sem founder redireciona para `/` — não expõe a existência da rota (RF02, RF03)
- [x] `GET /admin` sem sessão redireciona para `/` (RF02, RF03)
- [x] `GET /admin` com founder válido retorna 200 (RF02)
- [x] `releaseSubscriptionAction` chama `requireFounder()` antes de qualquer query (RF02)
- [x] `suspendTenantAction` chama `requireFounder()` antes de qualquer query (RF02)
- [x] `releaseFromSuspensionAction` chama `requireFounder()` antes de qualquer query (RF02)
- [x] `AppSidebar` não exibe link `/admin` quando `isFounder={false}` (RF04)
- [x] `AppSidebar` exibe link `/admin` quando `isFounder={true}` (RF04)
- [x] Link "Admin" possui ícone Shield e posição após bloco NAV_SECONDARY (RF05)
- [x] `listAllTenantsWithStats()` retorna todos os tenants via owner connection sem filtro RLS (RF06)
- [x] Status derivado de `suspended_at IS NOT NULL` resulta em `'travada'` (RF06)
- [x] `MetricsCards` exibe contagens corretas por status (testando / ativa / travada) (RF06)
- [x] `getExpiringTenants(3)` inclui tenants com `valid_until BETWEEN NOW() AND NOW()+3d` e `suspended_at IS NULL` (RF07)
- [x] `getExpiringTenants(3)` exclui tenants com vencimento além de 3 dias (RF07)
- [x] `getExpiringTenants(3)` exclui tenants suspensos mesmo com vencimento próximo (RF07)
- [x] `getExpiringTenants(3)` ordena por `valid_until` ASC (RF07)
- [x] `listAllTenantsWithStats()` soma `sales.total_cents` apenas do mês corrente; retorna 0 sem vendas (RF08)
- [x] `listAllTenantsWithStats()` retorna `last_activity_at = MAX(created_at)` entre sales e stock_movements; nulo se sem operação (RF09)
- [ ] Performance: dashboard com ≥10 lojas carrega em menos de 2s (RNF01)
- [x] `TenantTable` exibe colunas nome, badge de estado, valid_until, faturamento/mês, último acesso e botões de ação (RF10)
- [x] `TenantStatusBadge` exibe azul para `testando`, verde para `ativa`, vermelho para `travada` (RF11)
- [x] `TenantTable` ordena por padrão: travadas primeiro, depois por `valid_until` ASC (RF12)
- [x] `releaseSubscriptionAction` calcula `new_valid_until = GREATEST(valid_until, NOW()) + 30 dias` (RF13, RN01)
- [x] Quando `valid_until` é futuro, `new_valid_until` acumula a partir do futuro, não de hoje (RN01)
- [x] Quando `valid_until` é passado, `new_valid_until ≈ NOW() + 30 dias` (RN01)
- [x] `releaseSubscriptionAction` atualiza `valid_until` e zera `suspended_at = NULL` em transação atômica (RF14)
- [x] `releaseSubscriptionAction` insere `subscription_log(action='renewed', valid_until_before, valid_until_after, by_user_id)` (RF15)
- [x] `revalidatePath('/admin')` chamado em cada action — UI reflete estado novo imediatamente (RF16)
- [x] `ReleaseDialog` exibe `new_valid_until` calculado e nome da loja antes de confirmar (RF16a)
- [x] `ReleaseDialog` não chama `releaseSubscriptionAction` antes do click em confirmar (RF16a)
- [x] `suspendTenantAction` seta `suspended_at = NOW()` (RF17)
- [x] `suspendTenantAction` insere `subscription_log(action='suspended', by_user_id)` (RF18)
- [x] `SuspendDialog` abre antes de chamar `suspendTenantAction` (RF19)
- [x] Botão de confirmação do `SuspendDialog` é destrutivo (vermelho / variante destructive) (RF19)
- [x] `suspendTenantAction` força `suspended_at IS NOT NULL` independente do estado atual (RN02)
- [x] `releaseFromSuspensionAction` zera `suspended_at = NULL` sem dialog de confirmação (RF20, RN03)
- [x] `releaseFromSuspensionAction` não altera `valid_until` (RF20, RN03)
- [x] Loja com `valid_until` vencido permanece `travada` após `releaseFromSuspensionAction` (RN03)
- [x] `releaseFromSuspensionAction` insere `subscription_log(action='released', by_user_id)` (RF21)
- [x] `getTenantSubscriptionHistory(tenantId)` retorna entradas do `subscription_log` ordenadas por `at` DESC (RF22)
- [x] `SubscriptionHistoryModal` exibe action badge, valid_until_before, valid_until_after e data/hora (RF22)
- [x] `SubscriptionHistoryModal` não busca dados antes de `open = true` (lazy fetch) (RF22)

## Validation Gates

- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
