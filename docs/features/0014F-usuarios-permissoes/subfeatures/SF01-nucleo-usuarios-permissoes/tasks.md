# Tasks: SF01 — Núcleo Usuários + Permissões

## Metadata
| Field | Value |
|-------|-------|
| Complexity | COMPLEX |
| Total tasks | 17 |
| Services | database, backend, frontend, test |

## Requirements Coverage
- [x] RF01 — Migração adiciona `tenant_members.is_active boolean not null default true`
- [x] RF02 — Tabela `user_permissions` (tenant_id, user_id, permission_code, granted_by, created_at) UNIQUE (tenant_id, user_id, permission_code)
- [x] RF03 — Administrador cria operador (nome, email, senha provisória, ≥1 permissão) com `role='operator'`, `is_active=true`
- [x] RF04 — Email do operador é único por tenant
- [x] RF05 — Criação grava permissões marcadas em `user_permissions` com `granted_by = <criador>`
- [x] RF06 — Presets aplicam conjunto pré-definido marcável/desmarcável antes de salvar
- [x] RF07 — Operador loga pela mesma rota/fluxo do dono (email+senha → cookie)
- [x] RF08 — Operador troca a própria senha em "Meu perfil"; Administrador pode resetar para nova provisória
- [x] RF09 — `requirePermission(ctx, code)` lança erro se sem permissão; owner sempre autorizado
- [x] RF10 — Cada action de módulo protegido chama `requirePermission` com o código correspondente
- [x] RF11 — `AppSidebar` renderiza só itens cujo código o usuário possui (owner vê todos)
- [x] RF12 — Tentativa de editar/desativar o `owner` é bloqueada por qualquer usuário
- [x] RF13 — Concedente só marca códigos que ele próprio possui (owner concede qualquer um)
- [x] RF14 — Desativar operador seta `is_active=false`; registro e autoria preservados
- [x] RF15 — Request de operador desativado é rejeitado na resolução da sessão
- [x] RF16 — Reativar operador seta `is_active=true`; permissões preservadas
- [x] RN01 — Códigos restritos ao catálogo de 8; valor fora é rejeitado na validação (zod)
- [x] RN02 — Cadastro sem nenhuma permissão é bloqueado
- [x] RN03 — Senha provisória gravada com bcrypt (sem texto puro)
- [x] RN04 — Operador desativado não consegue logar nem manter sessão
- [x] RN05 — Operador não pode desativar a si mesmo nem se conceder `gerenciar_usuarios` sem tê-lo
- [x] RNF01 — `user_permissions` tem RLS: leitura/escrita filtradas pelo tenant da sessão
- [x] RNF02 — Checagem de permissão é defesa em profundidade (action + menu + RLS)

## TDD
- [x] T-TEST-01 catálogo zod rejeita código fora dos 8; presets retornam o conjunto certo — `lib/validation/usuarios.test.ts`
- [x] T-TEST-02 `requirePermission`: owner passa sempre; operador sem código lança; com código passa — `lib/auth/permissions.test.ts`
- [x] T-TEST-03 anti-escalonamento + hierarquia: owner intocável, sem auto-desativar, sem conceder código não-possuído, ≥1 permissão, sessão de operador desativado rejeitada — `lib/services/users/operator-service.test.ts`
- [x] T-TEST-04 RLS `user_permissions`: tenant A não vê linhas do tenant B — `db/__tests__/usuarios-rls.test.ts`

## Execution
- [x] T01 Testes de contrato do catálogo/zod (falham primeiro)
  - Service: test
  - Files: `lib/validation/usuarios.test.ts`
  - Deps: -
  - Verify: `npm test -- usuarios.test` (vermelho: símbolos ainda não existem)
- [x] T02 Testes de contrato do guard `requirePermission`
  - Service: test
  - Files: `lib/auth/permissions.test.ts`
  - Deps: -
  - Verify: `npm test -- permissions.test` (vermelho)
- [x] T03 Testes de anti-escalonamento/sessão do operator-service
  - Service: test
  - Files: `lib/services/users/operator-service.test.ts`
  - Deps: -
  - Verify: `npm test -- operator-service.test` (vermelho)
- [x] T04 Teste de isolamento RLS de `user_permissions` + extensão do seed
  - Service: test
  - Files: `db/__tests__/usuarios-rls.test.ts`, `db/__tests__/seed.ts`
  - Deps: -
  - Verify: `npm test -- usuarios-rls` (vermelho/skip sem DB)
- [x] T05 Schema: `is_active` (tenant_members), `name` nullable (users), tabela `user_permissions`
  - Service: database
  - Files: `db/schema/tenant-members.ts`, `db/schema/users.ts`, `db/schema/user-permissions.ts`
  - Deps: -
  - Verify: `npm run db:push` (sobe sem erro; colunas/tabela criadas + export em `db/schema/index.ts`)
- [x] T06 RLS de `user_permissions` (tenant_isolation, padrão das business tables)
  - Service: database
  - Files: `db/migrations/0010_usuarios_rls.sql`
  - Deps: T05
  - Verify: `npm run db:rls` aplica; `npm test -- usuarios-rls` verde (com Docker)
- [x] T07 Catálogo das 8 permissões + zod + presets (Caixa, Gerente)
  - Service: backend
  - Files: `lib/validation/usuarios.ts`
  - Deps: T01
  - Verify: `npm test -- usuarios.test` verde
- [x] T08 Guard `requirePermission`/`hasPermission` (owner implícito)
  - Service: backend
  - Files: `lib/auth/permissions.ts`
  - Deps: T02, T05
  - Verify: `npm test -- permissions.test` verde
- [x] T09 Data layer de operador + permissões (queries owner db / withUserRls)
  - Service: backend
  - Files: `lib/services/users/operator-data.ts`, `lib/services/permissions/permission-data.ts`
  - Deps: T05
  - Verify: `npm run typecheck`
- [x] T10 Serviço de permissões (grant/revoke/list) com anti-escalonamento
  - Service: backend
  - Files: `lib/services/permissions/permission-service.ts`
  - Deps: T07, T09
  - Verify: `npm test -- operator-service.test` (parte de permissões)
- [x] T11 Serviço de operador (criar/editar/listar/desativar/reativar/reset senha)
  - Service: backend
  - Files: `lib/services/users/operator-service.ts`
  - Deps: T07, T09, T10
  - Verify: `npm test -- operator-service.test` verde
- [x] T12 Barrar `is_active=false` na resolução de sessão
  - Service: backend
  - Files: `lib/services/tenants/onboarding.ts`, `lib/auth.ts`
  - Deps: T05
  - Verify: `npm test -- operator-service.test` (caso de sessão rejeitada) verde
- [x] T13 `requirePermission` nas actions vendas+comanda+caixa
  - Service: backend
  - Files: `app/(app)/caixa/actions.ts`, `app/(app)/comandas/actions.ts`, `app/(app)/lucro/actions.ts`
  - Deps: T08
  - Verify: `npm run typecheck`; `finalizeSaleAction` (vendas), ações de comanda, `open/closeCashSessionAction` (caixa) lançam sem o código
- [x] T14 `requirePermission` nas actions produtos+estoque+loja
  - Service: backend
  - Files: `app/(app)/products/actions.ts`, `app/(app)/estoque/actions.ts`, `app/(app)/settings/actions.ts`
  - Deps: T08
  - Verify: `npm run typecheck`; action lança sem o código (revisão manual)
- [x] T15 `requirePermission` nas actions financeiro (contas/fluxo)
  - Service: backend
  - Files: `app/(app)/financeiro/caixa/actions.ts`, `app/(app)/financeiro/pagar/actions.ts`, `app/(app)/financeiro/receber/actions.ts`
  - Deps: T08
  - Verify: `npm run typecheck`; ações de contas/fluxo lançam sem `financeiro`
- [x] T16 Tela "Usuários" + actions (lista, criar c/ presets, editar nome/email, editar permissões, ativar/desativar, reset)
  - Service: frontend
  - Files: `app/(app)/usuarios/page.tsx`, `app/(app)/usuarios/actions.ts`, `app/(app)/usuarios/UsuariosClient.tsx`
  - Deps: T11
  - Verify: `npm run dev` → criar/editar/desativar operador no browser; action de tela gated por `gerenciar_usuarios`
- [x] T17 Filtrar `AppSidebar`/`BottomNav` por permissão (owner vê tudo)
  - Service: frontend
  - Files: `components/layout/AppSidebar.tsx`, `app/(app)/layout.tsx`, `components/layout/BottomNav.tsx`
  - Deps: T08
  - Verify: `npm run dev` → operador sem `produtos` não vê o item "Produtos"

## Acceptance Checklist
- [x] `tenant_members.is_active boolean not null default true` existe após migração (RF01)
- [x] `user_permissions(tenant_id, user_id, permission_code, granted_by, created_at)` com UNIQUE (tenant_id, user_id, permission_code); sem coluna `granted`/`is_active` (RF02)
- [x] `createOperatorAction` grava `users.name`+email e cria `tenant_members` `role='operator'`, `is_active=true` com ≥1 permissão (RF03, RN02)
- [x] Email duplicado no mesmo tenant é rejeitado na criação (RF04)
- [x] Permissões marcadas viram linhas em `user_permissions` com `granted_by = ctx.userId` (RF05)
- [x] Presets "Caixa" (vendas+comanda) e "Gerente" (tudo menos loja) pré-marcam e são editáveis (RF06)
- [x] Operador loga via `loginAction` existente (email+senha+cookie) (RF07)
- [x] `changeOwnPasswordAction` (Meu perfil) e `resetOperatorPasswordAction` (owner) gravam bcrypt (RF08, RN03)
- [x] `requirePermission(ctx, code)` lança UnauthorizedError sem permissão; owner sempre passa (RF09)
- [x] Cada action de módulo chama `requirePermission` com seu código entre `requireActiveTenant` e o serviço (RF10)
- [x] `AppSidebar` esconde itens sem o código; owner vê todos (RF11)
- [x] `updateOperatorAction`/`deactivateOperatorAction` rejeitam alvo `role='owner'` (RF12)
- [x] `grantPermission` rejeita código que o concedente (não-owner) não possui (RF13)
- [x] `deactivateOperatorAction` seta `is_active=false` sem apagar o registro (RF14)
- [x] `requireAuthContext`/`getUserTenantId` rejeitam usuário `is_active=false` (RF15, RN04)
- [x] `reactivateOperatorAction` seta `is_active=true` mantendo linhas de `user_permissions` (RF16)
- [x] Zod valida `permission_code` contra os 8 códigos; valor fora rejeitado (RN01)
- [x] Operador não pode desativar a si mesmo nem se conceder `gerenciar_usuarios` sem tê-lo (RN05)
- [x] `0010_usuarios_rls.sql` isola `user_permissions` por tenant; teste cross-tenant retorna 0 linhas (RNF01)
- [x] Defesa em profundidade comprovada: action lança E menu esconde para operador sem o código (RNF02)

## Validation Gates
- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
