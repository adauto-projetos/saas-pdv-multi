---
id: 0024H
type: hotfix-about
severity: medium
created: 2026-07-10
updated: 2026-07-10
related: [0010F, 0023H]
---

## TL;DR

No formulário "Novo produto"/"Editar produto" no mobile: (1) os pares de campos (Emoji+Categoria, Código+Unidade, Estoque inicial+Estoque mínimo) usavam `grid-cols-2` fixo, sem versão mobile, cortando texto e apertando os campos; (2) o botão "Salvar produto" ficava escondido atrás do menu inferior fixo do app, sempre — não intermitente. Correção: grid responsivo (`grid-cols-1 sm:grid-cols-2`), botão elevado acima do menu (`bottom-16 lg:bottom-0` + `z-50`), espaçamento vertical reduzido, e reordenação de campos a pedido do owner (Foto → Emoji → Nome → Categoria → Código/Unidade → Estoque).

## Symptom

- **when** — sempre que o formulário de produto é aberto em viewport mobile (< 640px).
- **where** — [components/products/ProductForm.tsx](../../../components/products/ProductForm.tsx), usado por `app/(app)/products/new/page.tsx` e `app/(app)/products/[id]/edit/page.tsx`.
- **impact** — campos pareados (ex.: Emoji do produto) cortavam texto do placeholder ("Busque: cer..." em vez de "Busque: cerveja, pão, refri…") e labels quebravam em 2 linhas; o botão de salvar nunca aparecia visível no mobile, ficando atrás do menu inferior — usuário não conseguia concluir o cadastro sem rolar/adivinhar.
- **detection** — reporte visual do owner com 2 screenshots do formulário mobile.

## Root Cause

Dois mecanismos distintos no mesmo componente, sem relação de dependência entre si.

- **Bug 1 — campos cortados/desalinhados.** Trigger: renderizar o form em tela < 640px. Caminho faltoso: os 3 blocos de campos pareados usavam `grid grid-cols-2 gap-4` fixo desde a introdução do redesign de produto (0010F, commit `cfa9bfa`), sem breakpoint responsivo (`sm:`/`md:`) — sempre 2 colunas, mesmo em tela estreita. Dentro do `EmojiPicker` ([components/products/EmojiPicker.tsx:222-252](../../../components/products/EmojiPicker.tsx#L222-L252)), o ícone (36px) + `Input` + botão "Limpar" dividindo meia-coluna estreitava o espaço do placeholder até truncar. Por que os safeguards não pegaram: é regressão puramente de layout/responsividade, fora do alcance de typecheck/lint/testes unitários; nenhuma feature (0001F, 0010F, 0016F) documentou uma estratégia de grid responsivo para os pares de campos do form.
- **Bug 2 — botão salvar invisível.** Trigger: abrir o form em qualquer viewport mobile (onde o `BottomNav` é renderizado). Caminho faltoso: a barra fixa do botão salvar ([components/products/ProductForm.tsx:273](../../../components/products/ProductForm.tsx#L273) antes da correção) usava `fixed inset-x-0 bottom-0` sem `z-index`; o `BottomNav` ([components/layout/BottomNav.tsx:195](../../../components/layout/BottomNav.tsx#L195)) também é `fixed bottom-0` mas com `z-40` explícito. Como `z-index: auto` perde para qualquer `z-index` numérico do mesmo stacking context, o `BottomNav` sempre pintava por cima da barra de salvar, cobrindo-a por completo — não era intermitente, sempre acontecia no mobile. Por que os safeguards não pegaram: nenhuma feature documentou a convenção de offset/z-index para CTAs fixos coexistindo com o `BottomNav` (0010F introduziu o `BottomNav` mas não previu barras fixas de formulário sobre ele); é regressão visual sem cobertura de teste.

## Fix

- [components/products/ProductForm.tsx:177](../../../components/products/ProductForm.tsx#L177) e [:217](../../../components/products/ProductForm.tsx#L217) — `grid-cols-2` → `grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4` nos pares Código/Unidade e Estoque inicial/mínimo — empilha em telas estreitas, volta a ficar lado a lado a partir de `sm` (640px).
- [components/products/ProductForm.tsx:132-135](../../../components/products/ProductForm.tsx#L132-L135) — campo Emoji deixou de ser pareado com Categoria (agora linha própria) — elimina o aperto que cortava o placeholder do `EmojiPicker`.
- [components/products/ProductForm.tsx:273](../../../components/products/ProductForm.tsx#L273) — barra do botão salvar: `bottom-0` → `bottom-16 z-50 ... lg:bottom-0` — eleva a barra acima do `BottomNav` no mobile (altura ~64px) e garante prioridade de camada (`z-50` > `z-40` do `BottomNav`); no desktop (`lg:`) volta a `bottom-0`, onde o `BottomNav` não existe.
- [components/products/ProductForm.tsx:124](../../../components/products/ProductForm.tsx#L124) — `pb-24` → `pb-32 lg:pb-24` no form — compensa o botão elevado no mobile para não cobrir os últimos campos.
- [components/products/ProductForm.tsx:124](../../../components/products/ProductForm.tsx#L124) — `gap-6` → `gap-4` no espaçamento vertical entre blocos do form — pedido do owner para reduzir rolagem.
- [components/products/ProductForm.tsx:125-175](../../../components/products/ProductForm.tsx#L125-L175) — reordenação de campos a pedido do owner: Foto do produto → Emoji do produto → Nome → Categoria → Código de barras/Unidade → Estoque inicial/mínimo → cálculo de preço.

## Verification

- [x] `npm run typecheck` — exit 0
- [x] `npm run lint` — 0 erros (só warnings pré-existentes de `<img>` e vars não usadas em `scripts/full-test.mjs`)
- [x] Verificação visual do owner via screenshots sucessivos no mobile, confirmando placeholder do Emoji não corta mais, campos empilham em telas estreitas, botão salvar visível acima do menu, e nova ordem de campos aplicada — owner confirmou "fico bom".

---

## Addendum: Additional Deliveries

| Delivery | Description | Justification |
|----------|-------------|----------------|
| Grade do caixa: 5→4 colunas | [components/caixa/CashierScreen.tsx](../../../components/caixa/CashierScreen.tsx) — `minmax(105px, 1fr)` → `minmax(130px, 1fr)` no grid de produtos (`auto-fill`), reduzindo a densidade de colunas. | Pedido do owner na mesma sessão, aproveitando o servidor já de pé para testar o hotfix. |
| Grade do caixa: mais vendidos no topo | Nova query [lib/services/sales/data.ts](../../../lib/services/sales/data.ts) `selectProductSalesQuantities` (soma `quantity` de `sale_items` por produto, histórico completo, tenant-scoped); novo [lib/services/products/product-service.ts](../../../lib/services/products/product-service.ts) `listProductsForCaixa` (ordena por quantidade vendida, empate mantém alfabética); nova action `listProductsForCaixaAction` em [app/(app)/products/actions.ts](../../../app/(app)/products/actions.ts); [app/(app)/caixa/page.tsx](../../../app/(app)/caixa/page.tsx) passa a usar a nova action. A lista de `/products` (admin) continua alfabética — só a grade do caixa reordena. | Pedido do owner na mesma sessão; owner escolheu implementar direto (sem discovery/plano formal) e período "todo o histórico" para o critério de mais vendido. |

**Impact:** Nenhuma mudança de escopo do bug original (form de produto); as duas entregas acima são melhorias independentes na tela do caixa, sem relação de causa com o bug corrigido neste hotfix.
