---
id: 0024H-related
type: hotfix-related
created: 2026-07-10
updated: 2026-07-10
related: [0024H]
---

## TL;DR

Ativos impactados pelo hotfix {{doc:0024H}}: só `components/products/ProductForm.tsx` (grid, botão salvar, ordem de campos). Docs com info potencialmente defasada: {{doc:0010F}} (introduziu o grid `grid-cols-2` sem breakpoint e o `BottomNav`). Segue pendente um pedido separado do owner sobre a grade de produtos do caixa, fora do escopo deste hotfix.

## Impacted Files

- [components/products/ProductForm.tsx:177](../../../components/products/ProductForm.tsx#L177) — grid Código de barras/Unidade: `grid-cols-2` fixo → `grid-cols-1 sm:grid-cols-2`.
- [components/products/ProductForm.tsx:217](../../../components/products/ProductForm.tsx#L217) — grid Estoque inicial/mínimo: `grid-cols-2` fixo → `grid-cols-1 sm:grid-cols-2`.
- [components/products/ProductForm.tsx:132-175](../../../components/products/ProductForm.tsx#L132-L175) — campo Emoji desacoplado do par com Categoria; ordem dos campos alterada (Emoji → Nome → Categoria).
- [components/products/ProductForm.tsx:273](../../../components/products/ProductForm.tsx#L273) — barra fixa do botão salvar: offset e z-index para não ficar atrás do `BottomNav`.
- [components/products/ProductForm.tsx:124](../../../components/products/ProductForm.tsx#L124) — `pb-32 lg:pb-24` (padding do form) e `gap-4` (espaçamento entre blocos).

## Impacted Docs

- {{doc:0010F}} — introduziu o grid `grid-cols-2` sem breakpoint (commit `cfa9bfa`) e o `BottomNav` fixo (`components/layout/BottomNav.tsx`); nenhum dos dois documentou a interação entre CTAs fixos de formulário e o menu inferior — agora coberta por este hotfix.

## Follow-ups

- Pedido do owner de mudar a grade de produtos do **caixa** (`components/caixa/CashierScreen.tsx`, tela `/caixa`) de 5 para 4 colunas — tela e componente diferentes, fora do escopo deste hotfix; aguardando decisão do owner sobre abrir novo hotfix ou feature.
- Considerar documentar, numa próxima feature/refactor, a convenção de offset/z-index para barras fixas de formulário coexistirem com o `BottomNav` — hoje não há guia e o mesmo bug pode se repetir em outros forms com CTA fixo.
