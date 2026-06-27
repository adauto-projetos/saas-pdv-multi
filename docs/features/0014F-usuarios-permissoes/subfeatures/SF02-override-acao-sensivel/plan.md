---
id: 0014F
type: feature-plan
slug: sf02-override-acao-sensivel-plan
related: [0014F]
created: 2026-06-26
updated: 2026-06-26
---

## TL;DR

Gate reutilizável de override síncrono para ações sensíveis (`cancelar_comanda`, `remover_item_comanda`, `fechar_caixa`). A action chama `hasPermission(ctx, code)` (SF01); se falta → sem creds do autorizador retorna `{ ok:false, overrideRequired:true, actionCode, targetRef }` (sinal, não throw) e a UI abre o diálogo; com creds valida o autorizador (distinto, mesmo tenant, ativo, `owner`|`gerenciar_usuarios`, senha bcrypt) e, se válido, roda a ação original (autoria = operador) e grava `override_log` na mesma requisição. Autorizador é validado na conexão `db` (owner) — não é o usuário da sessão e a RLS de `tenant_members` é não-recursiva; o `override_log` INSERT vai sob `withUserRls(ctx.userId)`. Depende de SF01.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)

## Context

Com SF01 o botão some sem permissão — trava o balcão num caso legítimo ([about.md](about.md)). Este plano entrega o override: quando `hasPermission` falha numa ação **sensível**, em vez do throw de SF01 a action devolve um sinal "override necessário"; o operador (sem trocar de login) recebe a senha de um Administrador, e a ação roda na hora com rastro. Reusa o gate de SF01 (`lib/auth/permissions.ts`: `requirePermission`/`hasPermission`, owner sempre passa), o bcrypt do login (`lib/auth/password.ts:8` `verifyPassword`), a conexão owner `db` (`db/index.ts`) e o template RLS `current_app_tenants()` (`db/migrations/0009_impersonation_rls.sql:32-39`). SF04 consome `override_log` (degrada se ausente).

## Architecture Decisions

| Decision | Rationale | Alternative rejected | Triggering constraint |
|---|---|---|---|
| Override síncrono na mesma requisição (sem fila) | Resolve no balcão; desativar admin no turno não deixa órfão | Fila de aprovação — estado pendente órfão + complexidade | RF06/about.md "ou libera agora ou não" |
| Autoria fica com o operador; autorizador só no `override_log` | Quem operou foi o operador; admin só liberou a exceção | Atribuir ação ao admin — distorce `closedBy`/`userId` já gravados (RN10 0005F/0006F) | RF06; colunas de autoria preenchidas com `ctx.userId` |
| Sinal `{ok:false, overrideRequired:true, actionCode, targetRef}` em vez de throw — só p/ ações sensíveis | UI precisa distinguir "abrir diálogo" de "bloqueio comum"; não-sensível mantém throw de SF01 | Throw genérico — UI não sabe abrir o diálogo; HTTP 4xx custom — não é o padrão server-action | RF01; `ActionResult` é union em `lib/services/errors.ts:54` |
| Gate único `runWithOverride()` em `lib/services/permissions/override-service.ts`; cada action sensível o chama | Reutilizável p/ futuros desconto/estorno sem reescrever | Inline em cada action — duplica validação/log; helper em `permissions.ts` mistura SF01 puro com lógica de log/bcrypt | about.md "gate reutilizável (decisão)" |
| Autorizador validado na conexão **owner `db`** (`db/index.ts`), não `withUserRls(ctx.userId)` | Autorizador ≠ usuário da sessão; RLS de `tenant_members` é `user_id = current_app_user()` (não-recursiva) → `withUserRls` nunca veria a linha do autorizador | `withUserRls(ctx.userId)` — retorna 0 linhas, todo override falharia; reescrever a policy — quebra isolamento testado | espelha SF01 (`onboarding.ts` cross-member no `db`); `db/migrations/0001_rls.sql` policy não-recursiva |
| `override_log` INSERT sob `withUserRls(ctx.userId)`; ação original mantém seu próprio `withUserRls` | Log é dado per-tenant do ator (usuário da sessão) → RLS por tenant aplica; ação original já encapsula sua tx | INSERT no `db` owner — bypassa RLS sem necessidade (ator É o usuário da sessão) | RNF01; `current_app_tenants()` template |

## Tasks

- [ ] database: schema `override_log` + migração RLS `0011_override_rls.sql` (tenant_isolation via `current_app_tenants()`) — `db:push`+`db:rls` sobem; cross-tenant lê 0 linhas
- [ ] backend: catálogo de ações sensíveis + zod do creds do autorizador (email/identificação + senha) — código fora do catálogo rejeitado
- [ ] backend: `runWithOverride()` em `override-service.ts` — valida autorizador no `db` owner (distinto/mesmo tenant/ativo/owner|`gerenciar_usuarios`/bcrypt), roda ação original, grava `override_log` sob `withUserRls`; sem creds → sinal; senha inválida → erro sem log/mutação
- [ ] backend: estender `ActionResult` (failure arm) com `overrideRequired?/actionCode?/targetRef?` em `lib/services/errors.ts` — typecheck verde
- [ ] backend: ligar `cancelComandaAction`/`removeComandaItemAction` (modificam a chamada inserida por SF01) ao gate `cancelar_comanda`/`remover_item_comanda` — `app/(app)/comandas/actions.ts`
- [ ] backend: ligar `closeCashSessionAction` (modifica a chamada de SF01) ao gate `fechar_caixa` — `app/(app)/lucro/actions.ts`
- [ ] frontend: diálogo de override (identificação+senha) que reenvia a action original com creds — `app/(app)/comandas/*` e `app/(app)/lucro/*`
- [ ] test: validação do autorizador (válido/inválido/self/desativado/sem-papel), bcrypt, log só no sucesso, sem mutação na falha — `npm test` verde com Docker

`{"files":{"create":["db/schema/override-log.ts","db/migrations/0011_override_rls.sql","lib/validation/override.ts","lib/services/permissions/override-service.ts","lib/services/permissions/override-data.ts","lib/services/permissions/override-service.test.ts","lib/validation/override.test.ts","db/__tests__/override-rls.test.ts","components/comandas/OverrideDialog.tsx"],"modify":["db/schema/index.ts","lib/services/errors.ts","app/(app)/comandas/actions.ts","app/(app)/lucro/actions.ts","app/(app)/comandas/ComandasClient.tsx","app/(app)/lucro/LucroClient.tsx","db/__tests__/seed.ts"]}}`

> Nota: `comandas/actions.ts` e `lucro/actions.ts` já recebem `requirePermission(ctx, <code>)` em SF01; SF02 troca essa chamada nas 3 actions sensíveis pelo gate `runWithOverride`. Os nomes dos clients (`ComandasClient`/`LucroClient`) e o diretório do diálogo são confirmados na implementação.

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| Autorizador validado na conexão errada (`withUserRls`) → todo override falha ou (pior) policy frouxa vaza membros de outro tenant | Alta | Alto | Validar no `db` owner com filtro explícito `tenantId = ctx.tenantId` no WHERE; espelha cross-member de SF01; teste cross-tenant retorna 0 |
| Re-executar a ação original após o override (dupla execução / efeito colateral repetido) | Média | Alto | Gate roda a ação UMA vez no ramo válido; sem retry implícito; UI envia creds só após o sinal; cobrir "executa exatamente uma vez" |
| Estado parcial se o override falhar no meio (RN01) | Média | Alto | Ação original e `override_log` em fluxo único; senha conferida ANTES de qualquer mutação; sem creds = nenhum INSERT/UPDATE; teste "senha inválida → DB intacto + sem log" |
| Autorizador desativado/owner-removido durante o turno autoriza | Baixa | Médio | Validação lê `is_active`+role na hora (SF01 `is_active`); sem cache; síncrono não deixa janela |
| Senha ditada por telefone (engenharia social) | Média | Médio | Risco aceito no brainstorm/about.md; `override_log` dá auditoria (SF04); fora do MVP limitar/2FA |
| `drizzle-kit push` derruba RLS | Alta | Alto | `0011_override_rls.sql` é o novo último `*_rls.sql`; sempre `db:setup` (push+rls) ou `db:rls` após push avulso |

## Validation

Gates (todos exit 0): `npm run typecheck`, `npm run lint`, `npm test` (Vitest; testes de DB — RLS, autorizador, bcrypt — exigem Docker Postgres + `.env.local`; sem isso são pulados), `npm run build`. Após qualquer `db:push`, rodar `npm run db:rls` (ou `db:setup`).

Checks manuais:
- Operador sem `comanda` clica "Cancelar" → diálogo de override abre (não botão morto nem erro seco) (RF01).
- Autorizador válido (owner ou `gerenciar_usuarios`, ativo) + senha certa → comanda cancela, `override_log` grava 1 linha com `actor=operador`/`authorizer=admin`, e `comandas.closedBy` permanece o operador (RF06/RF07).
- Senha inválida → ação NÃO executa, nada muda no banco, NENHUMA linha em `override_log` (RF05/RF08/RN01).
- Autorizador = o próprio operador bloqueado → rejeitado (RN02).
- Autorizador desativado (`is_active=false`) → rejeitado (RF04).
- Fechar caixa por operador sem `caixa` segue o mesmo fluxo via `closeCashSessionAction` (RF03).
