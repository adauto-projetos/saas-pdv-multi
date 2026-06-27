---
id: 0014F
type: feature-plan
slug: sf01-nucleo-usuarios-permissoes-plan
related: [0014F]
created: 2026-06-26
updated: 2026-06-26
---

## TL;DR

Funda o epic: papel `operator` + `is_active` em `tenant_members`, tabela `user_permissions` (presença da linha = concedida) com RLS por tenant, guard `requirePermission(ctx, code)` na camada de action, tela "Usuários" (CRUD + presets + anti-escalonamento) e `AppSidebar` filtrado. Owner tem todas as permissões implícitas; operador desativado é barrado na resolução de sessão (por request). Operações que cruzam membros rodam na conexão `db` (owner) gated pelo guard — a RLS de `tenant_members` é não-recursiva e isola o próprio registro.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)

## Context

Hoje só o dono tem login e nenhuma action checa autorização — delegar = entregar a senha ([about.md](about.md)). Este plano entrega o núcleo: schema de permissões + soft-delete, guard de autorização encaixado entre `requireAuthContext()`/`requireActiveTenant()` e o serviço (padrão de `app/(app)/comandas/actions.ts:46-48`), serviços de operador/permissão, a tela "Usuários" e o filtro de menu. É a fundação de SF02/SF03/SF04.

## Architecture Decisions

| Decision | Rationale | Alternative rejected | Triggering constraint |
|---|---|---|---|
| `requirePermission(ctx, code)` na action, após `requireActiveTenant`, antes do serviço | Padrão já fixo (action autentica→valida tenant→serviço); gate encaixa sem mexer no serviço | Checar no serviço — mistura autorização com regra de negócio | RF09/RF10; ponto confirmado em `comandas/actions.ts:46-48` |
| Presença da linha em `user_permissions` = concedida (sem `granted`/`is_active`) | UNIQUE `(tenant,user,code)` + delete = revogar; sem estado redundante | Coluna `granted boolean` (rascunho do discovery) — 2 fontes de verdade | RF02; about.md proíbe colunas extras |
| Owner com permissões implícitas (nunca gravadas) | Owner é supremo; gravar 8 linhas é redundante e revogável | Gravar linhas do owner — risco de revogar o dono | RF09/RF13; `role='owner'` em `tenant_members.role` |
| CRUD de operador roda na conexão `db` (owner), gated por `requirePermission` no serviço | RLS de `tenant_members` é NÃO-recursiva (`user_id = current_app_user()`): owner não veria outros membros via `withUserRls` | Reescrever a policy para subquery por tenant — quebra isolamento já testado | RNF02; `db/migrations/0001_rls.sql:71-76` |
| RLS de `user_permissions` por tenant (mesma forma das business tables) | Última linha de defesa; `tenant_id IN (SELECT current_app_tenants())` | Policy owner-only via JOIN (rascunho discovery) — leitura própria do operador (menu) precisaria do owner | RNF01; template em `db/migrations/0009_impersonation_rls.sql:83-88` |
| `is_active=false` barrado na resolução de sessão (`getUserTenantId`/`requireAuthContext`) | Desligamento tem efeito imediato, não espera cookie expirar | Esperar expiração do cookie | RF15/RN04; `lib/auth.ts:22`, `onboarding.ts:55-62` |
| Anti-escalonamento no serviço (concedente só concede o que tem; owner intocável; sem auto-desativar) | Regras de hierarquia são lógica de negócio, não SQL | Só RLS — não expressa "código que ele mesmo possui" | RF12/RF13/RN05 |
| Nome do operador em `users.name` (coluna nullable) | RF03 pede "nome" mas `users` só tinha `email`/`password_hash`; nullable porque o owner (signup) não tem nome — exibição cai p/ email | `name` em `tenant_members` — operador é de uma só loja (escopo), duplicaria sem ganho | RF03; `db/schema/users.ts` não tinha coluna de nome |

## Tasks

- [ ] database: schema+migração `is_active` em `tenant_members`, `name` (nullable) em `users` + tabela `user_permissions` (UNIQUE tenant,user,code) — `db:push` + `db:rls` sobem sem erro
- [ ] database: RLS `0010_usuarios_rls.sql` para `user_permissions` (tenant_isolation) — teste RLS cross-tenant retorna 0 linhas
- [ ] backend: catálogo+zod das 8 permissões + presets (Caixa, Gerente) — valor fora do catálogo rejeitado
- [ ] backend: `requirePermission`/`hasPermission` em `lib/auth/permissions.ts` — owner passa sempre; operador sem código lança UnauthorizedError
- [ ] backend: `permission-service` (grant/revoke/list) + `operator-service` (create/update/listar/desativar/reativar/reset senha) com anti-escalonamento — owner intocável, sem auto-desativar, ≥1 permissão
- [ ] backend: barrar `is_active=false` em `getUserTenantId`/`requireAuthContext` — request de operador desativado lança UnauthorizedError
- [ ] backend: inserir `requirePermission(ctx, <code>)` em cada action de módulo (vendas, comanda, caixa, produtos, estoque, financeiro, loja, gerenciar_usuarios) — action lança sem o código
- [ ] frontend: tela "Usuários" `app/(app)/usuarios/` (lista, criar c/ presets, editar dados, editar permissões, ativar/desativar, reset senha) + actions — fluxo completo no browser
- [ ] frontend: filtrar `AppSidebar` por permissões do usuário (owner vê tudo) — item sem permissão some
- [ ] test: contratos (guard, anti-escalonamento, sessão desativada, RLS, catálogo zod) — `npm test` verde com Docker

`{"files":{"create":["db/schema/user-permissions.ts","db/migrations/0010_usuarios_rls.sql","lib/auth/permissions.ts","lib/validation/usuarios.ts","lib/services/users/operator-service.ts","lib/services/users/operator-data.ts","lib/services/permissions/permission-service.ts","lib/services/permissions/permission-data.ts","app/(app)/usuarios/page.tsx","app/(app)/usuarios/actions.ts","app/(app)/usuarios/UsuariosClient.tsx","lib/auth/permissions.test.ts","lib/validation/usuarios.test.ts","lib/services/users/operator-service.test.ts","db/__tests__/usuarios-rls.test.ts"],"modify":["db/schema/tenant-members.ts","db/schema/users.ts","db/schema/index.ts","lib/auth.ts","lib/services/tenants/onboarding.ts","components/layout/AppSidebar.tsx","components/layout/BottomNav.tsx","app/(app)/layout.tsx","app/(app)/comandas/actions.ts","app/(app)/caixa/actions.ts","app/(app)/lucro/actions.ts","app/(app)/products/actions.ts","app/(app)/estoque/actions.ts","app/(app)/financeiro/caixa/actions.ts","app/(app)/financeiro/pagar/actions.ts","app/(app)/financeiro/receber/actions.ts","app/(app)/settings/actions.ts","db/__tests__/seed.ts"]}}`

Mapa permissão→menu/action (gate de RF10 — **corrigido na implementação** para o menu casar com o nome da permissão e proteger Lucro): `{"caixa":"PDV /caixa = selling (finalizeSale/lookup/search) + menu Caixa","vendas":"/vendas histórico (listTodaySales) + menu Vendas","comanda":"app/(app)/comandas/actions.ts + menu Comandas","produtos":"app/(app)/products/actions.ts (create/update/cost); leitura listProducts liberada também p/ caixa (PDV)","estoque":"app/(app)/estoque/actions.ts","financeiro":"app/(app)/financeiro/{caixa,pagar,receber}/actions.ts + Lucro (getProfit — dado sensível) + menus Financeiro/Clientes/Lucro","loja":"app/(app)/settings/actions.ts + menu Configurações","gerenciar_usuarios":"app/(app)/usuarios/actions.ts + Auditoria + menus Usuários/Auditoria"}`. As ações de turno (abrir/fechar caixa, `lucro/actions.ts open/close/getOpenSession`) seguem em `caixa` (operação do registrador).

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| RLS não-recursiva de `tenant_members` bloqueia owner ler/editar outros membros | Alta | Alto | CRUD de operador na conexão `db` (owner) gated por `requirePermission` no serviço — padrão de `onboarding.ts`/superadmin; não tocar a policy não-recursiva |
| Anti-escalonamento: borda owner/auto-promoção/auto-desativar | Média | Alto | Checagens explícitas no serviço (role='owner' intocável; código ⊆ do concedente; `targetId !== ctx.userId`); cobrir cada borda em teste |
| Checagem de `is_active` por request — perf/cobertura | Média | Médio | Fundir no PK lookup de `getUserTenantId` (já 1 query); cobrir actions de leitura E escrita (gate só nas de escrita; sessão barra ambas) |
| `drizzle-kit push` derruba as RLS policies | Alta | Alto | Sempre `npm run db:setup` (push + rls) ou `db:rls` após push avulso; `0010_usuarios_rls.sql` vira o último `*_rls.sql` aplicado |
| Soft-delete: histórico referencia `userId` do operador desativado | Baixa | Médio | Nunca deletar (só `is_active=false`); nome/email permanecem em `users`; listas fazem JOIN tolerante |
| Operador lê permissões do próprio menu via RLS por tenant (vê linhas de outros) | Baixa | Baixo | RLS por tenant é aceitável (RNF01); UI/serviço filtram por `user_id`; gate da action é a defesa real |

## Validation

Gates (todos exit 0): `npm run typecheck`, `npm run lint`, `npm test` (Vitest; testes de DB — RLS, anti-escalonamento, sessão — exigem Docker Postgres + `.env.local`; sem isso são pulados), `npm run build`. Após qualquer `db:push`, rodar `npm run db:rls` (ou usar `db:setup`).

Checks manuais:
- Operador sem `produtos`: item "Produtos" some do menu E `createProductAction`/edição lança UnauthorizedError (defesa em profundidade, RNF02).
- Desativar operador logado em outra aba → próximo request dele é rejeitado na resolução de sessão (não espera o cookie, RF15).
- Não-owner com `gerenciar_usuarios` não consegue editar/desativar o owner (RF12) nem conceder código que não possui nem se auto-promover (RF13/RN05).
- Criar operador sem nenhuma permissão é bloqueado (RN02); presets "Caixa"/"Gerente" pré-marcam e são editáveis (RF06).
