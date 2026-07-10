---
id: CHG0025
type: changelog
date: 2026-07-10
related: [0024H]
---

# CHG0025 — Hotfix 0024H: Layout mobile do form de produto + melhorias no caixa

## TL;DR

Corrige dois bugs no formulário "Novo produto"/"Editar produto" no mobile ({{doc:0024H}}): campos pareados cortando texto por grid fixo sem breakpoint, e botão "Salvar" escondido atrás do menu inferior. Inclui, a pedido do owner na mesma sessão, duas melhorias na tela do caixa: grade de produtos com 4 colunas (antes 5) e produtos mais vendidos (histórico completo) ordenados no topo. Sem breaking changes.

## Changes

- fix(products): grid `grid-cols-2` fixo → `grid-cols-1 sm:grid-cols-2` nos pares Código/Unidade e Estoque inicial/mínimo do form de produto — evita corte de texto em telas estreitas — {{doc:0024H}}
- fix(products): campo Emoji desacoplado do par com Categoria (linha própria) — elimina o aperto que cortava o placeholder do `EmojiPicker` — {{doc:0024H}}
- fix(products): barra do botão "Salvar" elevada (`bottom-16 z-50` no mobile, `lg:bottom-0` no desktop) — antes ficava sempre atrás do `BottomNav` (`z-40` vs `z-index: auto`) — {{doc:0024H}}
- fix(products): `pb-32 lg:pb-24` no form para compensar o botão elevado, sem cobrir os últimos campos — {{doc:0024H}}
- feat(products): campos do form reordenados a pedido do owner — Foto → Emoji → Nome → Categoria → Código de barras/Unidade → Estoque — {{doc:0024H}}
- feat(products): espaçamento vertical entre blocos do form reduzido (`gap-6` → `gap-4`) a pedido do owner
- feat(caixa): grade de produtos com `minmax(130px, 1fr)` (antes `105px`) — reduz de 5 para 4 colunas por linha, mantendo responsividade via `auto-fill`
- feat(caixa): grade de produtos ordenada pelos mais vendidos primeiro (histórico completo, por tenant) — nova query `selectProductSalesQuantities` (soma `sale_items.quantity` por produto) e novo `listProductsForCaixa`/`listProductsForCaixaAction`; a lista de `/products` (admin) permanece alfabética

## Breaking

none

## Migration

none

## Quick Ref

```json
{"id":"0024H","domain":"produtos / caixa","touched":["components/products/","components/caixa/","lib/services/products/","lib/services/sales/","app/(app)/products/","app/(app)/caixa/"],"patterns":["responsive-breakpoints","tailwind-v4-tokens","cross-domain-data-reuse","rls-single-transaction"],"keywords":["mobile","grid-responsivo","z-index","bottom-nav","caixa","mais-vendidos","sale-items","grade-produtos"]}
```
