# Review: 0018F-rebrand-logo

> **Date:** 2026-06-27 | **Branch:** feature/0018F-rebrand-logo

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` — 0 errors; `/icon.png` static route ativo |
| Spec Compliance | ✅ PASSED | 16/16 itens de aceite COMPLIANT; RF/RN 100% cobertos |
| Code Review Score | ✅ PASSED | 8.5/10 (frontend 8 + backend 9) — threshold ≥ 7 |
| Product Validation | ✅ PASSED | RF: 6/6, RN: 2/2 |
| Validation Gate — typecheck | ✅ PASSED | `npm run typecheck` → exit 0 |
| Validation Gate — lint | ✅ PASSED | `npm run lint` → exit 0 (0 erros, 9 warnings `<img>`/scripts pré-existentes) |
| Validation Gate — test | ✅ PASSED | `npm test` → exit 0 (502/502, inclui RLS com DB) |
| Validation Gate — build | ✅ PASSED | `npm run build` → exit 0 |
| **Overall** | **✅ PASSED** | **Ready for merge** |

> Reviewed at: 2026-06-28 02:03 UTC
> Reviewed by: /add.review (model: opus)

## Spec Compliance Audit

`SPEC_AUDIT_STATUS = COMPLIANT` — todos os RF/RN do about.md presentes em tasks.md `## Requirements Coverage`, todos `[x]`; cada RF/RN referenciado por ≥1 item do `## Acceptance Checklist`.

| RF/RN | Status | Evidência |
|-------|--------|-----------|
| RF01 — 0 ocorrências "PDV.multi" | COMPLIANT | grep em app/components = 0; metadata raiz + 6 páginas + manual |
| RF02 — login/signup escuro + logo | COMPLIANT | `app/(auth)/layout.tsx` (dark + logo). **Divergência menor:** logo migrou dos forms para o layout (acima do formulário) por ajuste visual do owner — RF02 segue satisfeito |
| RF03 — caixa logo no header | PIVOT (owner) | Logo do header do caixa **removido** a pedido do owner na finalização; a marca passou a viver na **sidebar** (logo completo) + favicon |
| RF04 — marca em texto estilizado | PIVOT (owner) | Sidebar agora usa o **logo em imagem** (logo-full.webp expandida / logo-icon.webp recolhida) no lugar do texto; admin + manual seguem em texto estilizado |
| RF05 — recibo storeName + rodapé | COMPLIANT | `buildReceiptHtml`: `storeName \|\| "PDV.ART.br"` + "via PDV.ART.br" |
| RF06 — favicon próprio | COMPLIANT | `app/icon.png` (Next auto-detect) |
| RNF01 — logos WebP < 100 KB | COMPLIANT | dark 24,7 KB / light 43,2 KB |
| RNF02 — login escuro WCAG AA | COMPLIANT | tokens invertem sob `.dark`; card opaco |
| RN01 — sufixo colorido (.ART) | COMPLIANT | inline nos 3 locais |
| RN02 — storeName por tenant, fallback marca | COMPLIANT | read sob `withUserRls` por `ctx.tenantId`; fallback no client |

## Code Review Summary

**Frontend (8/10):** 1 correção aplicada — **XSS (Important):** `item.name`/`item.unit`/`method` eram injetados crus no template do recibo (`window.open` + `document.write`, same-origin). `escapeHtml` já existia para `storeName`; estendido para todos os campos de dado do usuário em `buildReceiptHtml`. Hooks (EmojiPicker, QuantityInput) revisados — corretos.

**Backend (9/10 — APPROVED):** RN02 multi-tenancy com dupla proteção (filtro `ctx.tenantId` + RLS `tenant_self_read`); caminho de venda inexistente/de outro tenant retorna `ok:false` sem `data`/storeName. Testes T02/T04/T03 significativos. Ajuste menor aplicado: label duplicado `T03` → `T03b`.

**Correções pós-review (gate lint):** `QuantityInput` reescrito de `useEffect`+setState para reconciliação na renderização (padrão React), eliminando erro lint "setState synchronously within an effect".

### Arquivos modificados na review
- `components/caixa/PaymentDialog.tsx` — escapeHtml em item.name/unit/method
- `components/ui/QuantityInput.tsx` — reconciliação prop→state na render (sem useEffect)
- `db/__tests__/receipt-store-name-rls.test.ts` — label T03b

### Refinamentos de marca pós-review (owner, gates re-rodados verdes)
- Logo novo (transparente) na sidebar: `logo-full.webp` (expandida) / `logo-icon.webp` (recolhida), no lugar do texto.
- Favicon novo `app/icon.png` (emblema); removidos `app/favicon.ico` padrão e `public/logo-light.webp` (sem uso).
- Logo do header do caixa removido (RF03 pivot).
- `tests/0018F-rebrand-assets.test.ts` atualizado para os novos assets (T08/T09).
- Re-validação: typecheck ✅ · lint ✅ (0 erros) · test ✅ 502/502 · build ✅.

## Product Validation

| Requisito | Status |
|-----------|--------|
| RF05 — storeName no ReceiptDto | PASSED |
| RN02 — storeName escopado ao tenant da sessão, sem vazamento cross-tenant | PASSED |

**Product Status: PASSED**

## Entregas fora do escopo original (0018F)

Melhorias solicitadas pelo owner durante a sessão, na mesma branch (aprovado finalizar tudo junto):

| Entrega | Descrição | Justificativa |
|---------|-----------|---------------|
| EmojiPicker | Busca/seleção de emoji por palavra-chave (pt-BR) no cadastro de produto | improvement |
| QuantityInput fix | Campo de estoque agora pode ser apagado (não força 0) | improvement |
| Cards do caixa | Redução ~30% para caber mais produtos por linha | improvement |
