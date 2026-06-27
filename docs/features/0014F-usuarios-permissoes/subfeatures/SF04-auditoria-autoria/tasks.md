# Tasks: SF04 — Auditoria de Autoria

## Metadata

| Field | Value |
|---|---|
| Complexity | STANDARD |
| Services | backend, frontend, test |
| Depends on | SF01 (`requirePermission`/`hasPermission`, `is_active`); SF02 (`override_log`, opcional) |
| DB tasks | nenhuma — índices `(tenant_id, created_at/opened_at)` já existem; `override_log` é da migração 0011 (SF02) |

## Requirements Coverage

| ID | Título | Coberto por |
|---|---|---|
| RF01 | Atividade agregada por operador no período (vendas qtd+Σ`total_cents`, caixas abertos/fechados, comandas abertas/fechadas/canceladas, mov. estoque/caixa) | T-TEST-01, T03, T04 |
| RF02 | Filtro por operador e período (from/to; atalho "hoje"/"turno atual") | T02, T06 |
| RF03 | Acesso restrito a `owner` ou `gerenciar_usuarios` via `requirePermission` | T-TEST-02, T05, T07 |
| RF04 | Nome do operador exibido mesmo se `is_active=false` | T-TEST-03, T03, T04 |
| RF05 | Overrides do período se `override_log` existir; omitida sem erro se ausente | T-TEST-04, T03, T04 |
| RNF01 | Queries filtram por tenant, usam índices `tenant_id`/`created_at`, carregam < 2s | T03 |
| RN01 | Usa SÓ colunas de autoria existentes; SF04 não adiciona colunas | T03 |
| RN02 | Ações do `owner` atribuídas ao owner, distintas dos operadores | T-TEST-02, T04 |

## TDD

- [x] T-TEST-01 Agregação por operador (qtd/Σ vendas, caixas, comandas por status, movimentações) bate com linhas brutas — `lib/services/audit/audit-service.test.ts`
- [x] T-TEST-02 Atribuição owner-vs-operador: venda do owner agrupa sob owner, venda do operador sob o operador (RN02) — `lib/services/audit/audit-service.test.ts`
- [x] T-TEST-03 Operador `is_active=false` ainda nomeado no resultado (LEFT JOIN, RF04) — `lib/services/audit/audit-service.test.ts`
- [x] T-TEST-04 `override_log` presente+vazio → seção vazia; presente+linhas → lista (RF05) — `lib/services/audit/audit-service.test.ts`

## Execution

- [x] T01 Testes do serviço de auditoria
  - Service: test
  - Files: `lib/services/audit/audit-service.test.ts`
  - Deps: `db/__tests__/seed.ts` (createTestUser/seedTenant); gate `HAS_DB`
  - Verify: suíte falha (vermelho) sem o serviço; cobre agregação, owner-vs-operador, desativado, override ausente/presente
- [x] T02 Zod do filtro de auditoria
  - Service: backend
  - Files: `lib/validation/auditoria.ts`
  - Deps: padrão `lib/validation/profit.ts:26`
  - Verify: `operatorId` opcional + `from`/`to` opcionais; datas inválidas ignoradas; typecheck verde
- [x] T03 Data layer da agregação + nome + override
  - Service: backend
  - Files: `lib/services/audit/audit-data.ts`, `types/audit.ts`
  - Deps: schema sales/cash_sessions/comandas/stock_movements/cash_movements; `to_regclass`
  - Verify: 1 query por métrica, filtro `eq(tenantId)`, LEFT JOIN `tenant_members`→`users`, GROUP BY autor; usa índices existentes
- [x] T04 Serviço `getAuditByPeriod` na conexão owner `db`
  - Service: backend
  - Files: `lib/services/audit/audit-service.ts`
  - Deps: T02, T03; conexão `db` (`db/index.ts`)
  - Verify: monta DTO por operador (owner rotulado por `role`); seção de overrides só se a tabela existir; T-TEST-01..04 passam
- [x] T05 Action `getAuditAction` gated
  - Service: backend
  - Files: `app/(app)/auditoria/actions.ts`
  - Deps: T04; `requireAuthContext`, `requirePermission` (SF01), `toActionError`
  - Verify: gate `gerenciar_usuarios` antes do serviço; sem o código → `UnauthorizedError`
- [x] T06 Página RSC + client de auditoria
  - Service: frontend
  - Files: `app/(app)/auditoria/page.tsx`, `app/(app)/auditoria/AuditoriaClient.tsx`
  - Deps: T05; padrão `app/(app)/lucro/page.tsx` + `ProfitFilter.tsx`
  - Verify: `force-dynamic`; filtro operador/período; tabela por operador; seção de overrides quando presente
- [x] T07 Item "Auditoria" no menu
  - Service: frontend
  - Files: `components/layout/AppSidebar.tsx`
  - Deps: filtro de permissões do `AppSidebar` (SF01)
  - Verify: item aparece só com `gerenciar_usuarios`/owner; some sem permissão

## Acceptance Checklist

- [x] Atividade agregada por operador no período exibida (vendas qtd+Σ, caixas, comandas por status, movimentações) (RF01)
- [x] Filtro por operador e por período funciona, com atalhos "hoje"/"turno atual" (RF02)
- [x] Tela inacessível a operador sem `owner`/`gerenciar_usuarios` (RF03)
- [x] Operador desativado (`is_active=false`) aparece nomeado (RF04)
- [x] Seção de overrides aparece só com `override_log` presente; ausente → omitida sem erro (RF05)
- [x] Queries filtram por tenant via índices e carregam < 2s no período típico (RNF01)
- [x] Nenhuma coluna de autor adicionada — só colunas existentes usadas (RN01)
- [x] Ações do owner atribuídas ao owner, distintas dos operadores (RN02)

## Validation Gates

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
