---
id: CHG0019
type: changelog
date: 2026-06-28
related: [0018F]
---

## TL;DR

Rebrand de "PDV.multi" para "PDV.ART.br" em todas as superfícies (root metadata, 6 páginas, sidebar, admin, recibo, manual — `grep "PDV.multi"` retorna 0). Login/signup ganham tema escuro com banner da marca (`background.webp`) à esquerda e formulário na faixa branca à direita; a sidebar passa a exibir o logo em imagem (`logo-full.webp` expandida / `logo-icon.webp` recolhida) no lugar do texto; admin e manual seguem com a marca em texto estilizado (sufixo `.ART` colorido). O recibo impresso usa o nome da loja do tenant (fallback "PDV.ART.br") com rodapé "via PDV.ART.br", lido sob RLS por tenant. Favicon próprio via `app/icon.png`. Logos otimizados para WebP (<100 KB). Pivots do owner na finalização: logo do header do caixa removido (RF03) e marca da sidebar virou imagem (RF04).

## Changes

- feat(brand): substituição "PDV.multi" → "PDV.ART.br" nas 12 superfícies — `app/layout.tsx` (root metadata), metadata de login/signup/auditoria/manual/perfil/usuários, `AppSidebar`, `app/(admin)/layout.tsx`, recibo e `components/manual/manual-data.ts`; sufixo `.ART` colorido (RN01)
- feat(auth): `app/(auth)/layout.tsx` em tema escuro — banner da marca (`public/background.webp`) à esquerda + formulário na faixa branca à direita; logo migrou dos forms (`LoginForm`/`SignupForm`) para o layout, acima do card; contraste WCAG AA (RNF02)
- feat(ui): `AppSidebar` exibe logo em imagem — `logo-full.webp` (expandida) / `logo-icon.webp` (recolhida) no lugar do texto estilizado (RF04, pivot owner)
- feat(receipt): `buildReceiptHtml` (`PaymentDialog.tsx`) usa `storeName || "PDV.ART.br"` como cabeçalho + rodapé "via PDV.ART.br" (RF05); `receipt-actions.ts` lê o nome da loja sob `withUserRls` pelo `ctx.tenantId`, fallback no client (RN02)
- fix(security): `escapeHtml` estendido a `item.name`/`item.unit`/`method` no template do recibo (`window.open` + `document.write`, same-origin) — antes só `storeName` era escapado (XSS)
- feat(favicon): `app/icon.png` (emblema, Next auto-detect) substitui o ícone padrão; removidos `app/favicon.ico` e `public/logo-light.webp` sem uso (RF06)
- perf(assets): logos otimizados para WebP <100 KB cada (dark 24,7 KB / light 43,2 KB) contra 1,1 MB / 1,5 MB originais (RNF01)
- test: `tests/0018F-rebrand-assets.test.ts` (T07–T10) valida assets WebP; `db/__tests__/receipt-store-name-rls.test.ts` (T02/T03b/T04) cobre RN02 com isolamento cross-tenant; `receipt-actions.test.ts` + `PaymentDialog.test.ts`
- test: gates verdes — typecheck 0 erros, lint 0 erros (9 warnings `<img>` pré-existentes), 502/502 testes (inclui RLS com DB), build com rota `/icon.png` registrada

## Out of Scope (entregas adicionais do owner)

Melhorias solicitadas durante a sessão, finalizadas na mesma branch:

- feat(products): `EmojiPicker.tsx` — busca/seleção de emoji por palavra-chave (pt-BR) no cadastro de produto (`ProductForm`) — *improvement*
- fix(ui): `QuantityInput` permite apagar o campo de estoque (não força 0); reescrito de `useEffect`+setState para reconciliação prop→state na renderização (corrige lint setState-in-effect) — *improvement*
- style(caixa): cards do caixa (`CashierScreen`) reduzidos ~30% para caber mais produtos por linha — *improvement*

## Breaking

- Nenhuma. Mudança de marca, assets e UI; sem alteração de schema ou contrato de dados. Recibos sem `storeName` recaem para "PDV.ART.br".

## Migration

- Nenhuma migração de banco. Deploy padrão (rebuild da imagem) serve os novos assets WebP e o favicon.

## Quick Ref

```json
{"id":"0018F","domain":"rebrand de marca (PDV.ART.br)","touched":["app/","app/(auth)/","app/(app)/caixa/","components/auth/","components/caixa/","components/layout/","components/manual/","components/products/","components/ui/","public/","db/__tests__/","tests/"],"patterns":["rebrand textual centralizado em metadata + componentes","logo responsivo por estado de collapse (full/emblema)","favicon via app/icon.png (Next auto-detect)","leitura de storeName sob RLS por tenant com fallback de marca","escapeHtml em campos de usuário no template de impressão (anti-XSS)"],"keywords":["rebrand","logo","favicon","PDV.ART.br","recibo","storeName","WebP","tema escuro","multi-tenant","WCAG"]}
```
