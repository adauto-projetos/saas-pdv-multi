---
id: 0014F
type: feature-plan
slug: sf03-limite-operadores-plan
related: [0014F]
created: 2026-06-26
updated: 2026-06-26
---

## TL;DR

Adiciona `max_operators integer not null default 3` no singleton `platform_settings`, expõe a edição no painel super admin (server action gated por `requireFounder()`, espelhando `updatePlanPriceAction`/`PlanPriceSettings`), e pluga uma checagem de teto no `createOperator` de SF01: conta operadores ativos (`role='operator'` AND `is_active=true`) na MESMA transação do insert, na conexão owner `db`, e bloqueia se a contagem ≥ `max_operators`. Owner não conta; desativado não conta (libera slot); baixar o limite não desativa ninguém (grandfather). A tela "Usuários" ganha "X de N operadores". Depende de SF01.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Tasks](#tasks)
- [Risks](#risks)
- [Validation](#validation)

## Context

Hoje `platform_settings` guarda só `monthlyPriceCents` (singleton, sem `tenant_id`, FORA da RLS — acessado via owner `db` e protegido por `requireFounder()`), e o cadastro de operador de SF01 não consulta teto algum ([about.md](about.md)). Esta SF fecha a alavanca de receita: um campo global de teto, editável sem deploy, e o bloqueio no cadastro. **Depende de SF01** — reaproveita `createOperator` (`lib/services/users/operator-service.ts`, conexão owner `db`, task SF01-T11), a tela `app/(app)/usuarios/` (SF01-T15) e o catálogo já existente do super admin. A contagem precisa rodar na conexão owner porque a RLS de `tenant_members` é não-recursiva (`user_id = current_app_user()`): um usuário só enxerga o próprio vínculo, então `withUserRls` contaria 1.

## Architecture Decisions

| Decision | Rationale | Alternative rejected | Triggering constraint |
|---|---|---|---|
| Teto em `platform_settings.max_operators` (não hardcoded) | Founder edita sem deploy; vira gancho de receita | Número fixo no código — dívida para amarrar no plano depois | RF01/RF02 |
| Campo global (uma linha singleton), não por plano | Existe um único plano; o campo já serve quando surgirem tiers | Modelar `plan_settings` por tier agora — complexidade sem necessidade | RN01; `platform_settings` é singleton |
| Contagem na conexão owner `db`, dentro do `createOperator` de SF01 | RLS de `tenant_members` é não-recursiva (só o próprio vínculo); `withUserRls` contaria 1. `createOperator` já roda em `db` (SF01) | Reescrever a policy para subquery por tenant — quebra isolamento testado | RNF01; padrão SF01 (operator-service em `db`) |
| Contagem + insert na MESMA `db.transaction` | Atômico contra concorrência: dois cadastros simultâneos não passam do teto | `COUNT` e `INSERT` soltos — janela de corrida deixa exceder | RNF01 |
| Baixar o limite NÃO desativa ninguém (grandfather) | Reduzir `max_operators` só barra novos cadastros; previsível, sem efeito retroativo | Auto-desativar excedentes — destrói acesso de funcionário ativo | RN04 |
| Contagem filtra `role='operator'` AND `is_active=true` | Owner é o dono (não funcionário); desativado liberou o slot | Contar owner / contar inativos — reduz valor do plano, slot preso | RN02/RN03 |

## Tasks

- [ ] database: `max_operators integer not null default 3` em `platform_settings` (schema Drizzle) — `db:push` sobe sem erro; coluna criada com default 3
- [ ] backend: `getMaxOperators()`/`setMaxOperators(max, byUserId)` em `settings-repository.ts` (owner `db`, upsert na linha singleton, espelha `getMonthlyPlanPriceCents`/`setMonthlyPlanPriceCents`) — typecheck verde
- [ ] backend: `maxOperatorsSchema` (int ≥ 1, teto sanidade) em `lib/validation/platform.ts` — valor < 1 rejeitado
- [ ] backend: `updateMaxOperatorsAction(max)` em `app/(admin)/superadmin/actions.ts` (gated por `requireFounder()`, valida, chama `setMaxOperators`, `revalidatePath("/superadmin")`) — espelha `updatePlanPriceAction`
- [ ] backend: contagem de operadores ativos + gate no `createOperator` de SF01 — na MESMA `db.transaction` (owner): se `count(role='operator' AND is_active=true) >= max_operators`, lança erro com o limite atual; senão insere
- [ ] frontend: campo de `max_operators` no painel super admin (`page.tsx` passa `getMaxOperators()`; novo componente espelha `PlanPriceSettings`) — founder edita e salva sem deploy
- [ ] frontend: indicador "X de N operadores" na tela "Usuários" (SF01) — contagem ativa vs `max_operators`
- [ ] test: enforcement (count≥max bloqueia; owner/desativado fora; grandfather) + settings get/set — `npm test` verde com Docker

`{"files":{"create":["lib/services/platform/settings-repository.max-operators.test.ts","components/admin/max-operators-settings.tsx"],"modify":["db/schema/platform-settings.ts","lib/services/platform/settings-repository.ts","lib/validation/platform.ts","app/(admin)/superadmin/actions.ts","app/(admin)/superadmin/page.tsx","lib/services/users/operator-service.ts","lib/services/users/operator-service.test.ts","app/(app)/usuarios/page.tsx","app/(app)/usuarios/actions.ts","app/(app)/usuarios/UsuariosClient.tsx"]}}`

> `operator-service.ts`/`.test.ts`, `usuarios/*` são arquivos de SF01 que esta SF MODIFICA (não cria).

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| Corrida count→insert deixa exceder o teto sob concorrência (RNF01) | Média | Alto | Contagem e insert na MESMA `db.transaction` da conexão owner; teste de borda count==max-1 |
| SF01 ainda não implementado — `createOperator`/`usuarios/` não existem | Média | Alto | Ordem do epic: SF01 antes de SF03; tarefas referenciam tasks SF01-T11 (serviço) e SF01-T15 (tela) como pré-requisito |
| Contagem via `withUserRls` retornaria 1 (RLS não-recursiva de `tenant_members`) | Média | Alto | Rodar a contagem na conexão owner `db`, dentro do fluxo `createOperator` que SF01 já roda em `db` |
| `drizzle-kit push` derruba RLS policies do banco | Alta | Médio | `platform_settings` não tem RLS, mas `db:push` afeta o DB todo — sempre `npm run db:setup` (push + rls) ou `db:rls` após push avulso |
| Baixar `max_operators` interpretado como desativação retroativa | Baixa | Médio | Gate só na criação (grandfather, RN04); nenhum caminho desativa por contagem; teste cobre count > max sem efeito |

## Validation

Gates (todos exit 0): `npm run typecheck`, `npm run lint`, `npm test` (Vitest; testes de DB exigem Docker Postgres + `.env.local`, senão pulados), `npm run build`. Após qualquer `db:push`, rodar `npm run db:rls` (ou `db:setup`).

Checks manuais:
- Loja com `max_operators=3` e 3 operadores ativos: 4º cadastro é bloqueado com mensagem citando o limite (RF03/RF04).
- Owner não entra na contagem — loja só com owner cadastra até 3 operadores (RN02).
- Desativar um operador (SF01) libera slot: cadastro volta a passar (RN03).
- Baixar `max_operators` para abaixo da contagem atual não desativa ninguém; só barra novos (RN04).
- Painel super admin edita `max_operators` e o efeito vale na hora (sem deploy), gated por `requireFounder()` (RF02).
- Tela "Usuários" mostra "X de N operadores" coerente com a contagem ativa e o teto (RF05).
