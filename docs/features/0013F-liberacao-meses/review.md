# Review: 0013F — Liberação Flexível de Meses

> **Data:** 2026-06-25 | **Branch:** feature/0013F-liberacao-meses
> **Revisado por:** /add.review (Frontend + Backend reviewers em paralelo) · model: claude-opus-4-8[1m]

## Quality Gate Report

| Gate | Status | Detalhes |
|------|--------|----------|
| Build | ✅ PASSED | `npm run build` — 0 erros |
| Spec Compliance | ✅ PASSED | 9/9 RF/RN da 0013F COMPLIANT (sem stale tick, sem RF/RN descoberto) |
| Code Review Score | ✅ PASSED | 7.75/10 (Frontend 8 + Backend 7.5) — threshold ≥ 7 |
| Product Validation | ✅ PASSED | RF: 5/5, RN: 3/3, RNF: 1/1 |
| Validation Gates | ✅ PASSED | `typecheck`→0 · `lint`→0 · `test`→0 (390 passed) · `build`→0 |
| **Overall** | **✅ PASSED** | **Pronto para merge** |

> Escopo da branch: além da 0013F (liberação de N meses no super admin), entraram 2 melhorias relacionadas sem doc de feature própria — banner de dias de teste para o lojista e preço do plano configurável no painel (exibido no signup). Foram cobertas pela revisão técnica, não pela auditoria de spec (não têm RF/RN próprios).

## Spec Compliance Audit (0013F)

| Req | Status | Local |
|-----|--------|-------|
| RF01 — Campo numérico default 1 | COMPLIANT | `release-dialog.tsx` (`useState<number>(1)`) |
| RF02 — Preview ao vivo | COMPLIANT | `release-dialog.tsx` (`addCalendarMonths` por render) |
| RF03 — Avança N meses de calendário | COMPLIANT | `actions.ts` (`addCalendarMonths(base, months)`) |
| RF04 — Destrava loja suspensa | COMPLIANT | `actions.ts` (`suspendedAt: null`) |
| RF05 — Registra meses + validade + autor | COMPLIANT | `actions.ts` + `subscription_log.months_released` |
| RN01 — Inteiro 1–24 cliente + servidor | COMPLIANT | `validation/subscription.ts` + guard `isValid` |
| RN02 — Meses de calendário + clamp | COMPLIANT | `format/calendar-month.ts` (T49–T53) |
| RN03 — Base = max(validUntil, hoje) | COMPLIANT | `actions.ts` + `release-dialog.tsx` (mesma lógica) |
| RNF01 — Restrito ao founder | COMPLIANT | `actions.ts` (`requireFounder()`) |

**SPEC_AUDIT_STATUS = COMPLIANT** (100% dos itens da Acceptance Checklist `[x]`).

## Code Review Summary

### Achados corrigidos durante a revisão

| # | Sev | Arquivo | Problema | Correção |
|---|-----|---------|----------|----------|
| 1 | MEDIUM | `components/admin/tenant-table.tsx` | `isPending` global gerava "loading falso" no diálogo de outra loja | Escopado com `pendingId === activeTenant.id` (Release + Suspend) |
| 2 | MEDIUM | `db/schema/platform-settings.ts` | Singleton só garantido na aplicação | Adicionado `CHECK (singleton = true)` no DDL |
| 3 | MEDIUM | `lib/services/platform/settings-repository.ts` | Leitura sem filtro explícito da linha singleton | `where(singleton = true)` na leitura |
| 4 | LOW | `lib/validation/subscription.ts` | Comentário impreciso sobre `.int()`/`.finite()` | Comentário corrigido |
| 5 | LOW | `components/admin/tenant-table.test.tsx` | Mocks faltando (`deleteTenantAction`, `enterStoreAction`) | Mocks adicionados |

### Achados avaliados e mantidos (com justificativa)

| Sev | Achado | Decisão |
|-----|--------|---------|
| HIGH | `safeParse` antes de `requireFounder` nas actions | **Mantido.** Decisão deliberada do plan.md, segue o precedente `comandas/actions.ts`. O argumento de "oracle de enumeração" não se aplica a Next server actions (assinatura já está no bundle do cliente). RNF01 garantido: nenhum não-founder escreve no banco. |
| MEDIUM | Input NaN→0 sentinela | **Mantido.** O tratamento atual exibe campo vazio (UX melhor que mostrar "0"); o revisor confirmou "não há bug". |
| LOW | `new Date()` inline (timezone do preview) | **Mantido.** Risco aceito no plan.md (Risks); valor confirmado vem do servidor. |
| LOW | Telefone WhatsApp hardcoded no banner | **Mantido.** Consistente com `SubscriptionWarningBanner` existente; fora do escopo. |

### Scores
- Frontend: 8/10
- Backend: 7.5/10
- **Overall: 7.75/10**

## Product Validation

- **0013F (com spec):** RF01–RF05 ✅, RN01–RN03 ✅, RNF01 ✅ — todos verificados em código e testes (390 passam, incluindo integração com DB T59–T65).
- **Banner de teste / Preço do plano (sem spec):** revisados tecnicamente, sem bloqueadores. Tabela `platform_settings` (config global, fora da RLS) justificada e segura: leitura pública no signup, escrita gated por `requireFounder`.

**Veredito: ✅ PASSED — pronto para `/add.done`.**
