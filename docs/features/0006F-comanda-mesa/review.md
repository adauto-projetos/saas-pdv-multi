---
id: 0006F
type: feature-review
slug: comanda-mesa
created: 2026-06-13
related: [0006F]
---

# Review: 0006F — Comanda/Mesa

> **Date:** 2026-06-13 | **Branch:** feature/0006F-comanda-mesa

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` — exit 0; `/comandas` route compiled as ƒ dynamic |
| Spec Compliance | ✅ PASSED | 21/21 RF/RN/RNF covered; 23/23 acceptance items [x]; no stale ticks |
| Code Review Score | ✅ PASSED | 9.0/10 (threshold ≥ 7) |
| Product Validation | ✅ PASSED | RF: 8/8, RN: 11/11, RNF: 2/2 |
| `npm run typecheck` | ✅ PASSED | exit 0 — no type errors |
| `npm run lint` | ✅ PASSED | exit 0 — 0 errors, 0 warnings |
| `npm test` | ✅ PASSED | 250/250 tests (47 files) |
| `npm run build` | ✅ PASSED | exit 0 |

| **Overall** | **✅ PASSED** | **Ready for merge** |

> Reviewed at: 2026-06-13  
> Reviewed by: /add.review (model: claude-sonnet-4-6)

---

## Spec Compliance Audit

| Area | Count | Status |
|------|-------|--------|
| Requirements Coverage (RF/RN/RNF) | 21/21 | ✅ COMPLIANT |
| Acceptance Checklist items | 23/23 | ✅ COMPLIANT |
| Execution Tasks | 16/16 | ✅ COMPLIANT |
| STALE_TICK found | 0 | ✅ |
| UNCOVERED RF/RN | 0 | ✅ |

**SPEC_AUDIT_STATUS: COMPLIANT**

---

## Code Review Summary

### Backend (score: 9/10)

**Files reviewed:** 16  
**Issues found:** 2 | **Issues fixed:** 2

#### Auto-corrections applied

**1. `lib/services/comanda/comanda-data.ts` — `innerJoin` → `leftJoin` (Important)**
- **Root cause:** Both `selectItemsByComandaIds` and `selectComandaById` used `INNER JOIN products`, which silently drops `comanda_items` rows where `product_id` is NULL (product removed from catalog via SET NULL FK). This made the guard in `closeComanda` (`if (!item.productId) throw ValidationError`) unreachable — a comanda with removed-product items would silently close with an under-charged total.
- **Fix:** Changed both joins to `LEFT JOIN`. Updated `toComandaItemDto` to accept nullable product fields with safe fallbacks (`"(produto removido)"`, `"un"`, `0`). The ValidationError guard in `closeComanda` is now reachable and correctly surfaces the issue to the operator.
- **Impact:** Correctness improvement — prevents silent under-charge on edge case.

**2. `lib/services/comanda/comanda-service.test.ts` — RF08 test split (Minor)**
- **Root cause:** Plan spec lists `comanda-RF08-list-open` and `comanda-RF08-list-open-excludes-closed` as separate test IDs. The implementation combined both behaviors in a single `it()`.
- **Fix:** Split into two separate `it()` tests with canonical IDs. Test count: 249 → 250.

#### No violations found in
- Security: all queries parameterized via Drizzle ORM; `tenantId` always from `requireAuthContext()`
- Multi-tenancy: RLS covers `comandas` + `comanda_items`; `0006_comanda_rls.sql` mirrors 0005 pattern
- Architecture: layers respected; placement correct per CLAUDE.md
- Code quality: no `any`, no `console.log`, explicit return types
- Contracts: all DTOs match plan spec; actions return `ActionResult<T>`

---

### Frontend (score: 9/10)

**Files reviewed:** 9  
**Issues found:** 4 minor | **Issues fixed:** 0 (none warranted code change)

#### Minor observations (no action required)

- `StatusBadge` defined locally in both `ComandaCard.tsx` and `ComandaHistory.tsx` — intentional (slightly different variant mappings per context).
- `AddItemForm.tsx` — two `<Label>` elements act as section headings for `BarcodeInput`/`ProductSearch` without `htmlFor`; these are self-contained reused components with their own internal label management. Low accessibility impact.
- `ComandaHistory.tsx` — `StatusBadge` fallback for `"aberta"` is unreachable (history only returns non-open comandas). Harmless dead-code path.

#### No violations found in
- RSC/Server Action pattern: `force-dynamic`, no client state leakage, correct error fallback
- RF requirements: RF01-RF08 all covered with correct component wiring
- UX patterns: loading/error/empty states all present; AlertDialog for destructive actions; partialTotalCents disclaimer visible
- Money: `centsToBRL` used throughout — no raw division

---

## Product Validation

| RF/RN | Requirement | Status |
|-------|-------------|--------|
| RF01 | Abrir comanda com rótulo livre | ✅ `openComanda` + `OpenComandaDialog` |
| RF02 | Lançar item (baixa estoque no lançamento) | ✅ `addComandaItem` + `recordComandaExit` + `AddItemForm` |
| RF03 | Remover item (estorna estoque) | ✅ `removeComandaItem` + `recordComandaEstorno` |
| RF04 | Cancelar comanda (estorna todos, sem venda) | ✅ `cancelComanda` + AlertDialog |
| RF05 | Total parcial ao vivo (informativo) | ✅ `partialTotalCents` via LEFT JOIN products + disclaimer |
| RF06 | Fechar → vira venda (snapshot, dialog confirm) | ✅ `closeComanda` + `CloseComandaDialog` (AlertDialog) |
| RF07 | dinheiro→caixa, fiado→a receber, custo→lucro, sem re-baixa | ✅ `insertCashMovement` / `recordSaleReceivable` / `costCentsSnapshot`; no `recordSaleExit` |
| RF08 | Tela de comandas (abertas + histórico) | ✅ `/comandas` RSC + `ComandasScreen` + `ComandaHistory` + nav link |
| RN01 | Isolamento por tenant (RLS) | ✅ `0006_comanda_rls.sql` + `comanda-rls.test.ts` |
| RN02 | Centavos inteiros; qty > 0; total ≥ 0 | ✅ `numeric(10,3)` + CHECK + zod `.finite().positive()` |
| RN03 | Estoque baixa ao lançar; estorna remove/cancel; pode negativo | ✅ `recordComandaExit/Estorno`; sem guard de negativo |
| RN04 | Várias comandas abertas por tenant | ✅ Sem unique parcial; `openComanda` sem conflito |
| RN05 | Snapshot preço/custo no fechamento; aberta sem preço | ✅ `comanda_items` sem coluna de preço; snapshot em `closeComanda` |
| RN06 | Fechada/cancelada imutável | ✅ WHERE status='aberta' em cancel/close; guards em add/remove |
| RN07 | Fechar exige ≥1 item; fiado exige cliente | ✅ ValidationError em ambos; zod `.refine` fiado→customerId |
| RN08 | Fechamento não baixa estoque | ✅ `closeComanda` não chama `recordSaleExit` |
| RN09 | Não exige turno; dinheiro vincula sessão se houver | ✅ `selectOpenSessionId` nullable; sem bloqueio |
| RN10 | Atribuição ao usuário/tenant do contexto | ✅ `requireAuthContext()` em toda action |
| RN11 | Observação por item texto livre opcional | ✅ `observation nullable`; zod `.optional()` |
| RNF01 | Lista abertas + total parcial rápido | ✅ Índice `(tenant_id, status)` + LEFT JOIN products |
| RNF02 | Fechamento atômico; estorno atômico | ✅ Toda mutação em `withUserRls` tx única |

**PRODUCT_STATUS: PASSED**
