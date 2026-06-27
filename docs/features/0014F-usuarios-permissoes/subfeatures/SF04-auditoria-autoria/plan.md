---
id: 0014F
type: feature-plan
slug: sf04-auditoria-autoria-plan
related: [0014F]
created: 2026-06-26
updated: 2026-06-26
---

## TL;DR

Tela read-only "Auditoria" (`app/(app)/auditoria/`) que agrega atividade por operador num período: vendas (qtd + Σ `total_cents`), caixas abertos/fechados, comandas abertas/fechadas/canceladas, movimentações de estoque e de caixa. Reusa as colunas de autoria que JÁ existem (`sales.userId`, `cash_sessions.openedBy/closedBy`, `comandas.openedBy/closedBy`, `stock_movements.userId`, `cash_movements.userId`) — zero retrofit, nenhuma coluna nova. A agregação roda num serviço novo na conexão **owner `db`** com filtro explícito `tenant_id = ctx.tenantId`, gated por `requirePermission(ctx, 'gerenciar_usuarios')` (SF01) na action. Consome `override_log` (SF02) só se a tabela existir (`to_regclass`), degradando sem erro.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)

## Context

As colunas de autoria já gravam o autor em todas as tabelas, mas nenhuma tela lê ([about.md](about.md)). Este plano entrega a leitura: um relatório agregado por operador/período, espelhando a página de lucro (`app/(app)/lucro/page.tsx` `force-dynamic` RSC → action → serviço `withUserRls`; agregação SQL em `profit-data.ts:32`). **Depende de SF01** (`requirePermission`/`hasPermission` em `lib/auth/permissions.ts`; `is_active` em `tenant_members` preserva o registro do operador desativado). **Consome opcionalmente SF02** (`override_log` da migração `0011`). Nome do operador vem de `users.name` (coluna nullable adicionada por SF01) com fallback para `users.email` quando nulo (ex.: o owner, cadastrado no signup sem nome).

## Architecture Decisions

| Decision | Rationale | Alternative rejected | Triggering constraint |
|---|---|---|---|
| Reusar colunas de autoria existentes; SF04 adiciona ZERO colunas | Já gravadas em sales/cash_sessions/comandas/stock_movements/cash_movements (confirmado no schema) | Tabela de eventos de auditoria — duplica o que já existe | RN01; about.md proíbe colunas de autor |
| Agregação inteira na conexão **owner `db`** com `tenant_id = ctx.tenantId` explícito, gated por `requirePermission` na action | Nomes vêm de `tenant_members` (JOIN `users`), cuja RLS é NÃO-recursiva (`user_id = current_app_user()`) → sob `withUserRls` os nomes dos OUTROS operadores somem; uma única conexão evita 2 queries em contextos distintos | (a) `withUserRls` só p/ business tables (a `tenant_isolation` retornaria todas as linhas do tenant) + lookup de nome no `db` owner — 2 conexões, mais código; (b) reescrever a policy de `tenant_members` — quebra isolamento testado | RNF01; `db/migrations/0001_rls.sql` policy não-recursiva; espelha SF01/SF02 cross-member no `db` |
| LEFT JOIN `tenant_members`→`users` (não INNER) | Operador desativado (`is_active=false`, registro preservado por SF01) ainda precisa do nome; órfão eventual não some do relatório | INNER JOIN — esconde operador desativado/removido, viola RF04 | RF04; SF01 preserva a linha |
| Owner atribuído distintamente do operador | `tenant_members.role='owner'` rotula a linha do dono; ações com `userId`/`openedBy` = id do owner agrupam sob o owner | Agrupar todos como "operador" — RN02 exige distinção | RN02; `role` em `tenant_members.role` |
| Consumo de `override_log` guardado por `to_regclass('public.override_log')` (try/catch de fallback) | SF04 é independente de SF02; tabela ausente → seção omitida sem erro; presente e vazia → seção vazia | Acoplar SF04 a SF02 (assumir a tabela) — quebra a independência; quebra build se SF02 não entregou | RF05; about.md "degradação graciosa" |
| Sem export CSV/PDF, sem realtime, sem drill-down no MVP | Poucas lojas; tela consultiva basta | Export/realtime — esforço sem demanda | about.md Does NOT Include |

## Tasks

- [ ] test: serviço de auditoria (agregação por operador, owner-vs-operador, nome de desativado, override_log ausente/presente) — `npm test` verde com Docker
- [ ] backend: zod do filtro (operador opcional + from/to + atalho "hoje"/"turno atual") em `lib/validation/auditoria.ts` — datas inválidas caem no default (padrão `profitFilterSchema`)
- [ ] backend: data layer agregando as 5 tabelas + LEFT JOIN nome + detecção `override_log` em `lib/services/audit/audit-data.ts` — uma query por métrica, filtro `tenant_id` explícito, executor `db`
- [ ] backend: `getAuditByPeriod(ctx, filter)` em `lib/services/audit/audit-service.ts` na conexão `db` owner; monta DTO por operador + seção de overrides condicional — totais batem com linhas brutas
- [ ] backend: `getAuditAction` em `app/(app)/auditoria/actions.ts` — `requireAuthContext`→`requirePermission(ctx,'gerenciar_usuarios')`→serviço; sem o código lança UnauthorizedError
- [ ] frontend: página `app/(app)/auditoria/page.tsx` (`force-dynamic` RSC) + `AuditoriaClient.tsx` (filtro operador/período, tabela por operador, seção de overrides quando presente) — fluxo completo no browser
- [ ] frontend: item "Auditoria" no `AppSidebar` visível só com `gerenciar_usuarios`/owner — item some sem permissão

`{"files":{"create":["lib/validation/auditoria.ts","lib/services/audit/audit-service.ts","lib/services/audit/audit-data.ts","lib/services/audit/audit-service.test.ts","app/(app)/auditoria/page.tsx","app/(app)/auditoria/actions.ts","app/(app)/auditoria/AuditoriaClient.tsx","types/audit.ts"],"modify":["components/layout/AppSidebar.tsx"]}}`

> Sem tarefa de database: os índices `(tenant_id, created_at)`/`(tenant_id, opened_at)` exigidos pela RNF01 JÁ existem em todas as 5 tabelas (`sales_tenant_created_idx`, `cash_sessions_tenant_opened_at_idx`, `comandas_tenant_opened_at_idx`/`comandas_tenant_status_idx`, `stock_movements_tenant_*_idx`, `cash_movements_tenant_created_idx`). `override_log` é criado pela migração `0011` de SF02 — SF04 não cria schema.

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| Agregação de 6 contagens em 5 tabelas por período estoura 2s (RNF01) | Média | Médio | Cada métrica filtra por `tenant_id` + faixa de data usando os índices existentes; `GROUP BY userId/openedBy/closedBy`; sem N+1 (1 query por métrica, não por operador); medir no período típico |
| Nome do operador desativado não resolve (RLS não-recursiva esconde a linha) | Alta | Alto | Agregação inteira no `db` owner com `tenant_id = ctx.tenantId`; LEFT JOIN `tenant_members`→`users`; teste cobre operador `is_active=false` ainda nomeado |
| `override_log` ausente (SF02 não entregue) quebra a query/seção | Alta | Médio | `to_regclass('public.override_log')` antes do SELECT (try/catch de fallback); ausente → seção omitida; presente+vazia → seção vazia; teste cobre ambos |
| Atribuição owner vs operador trocada (RN02) | Média | Alto | `role` de `tenant_members` rotula cada linha; owner agrupa separado; teste com venda do owner + venda do operador confere os 2 grupos |
| Vazamento entre tenants pela conexão owner (bypassa RLS) | Baixa | Alto | TODA query do data layer carrega `eq(table.tenantId, ctx.tenantId)` explícito (padrão `cash-session-data.ts`); teste cross-tenant retorna só o tenant do ctx |
| `gerenciar_usuarios` não barrar a tela (RF03) | Baixa | Alto | Gate na action ANTES do serviço (padrão SF01); página não tem outra entrada; check manual com operador sem o código |

## Validation

Gates (todos exit 0): `npm run typecheck`, `npm run lint`, `npm test` (Vitest; testes de DB — agregação, nome de desativado, override — exigem Docker Postgres + `.env.local`; sem isso são pulados), `npm run build`. SF04 não cria migração; nenhum `db:push`/`db:rls` novo.

Checks manuais:
- Totais por operador (qtd/Σ vendas, caixas, comandas, movimentações) batem com as linhas brutas do período (RF01).
- Operador desativado (`is_active=false`) ainda aparece nomeado no relatório (RF04).
- Seção de overrides aparece só se `override_log` existir; ausente → sem seção e sem erro; presente+sem linhas → seção vazia (RF05).
- Operador sem `gerenciar_usuarios` não abre a tela (action lança `UnauthorizedError`) (RF03).
- Venda/ação do owner aparece atribuída ao owner, distinta dos operadores (RN02).
