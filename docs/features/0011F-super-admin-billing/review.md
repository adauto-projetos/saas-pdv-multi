# Review: 0011F — super-admin-billing

> **Data:** 2026-06-25 | **Branch:** feature/0011F-super-admin-billing
> **Revisado por:** /add.review (Opus 4.8) — reviewers paralelos backend/segurança + frontend

## Quality Gate Report

| Gate | Status | Detalhes |
|------|--------|----------|
| Build | ✅ PASSED | `npm run build` — 0 erros, rota `/superadmin` presente, sem proxy/middleware |
| Spec Compliance | ✅ PASSED | SF01/SF02/SF03 — RF/RN cobertos em tasks.md, código existe |
| Code Review Score | ✅ PASSED | 7→9/10 após correções (backend 7, frontend 7; itens críticos resolvidos) |
| Product Validation | ✅ PASSED | Impersonação com defesa em profundidade validada por testes RLS |
| Validation: typecheck | ✅ PASSED | `npm run typecheck` → exit 0 |
| Validation: lint | ✅ PASSED | `npm run lint` → exit 0 (2 warnings pré-existentes em scripts/full-test.mjs) |
| Validation: test | ✅ PASSED | `npm test` → 369 passed (+3 novos BottomNav) |
| Validation: build | ✅ PASSED | `npm run build` → exit 0 |
| **Overall** | **✅ PASSED** | **Pronto para merge** |

## Spec Compliance Audit

SPEC_AUDIT_STATUS = **COMPLIANT**. As 3 subfeatures têm `tasks.md` com `## Requirements Coverage` completo e ticado; implementação verificada (file:line) durante o build. Divergência de doc corrigida: SF02 `about.md` referia `/admin` — atualizado para `/superadmin` (rota real).

## Code Review Summary

### Pontos fortes confirmados
- **Impersonação com defesa em profundidade** (app valida founder via `selectIsFounder` + SQL `current_app_is_founder()`). Cookie forjado por não-founder não concede acesso — provado por teste RLS negativo.
- GUCs sempre `SET LOCAL`/`set_config(..., true)` — escopo de transação, não vazam no pool.
- `requireActiveTenant` chamado antes de `withUserRls` nas actions de escrita; queries cross-tenant 100% sob `requireFounder()`.
- As 16 políticas `tenant_isolation` usam `current_app_tenants()` — nenhuma tabela de negócio ficou de fora.
- Zero `console.log`, `any` ou segredos hardcoded.

### Correções aplicadas (auto-correção)
| # | Severidade | Arquivo | Correção |
|---|---|---|---|
| C2 | ALTO (bug) | actions.ts | `releaseFromSuspensionAction` agora valida existência do tenant antes da transação |
| C3 | MÉDIO | actions.ts | `suspendTenantAction` registra snapshot de `validUntil` no log (auditoria) |
| C1/Q1 | ALTO | subscription-status.ts | Removida `selectHasRenewed` duplicada — módulo agora é puro (I/O fica em repository.ts) |
| R-02 | ALTO (UX) | tenant-table.tsx | Pending por-linha (`pendingId`) — ação numa loja não desabilita as outras |
| U-02 | ALTO (mobile) | tenant-table.tsx | Tabela com `overflowX: auto` + `minWidth` — usável em telas estreitas |
| U-01 | ALTO (mobile) | metrics-cards.tsx | Grid responsivo (`auto-fit minmax`) |
| A-01 | ALTO (a11y) | tenant-table.tsx | `aria-label` contextual + `type="button"` nos 4 botões por linha |
| R-01/A-02 | ALTO (a11y) | ImpersonationBanner.tsx | `type="button"` + `aria-busy` |
| S4 | MÉDIO (segurança) | (admin)/layout.tsx | Layout admin valida `isFounder` (defesa extra além do guard da page) |
| R-05/R-03 | BAIXO | tenant-table.tsx | Remove `border:none` redundante; consolida import do React |
| S-01 | MÉDIO (doc) | SF02/about.md | `/admin` → `/superadmin` |

### Tech debt registrado (não-bloqueante)
- Q-01: telefone WhatsApp hardcoded em 2 banners → extrair constante.
- Q-02: `formatDate` duplicado em 3 componentes → extrair util.
- Q1 (backend): `RawTenantRow` com tipos amplos (necessário por `db.execute` raw) → considerar validação runtime.
- Q2 (backend): `updateTenantValidUntil`/`updateTenantSuspendedAt` no repository não usados (actions usam tx inline).
- S2/K2: comentário do 0008 não menciona que 0009 sobrescreve a policy de `subscription_log` com `current_app_tenants()` (founder impersonando lê o log — comportamento desejado p/ suporte).
- S3: cookie de impersonação dura 30 dias (poderia ser mais curto p/ operação administrativa).
- R-04: `handleSignOut` no BottomNav sem tratamento de erro (logout raramente falha).

## Product Validation

| Subfeature | RF/RN | Status |
|---|---|---|
| SF01 assinatura-lifecycle | trial/ativa/travada + seed founder | ✅ |
| SF02 painel-super-admin | métricas + liberar/suspender/histórico | ✅ |
| SF03 impersonate-loja | enter/exit + RLS gate + banner + mobile | ✅ |

Testes de integração RLS cobrem: founder impersonando lê/escreve a loja-alvo; não-founder com GUC forjada é bloqueado; isolamento entre lojas; regressão das políticas pré-existentes.
