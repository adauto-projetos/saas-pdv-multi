---
id: 0004F
type: feature-review
slug: financeiro
created: 2026-06-11
updated: 2026-06-11
related: [0004F]
---

# Review: 0004F-financeiro

> **Date:** 2026-06-11 | **Branch:** feature/0004F-financeiro | **Reviewed by:** /add.review (Opus 4.8)

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` — exit 0, rotas `/financeiro/{caixa,clientes,receber,pagar}` registradas |
| Spec Compliance | ✅ PASSED | 32/32 itens do Acceptance Checklist COMPLIANT; 26/26 RF/RN cobertos; sem stale ticks |
| Code Review Score | ✅ PASSED | 8.25/10 (backend 8.5, frontend 8.0 — threshold ≥ 7) |
| Product Validation | ✅ PASSED | RF: 14/14, RN: 10/10, RNF: 2/2 |
| Validation Gates | ✅ PASSED | `typecheck → 0` · `lint → 0` · `test → 0` (144/144) · `build → 0` |
| **Overall** | **✅ PASSED** | **Pronto para merge (`/add.done`)** |

## Spec Compliance Audit

SPEC_AUDIT_STATUS = **COMPLIANT**. tasks.md tem `## Requirements Coverage` (26 linhas) e `## Acceptance Checklist` (32 itens), 95/95 checkboxes `[x]`. Cada item foi cruzado com o código pelos validadores por área (Database, Backend, Frontend) durante o `/add.build`; nenhum stale tick. Todos os RF (RF01–RF14) e RN (RN01–RN10, RNF01–RNF02) têm ≥1 item de aceitação referenciando-os via `(RFxx/RNxx)`.

Contratos-chave verificados em código:
- 13 Server Actions em `app/(app)/financeiro/*/actions.ts` (COMPLIANT)
- 4 serviços transacionais em `lib/services/finance/*` + retrofit `finalizeSale` (COMPLIANT)
- 6 tabelas + RLS `0004_financeiro_rls.sql` + retrofit `sales` (COMPLIANT)
- 11 componentes + 4 páginas + nav + retrofit checkout (COMPLIANT)

## Code Review Summary

Dois revisores (Backend + Frontend) rodaram em paralelo e **auto-corrigiram** todas as violações reais. Resumo:

### Backend (8.5/10) — 5 arquivos corrigidos
| Severidade | Arquivo | Correção |
|---|---|---|
| Important | `lib/services/finance/derive.ts` | `deriveStatus` retornava `aberto` para conta de 0 centavos; agora `remaining ≤ 0 → quitado` (RN04). |
| Important | `lib/services/finance/receivable-data.ts` + `receivable-service.ts` | `getCustomerOwedTotal` retornava dados vazios silenciosamente para cliente inexistente; agora lança `NotFoundError` (evita sondagem de UUID entre tenants). |
| Important | `lib/services/finance/receivable-service.test.ts` | Adicionados 2 testes de imutabilidade exigidos pela spec (RN10). |
| Minor | `receivable-data.ts`, `payable-data.ts` | Comentários do back-link `cash_movement_id` corrigidos (não violam RN10). |

Conformes (sem correção): multi-tenancy/RLS (RN01/RN06), atomicidade RNF02, dinheiro em centavos, injeção (Drizzle parametrizado), imutabilidade RN10, contratos de DTO.

### Frontend (8.0/10) — 8 arquivos modificados + 2 novos
| Severidade | Arquivo | Correção |
|---|---|---|
| Important | `ReceivableList.tsx`, `PayableList.tsx` | Faltava `router.refresh()` após pagamento → saldo do caixa/totais ficavam stale. Adicionado refresh + `reloadKey`. |
| Important | `NewReceivableForm.tsx`, `NewPayableForm.tsx` + novos `ReceberView.tsx`/`PagarView.tsx` | Conta recém-criada não aparecia na lista (estado local não re-buscava). Wrappers client compartilham `reloadKey`. |
| Minor | `CustomerPicker.tsx`, `NewReceivableForm.tsx`, `caixa/PaymentDialog.tsx` | `htmlFor`/`id` nos labels de cliente (acessibilidade). |

Conformes: padrão RSC + Server Actions (sem TanStack/Zustand), dinheiro via MoneyInput/centsToBRL, RN07 (fiado exige cliente), RF14 (vencidas destacadas), estados loading/error/empty, tipos espelham DTOs, segurança de rotas.

## Product Validation

| Req | Status | Onde |
|---|---|---|
| RF01–RF04 (caixa: entrada/saída/saldo/extrato) | ✅ | cash-service + componentes financeiro |
| RF05 (venda dinheiro → caixa) | ✅ | sale-service retrofit |
| RF06 (cliente) | ✅ | customer-service + CustomerForm/List |
| RF07 (venda fiado → conta + exige cliente) | ✅ | sale refine RN07 + CustomerPicker no checkout |
| RF08–RF10 (contas a receber + total por cliente) | ✅ | receivable-service + ReceivableList |
| RF11–RF13 (contas a pagar) | ✅ | payable-service + PayableList |
| RF14 (vencidas destacadas) | ✅ | deriveOverdue + Badge destrutivo |
| RN01–RN10 | ✅ | RLS, centavos, RN03 pré-insert, RN04 derivado, RN05 ledger, RN06 sessão, RN07 refine, RN08 só dinheiro, RN09 RLS+nome, RN10 só insert |
| RNF01 (índices) / RNF02 (atomicidade) | ✅ | índices na migration / tx única withUserRls |

Product Status: **PASSED** — nenhum pré-requisito ausente, nenhum RF/RN sem implementação.

## Files Modified (review auto-correction)
- `lib/services/finance/derive.ts`, `receivable-data.ts`, `receivable-service.ts`, `payable-data.ts`, `receivable-service.test.ts`
- `components/financeiro/ReceivableList.tsx`, `PayableList.tsx`, `NewReceivableForm.tsx`, `NewPayableForm.tsx`, `CustomerPicker.tsx`
- `components/caixa/PaymentDialog.tsx`
- `app/(app)/financeiro/receber/page.tsx`, `pagar/page.tsx`
- **Novos:** `components/financeiro/ReceberView.tsx`, `PagarView.tsx`
