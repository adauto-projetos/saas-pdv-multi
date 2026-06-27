# Review: 0014F-usuarios-permissoes

> **Date:** 2026-06-26 | **Branch:** feature/0014F-usuarios-permissoes

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` — 0 errors; rotas `/usuarios`, `/auditoria`, `/perfil` geradas |
| Spec Compliance | ✅ PASSED | Todos RF/RN das 4 subfeatures COMPLIANT; lacuna de UI (editar nome/email — T16) corrigida na revisão |
| Code Review Score | ✅ PASSED | 8.75/10 (backend 9 + frontend 8.5) — threshold ≥ 7 |
| Product Validation | ✅ PASSED | SF01 RF01–RF16 / RN01–RN05 / RNF01–RNF02; SF02/SF03/SF04 RF+RN+RNF todos COMPLIANT |
| Validation Gates | ✅ PASSED | `npm run typecheck` → exit 0 · `npm run lint` → exit 0 (2 warnings pré-existentes em scripts/full-test.mjs) · `npm test` → exit 0 (442 passando) · `npm run build` → exit 0 |
| **Overall** | **✅ PASSED** | **Pronto para merge (`/add.done`)** |

> Reviewed at: 2026-06-26
> Reviewed by: /add.review (reviewers backend + frontend em paralelo)

## Spec Compliance Audit

Auditoria por subfeature (acceptance checklists em `subfeatures/SF0*/tasks.md`, todos `[x]`):

- **SF01 — núcleo:** schema (`user_permissions`, `is_active`, `users.name`) + RLS 0010; `requirePermission`/`hasPermission` (owner implícito); gates em todas as actions de módulo; tela Usuários (CRUD + presets + editar dados/permissões + reset) + Meu perfil; menu filtrado; anti-escalonamento (owner intocável, sem auto-desativar/auto-editar); sessão de operador desativado barrada em `getUserTenantId`. **COMPLIANT.**
- **SF02 — override:** `override_log` + RLS 0011; `runWithOverride` (autorizador validado no `db` owner: ativo, mesmo tenant, owner|`gerenciar_usuarios`, ≠ operador, bcrypt antes de mutar; log só no sucesso); ligado a cancelar comanda/remover item/fechar caixa; `OverrideDialog` na UI. **COMPLIANT.**
- **SF03 — limite:** `platform_settings.max_operators`; painel super admin; gate de contagem + insert na mesma transação com `pg_advisory_xact_lock` por tenant (sem corrida); owner/desativado não contam; grandfather. **COMPLIANT.**
- **SF04 — auditoria:** agregação por operador (vendas/caixas/comandas/movimentações) na conexão owner `db` com filtro `tenant_id` explícito; operador desativado nomeado (LEFT JOIN); owner distinto; seção de overrides com degradação graciosa (`to_regclass`). **COMPLIANT.**

`SPEC_AUDIT_STATUS = COMPLIANT` (sem STALE_TICK, sem RF/RN sem cobertura).

## Code Review Summary

Correções aplicadas automaticamente na revisão:

| Área | file:line | Correção |
|---|---|---|
| Backend | `lib/services/users/operator-service.ts` (createOperator, updateOperator) | Guarda de corrida: unique violation em `users.email` → `ConflictError` legível (espelha `openCashSession`) |
| Backend | `lib/auth/permissions.ts` (requireAnyPermission) | Otimizado para 2 queries (tenant_members + `IN(codes)`), evitando N round-trips |
| Backend | `lib/services/audit/audit-data.ts:232` | Cast de `created_at` robusto (`instanceof Date`) |
| Frontend | `app/(app)/caixa/page.tsx` | `session` = `undefined` (não `null`) quando a action falha — respeita o contrato do botão de turno do `CaixaShell` |
| Frontend | `components/layout/BottomNav.tsx` | Item **Auditoria** adicionado ao drawer mobile (paridade com a sidebar) |
| Frontend | `app/(app)/usuarios/UsuariosClient.tsx` | Lacuna T16 fechada: formulários inline de **Editar dados** (nome/email, via `updateOperatorAction`) e **Resetar senha** (substitui `window.prompt`) |

Itens NÃO corrigidos (decisão de design documentada, não bloqueiam):
- `override_log` é gravado em `withUserRls` separado da ação original (cada ação mantém sua própria transação — decisão do plan SF02). Janela de falha estreita.

## Product Validation

- **RF (todos):** implementados e verificados em file:line pelo reviewer backend — COMPLIANT.
- **RN (todos):** anti-escalonamento, bcrypt, ≥1 permissão, sem auto-desativar/auto-editar, desativado sem sessão — COMPLIANT.
- **RNF:** RLS por tenant (0010/0011 via `current_app_tenants()`), defesa em profundidade (action + menu + RLS), atomicidade do limite (advisory lock) — COMPLIANT.

**Product Status: PASSED.**
