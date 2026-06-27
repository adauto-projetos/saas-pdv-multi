# Tasks: SF02 — Override de Ação Sensível

## Metadata

| Field | Value |
|---|---|
| Feature | 0014F — usuarios-permissoes |
| Subfeature | SF02 — override-acao-sensivel |
| Complexity | STANDARD |
| Services | database, backend, frontend, test |
| Depends on | SF01 (`requirePermission`/`hasPermission`, papéis, `gerenciar_usuarios`, `is_active`) |
| Plan | [plan.md](plan.md) |

## Requirements Coverage

| ID | Título | Coberto por |
|---|---|---|
| RF01 | Falha em ação sensível retorna sinal "override necessário" e UI abre diálogo | T05, T06, T07 |
| RF02 | Diálogo coleta identificação + senha do autorizador, submete com o contexto original | T02, T07 |
| RF03 | Ações sensíveis MVP: `cancelar_comanda`, `remover_item_comanda`, `fechar_caixa` | T02, T05, T06 |
| RF04 | Autorizador validado: mesma loja, ativo, `owner` ou `gerenciar_usuarios` | T03 |
| RF05 | Senha conferida por bcrypt; inválida → erro, ação não executa | T03 |
| RF06 | Senha válida → ação roda na mesma requisição, autoria do operador | T03, T05, T06 |
| RF07 | Override bem-sucedido grava `override_log` (operador, autorizador, ação, alvo) | T01, T03 |
| RF08 | Tentativa com senha inválida não grava log de sucesso | T03 |
| RN01 | Sem estado intermediário; sem senha → nada muda no banco | T03 |
| RN02 | Autorizador não pode ser o próprio operador bloqueado | T03 |
| RNF01 | `override_log` com RLS por tenant; só owner/`gerenciar_usuarios` leem (SF04) | T01 |

> Cobertura: todos os RF/RN têm ≥1 item de Execução/Acceptance e teste correspondente.

## TDD

- [x] T-TEST-01 Autorizador: válido (owner) e válido (`gerenciar_usuarios`) liberam; sem-papel rejeita — `lib/services/permissions/override-service.test.ts` (HAS_DB)
- [x] T-TEST-02 Autorizador self (= operador bloqueado) e desativado (`is_active=false`) rejeitados — `lib/services/permissions/override-service.test.ts` (HAS_DB)
- [x] T-TEST-03 Senha bcrypt: hash certo passa, errado → erro e sinal `{ok:false}` sem `overrideRequired` — `lib/services/permissions/override-service.test.ts` (HAS_DB)
- [x] T-TEST-04 `override_log` grava 1 linha SÓ no sucesso (actor=operador, authorizer=admin, action_code, target_ref); falha → 0 linhas — `lib/services/permissions/override-service.test.ts` (HAS_DB)
- [x] T-TEST-05 Senha inválida não muta o alvo; sem creds retorna `overrideRequired:true` — `lib/services/permissions/override-service.test.ts` (HAS_DB)
- [x] T-TEST-06 RLS de `override_log`: leitura cross-tenant retorna 0 linhas — `db/__tests__/override-rls.test.ts` (HAS_DB)
- [x] T-TEST-07 Zod do creds e do catálogo de ações sensíveis: código fora do catálogo / senha vazia rejeitados — `lib/validation/override.test.ts`

## Execution

- [x] T01 Schema + RLS `override_log`
  - Service: database
  - Files: `db/schema/override-log.ts`, `db/migrations/0011_override_rls.sql`, `db/schema/index.ts`
  - Deps: —
  - Verify: `npm run db:setup` sobe sem erro; T-TEST-06 verde (RNF01)
- [x] T02 Catálogo de ações sensíveis + zod do creds
  - Service: backend
  - Files: `lib/validation/override.ts`, `lib/validation/override.test.ts`
  - Deps: T01
  - Verify: T-TEST-07 verde; código fora do catálogo rejeitado (RF02, RF03)
- [x] T03 Gate `runWithOverride()` + data layer
  - Service: backend
  - Files: `lib/services/permissions/override-service.ts`, `lib/services/permissions/override-data.ts`, `lib/services/permissions/override-service.test.ts`
  - Deps: T01, T02
  - Verify: T-TEST-01..05 verdes; autorizador no `db` owner, log sob `withUserRls` (RF04, RF05, RF06, RF07, RF08, RN01, RN02)
- [x] T04 Estender `ActionResult` com sinal de override
  - Service: backend
  - Files: `lib/services/errors.ts`
  - Deps: T03
  - Verify: `npm run typecheck` verde; failure arm aceita `overrideRequired/actionCode/targetRef` (RF01)
- [x] T05 Ligar actions de comanda ao gate
  - Service: backend
  - Files: `app/(app)/comandas/actions.ts`
  - Deps: T03, T04
  - Verify: operador sem `comanda` → sinal; com creds válidas → cancela/remove e log (RF01, RF03, RF06)
- [x] T06 Ligar fechar-caixa ao gate
  - Service: backend
  - Files: `app/(app)/lucro/actions.ts`
  - Deps: T03, T04
  - Verify: `closeCashSessionAction` sem `caixa` → sinal; creds válidas → fecha e log (RF03, RF06)
- [x] T07 Diálogo de override na UI
  - Service: frontend
  - Files: `components/comandas/OverrideDialog.tsx`, `components/comandas/ComandaCard.tsx`, `components/comandas/ComandaItemPanel.tsx`, `components/financeiro/CloseSessionDialog.tsx`
  - Deps: T05, T06
  - Verify: sinal abre diálogo; reenvia a action original com identificação+senha (RF01, RF02)

## Acceptance Checklist

- [x] Ação sensível bloqueada retorna sinal e a UI abre o diálogo, não um botão morto (RF01)
- [x] Diálogo coleta identificação + senha e reenvia o contexto original (RF02)
- [x] `cancelar_comanda`, `remover_item_comanda` e `fechar_caixa` passam pelo gate (RF03)
- [x] Autorizador inválido (loja errada / inativo / sem papel) é rejeitado (RF04)
- [x] Senha errada → erro, ação não executa (RF05)
- [x] Senha válida → ação roda na mesma requisição, autoria permanece do operador (RF06)
- [x] Override bem-sucedido grava `override_log` com operador, autorizador, ação e alvo (RF07)
- [x] Senha inválida não grava log de sucesso (RF08)
- [x] Sem senha, nada muda no banco — sem estado intermediário (RN01)
- [x] Autorizador não pode ser o próprio operador bloqueado (RN02)
- [x] `override_log` isolado por tenant; só owner/`gerenciar_usuarios` leem (RNF01)

## Validation Gates

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
