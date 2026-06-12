---
id: 0005F
type: feature-review
slug: lucro-fechamento
status: passed
created: 2026-06-12
---

# Review: 0005F-lucro-fechamento

> **Date:** 2026-06-12 | **Branch:** feature/0005F-lucro-fechamento
> **Reviewed by:** /add.review (model: claude-opus-4-8)

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` — 0 errors; `/lucro` e `/financeiro/caixa` geradas |
| Spec Compliance | ✅ PASSED | 21/21 itens compliant; 0 STALE TICK; RF/RN 100% cobertos |
| Code Review Score | ✅ PASSED | 9.3/10 (threshold ≥ 7) |
| Product Validation | ✅ PASSED | RF: 8/8, RN: 10/10, RNF: 2/2 |
| Validation Gates | ✅ PASSED | typecheck→0 · lint→0 · test→0 (175 passed) · build→0 |
| **Overall** | **✅ PASSED** | **Pronto para merge** |

> Nota: os testes de integração/RLS rodaram **de verdade** contra o Postgres do Docker (subido durante a review + `npm run db:setup`), não pulados. 0005_lucro_rls.sql aplicada.

## Spec Compliance Audit

Fonte: `tasks.md → ## Acceptance Checklist` (21 itens) cruzada com o código e com `about.md` (RF/RN).

| Item (resumo) | Tipo | Encontrado em | Status |
|---|---|---|---|
| `finalizeSale` grava `cost_cents_snapshot` na mesma tx (RF01/RNF02) | Service | sale-service.ts:54-64, 76 | COMPLIANT |
| Produto sem custo → snapshot null (RN04) | Service | sale-service.ts:63; data.ts:84 | COMPLIANT |
| Editar `products.cost_cents` não muda lucro passado (RN03) | Schema | sale-items.ts:46 (snapshot) | COMPLIANT |
| `getProfitByPeriod` retorna ProfitDto completo (RF02/RNF01) | Service | profit-service.ts:19-43 | COMPLIANT |
| Período padrão = hoje (RF02) | Service | profit-service.ts:49-60 | COMPLIANT |
| `itemsWithoutCost` sinaliza; venda nunca omitida (RF03/RN04) | Data | profit-data.ts:42 (count filter) | COMPLIANT |
| `profitCents` pode ser negativo; valores inteiros (RN02) | Service | profit-service.ts:29 (sem clamp) | COMPLIANT |
| Lucro não desconta sangria/conta (RN05) | Data | profit-data.ts:45-53 (só sale_items×sales) | COMPLIANT |
| `marginPercent`=0 quando revenue=0 (RNF01) | Service | profit-service.ts:30-33 | COMPLIANT |
| `openCashSession` 'aberta', `opened_by` do ctx (RF04/RN10) | Service | cash-session-service.ts:28-49 | COMPLIANT |
| Abrir 2ª rejeita ConflictError + índice parcial (RN09) | Service+Schema | cash-session-service.ts:33-47; cash-sessions.ts:70-72 | COMPLIANT |
| Movimentos recebem `session_id` via `selectOpenSessionId` (RF05) | Service | cash-session-data.ts:77; sale-service.ts:102; cash-service.ts:28 | COMPLIANT |
| `closeCashSession`: esperado = opening + Σ dinheiro (RF06/RN06) | Service | cash-session-service.ts:65-70 | COMPLIANT |
| Esperado só dinheiro; pix/cartão/fiado fora (RN06) | Data | cash-session-data.ts:99-116 (Σ cash_movements) | COMPLIANT |
| `divergenceCents` = contado − esperado; não bloqueia (RF06/RN07) | Service | cash-session-service.ts:71 | COMPLIANT |
| Sessão imutável após fechada; refechar rejeita (RN08) | Data | cash-session-data.ts:124-154 (WHERE status='aberta') | COMPLIANT |
| `listSessions` histórico completo (RF07) | Data | cash-session-data.ts:157-179 | COMPLIANT |
| `getOpenSession` aberta ou null (RF08) | Service | cash-session-service.ts:87-93 | COMPLIANT |
| CashSessionPanel mostra abrir/fechar (RF08) | UI | CashSessionPanel.tsx; caixa/page.tsx:19-28 | COMPLIANT |
| `cash_sessions` isolada por RLS; lucro só do tenant (RN01) | Migration | 0005_lucro_rls.sql; profit-data filtra tenantId | COMPLIANT |
| Schemas exigem inteiro ≥ 0; from/to opcionais (RN02/RF02) | Validation | profit.ts:10-29 | COMPLIANT |

**Resumo:** 21 COMPLIANT / 0 DIVERGENT / 0 MISSING. RF 8/8, RN 10/10, RNF 2/2 cobertos. **SPEC_AUDIT_STATUS = COMPLIANT.**

## Code Review Summary

Reviewers backend + frontend ficaram indisponíveis (limite de sessão dos subagents); a revisão foi conduzida pelo coordenador sobre a leitura integral dos 31 arquivos alterados, seguida da re-execução independente de todas as validation gates.

### Backend (score 9.5/10)
- **Arquitetura**: camadas respeitadas (UI → actions → service → data); `Executor = Pick<Database,…>` consistente com `finance/cash-data.ts`. Sem lógica de negócio em actions.
- **Multi-tenancy/RLS**: toda query filtra `tenant_id` (aditivo à RLS); `0005_lucro_rls.sql` espelha o padrão de 0004 (GRANT + ENABLE RLS + policy `tenant_isolation` por `tenant_members`). `tenant_id`/`userId` sempre do ctx — nunca do input (RN10).
- **Concorrência (RN09)**: pré-check + partial unique index `(tenant_id) WHERE status='aberta'` + captura de `isUniqueViolation` → ConflictError. `closeCashSession` trata corrida (select→update) devolvendo null → ValidationError.
- **Imutabilidade (RN08)**: único UPDATE é `aberta→fechada` com `WHERE status='aberta'`; sem reopen.
- **Dinheiro/centavos (RN02)**: lucro sem clamp (pode ser <0); custo agregado com `round(cost×qty)` por item (inteiro). Queries parametrizadas (Drizzle) — sem injeção.
- Sem `any`, sem `console.log`, sem código morto.

### Frontend (score 9.0/10)
- RSC `force-dynamic` + server actions + `router.refresh()`; sem TanStack/Zustand (conforme padrão).
- `ProfitFilter` pula o fetch no 1º render (usa `initial` do servidor) e faz cleanup com `active` flag — espelha `CashStatement`.
- `SessionHistory` com loading/error/empty; `OpenSessionDialog`/`CloseSessionDialog` tratam ConflictError via `toast.error`. Lucro/divergência negativos em `text-destructive`; sobra com `+` e `text-primary`.
- Labels com `htmlFor`/`id`; `MoneyInput` em centavos; `centsToBRL` na formatação.

### Observações não-bloqueantes (informativas, sem correção necessária)
1. As actions de sessão de caixa vivem em `app/(app)/lucro/actions.ts` mas são consumidas por `/financeiro/caixa` — **é exatamente o que o plan.md especifica**; acoplamento leve por design.
2. `selectSessions` usa `lte(opened_at, to)` e `selectProfitByPeriod` usa `lt(created_at, to)`; ambos recebem `T23:59:59` do frontend — comportamento correto na prática, só estilisticamente divergente.
3. `toCashMovementDto` não expõe `sessionId` no DTO — intencional (a UI não precisa).

Nenhuma viola contrato, segurança ou correção; nada foi auto-corrigido.

## Product Validation

| Req | Status | Evidência |
|---|---|---|
| RF01–RF08 | ✅ PASSED | snapshot custo, /lucro, item sem custo, abrir/vincular/fechar, histórico, indicador de turno |
| RN01–RN10 | ✅ PASSED | RLS, centavos/negativo, snapshot imutável, esperado dinheiro-only, divergência, imutabilidade, sessão única, atribuição ctx |
| RNF01–RNF02 | ✅ PASSED | agregação on-the-fly (sem profit_ledger); snapshot na mesma tx |
| Pré-requisitos | ✅ OK | `cash_sessions` + colunas existem (`db:setup`); RLS aplicada antes do retrofit |

**Product Status: PASSED.**

## Files Modified During Review

Nenhum. A review não exigiu auto-correções; apenas subiu o Postgres do Docker e rodou as gates.

## Next Steps

- ✅ Pronto para `/add.done` (merge). As mudanças já estão staged.
