# Review: 0002F — Venda Rápida (Mercado)

> **Date:** 2026-06-10 | **Branch:** feature/0002F-venda-rapida-mercado

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` — 0 erros |
| Spec Compliance | ✅ PASSED | 19/19 RF/RN/RNF compliant; sem stale ticks |
| Code Review Score | ✅ PASSED | 8.7/10 (backend 9, frontend 8.5) — threshold ≥ 7 |
| Product Validation | ✅ PASSED | RF: 10/10, RN: 8/8, RNF: 1/1 |
| Validation Gates | ✅ PASSED | `typecheck → 0` · `lint → 0` · `test → 0 (78 passed)` · `build → 0` |
| **Overall** | **✅ PASSED** | **Pronto para merge** |

> Reviewed by: /add.review (dois reviewers paralelos: backend/database + frontend) · model: claude-opus-4-8

## Spec Compliance Audit

SPEC_AUDIT_STATUS = **COMPLIANT**. Todos os itens do `## Acceptance Checklist` (17) batem com o código e o plano; `## Requirements Coverage` mapeia 100% dos RF01–RF10, RN01–RN08, RNF01. Sem STALE TICK, sem RF/RN descoberto.

## Code Review Summary

Dois reviewers em contexto fresco. **0 findings CRITICAL/HIGH reais de segurança** — o perímetro multi-tenant (RLS + `withUserRls` + auth da sessão + snapshot de preço no servidor) está correto em todas as superfícies.

### Corrigido nesta review (auto-correção)

| ID | Sev | Arquivo | Correção |
|----|-----|---------|----------|
| A1 | MED | sales/data.ts | baixa de estoque passa `quantity` como number (não string) |
| A2 | MED | validation/sale.ts | `quantity` agora `.finite()` (rejeita Infinity/NaN) |
| B1 | MED | sales/sale-service.ts | `createdAt` retornado é o real do banco (não fabricado) |
| B3 | LOW | sales/sale-service.ts | mescla itens com `productId` duplicado (evita linhas/baixas duplas) |
| E2 | LOW | schema/sale-items.ts | CHECK `unit in ('un','kg')` (consistência com products) |
| D4 | MED | sales/sale-service.test.ts | + testes de serviço T09/T10 (carrinho vazio / qtd ≤ 0) |
| E1 | LOW | sales/sale-service.test.ts | T15 reforçado (itens populados + boundary do dia) |
| UX-01 | HIGH | caixa/use-cart.ts | produto por `kg` não soma 1 ao re-bipar (peso é digitado) |
| UX-02 | HIGH | caixa/CashierScreen.tsx | estado `lookingUp` desabilita o input durante o lookup (evita bipagem dupla) |
| COR-01 | HIGH | caixa/Cart.tsx | quantidade ≤ 0 remove o item (nunca deixa item com 0) |
| COR-02 | MED | caixa/CashierScreen.tsx | `try/catch` no handleBarcode |
| COR-03 | MED | caixa/ProductSearch.tsx | busca com erro limpa a lista (não mantém resultados velhos) |
| COR-04 | MED | caixa/CashierScreen.tsx | removido `router.refresh()` redundante (revalidatePath já cobre) |
| UX-04 | MED | caixa/CashierScreen.tsx | layout responsivo 2 colunas (busca \| carrinho sticky) |
| A11Y-01 | HIGH | BarcodeInput/ProductSearch | `aria-label` nos inputs (antes só placeholder) |
| A11Y-02 | HIGH | caixa/ProductSearch.tsx | roles ARIA combobox/listbox/option |
| A11Y-03 | MED | caixa/CartSummary.tsx | `aria-live` no total (anúncio a leitores de tela) |
| A11Y-05 | LOW | caixa/Cart.tsx | `aria-label` na quantidade de cada item |
| CQ-01 | MED | caixa/TodaySalesList.tsx | `"use client"` (formata hora no fuso do browser) |

### Known Issues / Deferred (não-bloqueantes)

- **Fuso horário em "vendas do dia" (C1, MED):** `listTodaySales` usa o fuso do servidor. Em dev local (Brasil) funciona; em deploy UTC pode cruzar a meia-noite. Resolver junto da feature de Fechamento (#6) com fuso por tenant.
- **Navegação por teclado no dropdown de busca (UX-05):** seleção por mouse/clique apenas; setas/Enter no autocomplete ficam para evolução.
- **PaymentDialog usa AlertDialog (A11Y-04):** semântica de `alertdialog`; trocar por `Dialog` puro é cosmético, adiado.
- **`db:push` derruba as RLS policies:** o `drizzle-kit push` não conhece as policies hand-written e as remove. **Sempre rodar `npm run db:rls` depois do push** (ou usar `npm run db:setup`, que faz os dois).

## Product Validation

| Faixa | Resultado |
|---|---|
| RF01–RF10 | ✅ todos implementados e testados |
| RN01–RN08 | ✅ todos (RLS, snapshot de preço, carrinho não-vazio, qtd>0, estoque negativo permitido, centavos, enum de pagamento, atribuição ao usuário) |
| RNF01 | ✅ busca por código via índice `(tenant_id, barcode)` |
| Pré-requisitos (0001F) | ✅ produtos, RLS, auth, padrões reaproveitados |

**Product Status: PASSED.**
