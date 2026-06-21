---
id: CHG0011
type: changelog
date: 2026-06-21
created: 2026-06-21
updated: 2026-06-21
related: [0010F]
---

## TL;DR

Feature 0010F entregou responsividade mobile completa ao SAAS PDV.multi: sidebar oculta em < 1024px, BottomNav de 5 itens com drawer, tabs Produtos/Carrinho na tela `/caixa`, e layout responsivo em 14 rotas protegidas. Entregas adicionais fora do spec original: widget QTD pré-seleção no caixa, aba Notas a Receber (fiado), e impressão de cupom no browser. Todos os validation gates passaram (build, typecheck, lint, 312 testes). Review score: 8.5/10.

## Changes

**Spec core (RF01–RF10, RNF01–RNF03):**

- feat(layout): `app/(app)/layout.tsx` — wrapper `hidden lg:flex` na sidebar; `<BottomNav className="lg:hidden" />` no shell — {{doc:0010F}}
- feat(layout): `components/layout/BottomNav.tsx` — novo componente com 5 itens fixos (Caixa, Comandas, Produtos, Financeiro, Mais) + drawer (Vendas, Estoque, Lucro, Configurações); `padding-bottom: env(safe-area-inset-bottom)`; touch targets `min-h-[44px] min-w-[44px]` — {{doc:0010F}}
- feat(layout): `components/layout/AppSidebar.tsx` — wrapper `hidden lg:flex`; `isActive` corrigido para `/financeiro/clientes` + Clientes em NAV_SECONDARY — {{doc:0010F}}
- feat(layout): `components/layout/AppTopBar.tsx` — título visível via `TITLE_MAP` em todos os viewports — {{doc:0010F}}
- feat(css): `app/globals.css` — custom property `--safe-area-bottom`; `overflow-x-hidden` no body — {{doc:0010F}}
- feat(caixa): `components/caixa/CashierScreen.tsx` — tabs Produtos/Carrinho em mobile via CSS-hide (RN04); badge de quantidade no tab Carrinho; widget QTD pré-seleção (`preQty` state, reset a 1 após add); scroll container correto para teclado virtual (RNF03) — {{doc:0010F}}
- feat(pages): 13 rotas protegidas com `px-4 md:px-7`, grade collapsing e `overflow-x-hidden`: `/comandas`, `/estoque`, `/estoque/[id]`, `/financeiro/caixa`, `/financeiro/clientes`, `/financeiro/pagar`, `/financeiro/receber`, `/lucro`, `/products`, `/products/new`, `/products/[id]/edit`, `/settings`, `/vendas` — {{doc:0010F}}
- test(layout): `components/layout/__tests__/BottomNav.test.tsx` — 25 casos: RF01-RF09, RNF01-RNF03, drawer, isActive, acessibilidade — {{doc:0010F}}
- test(caixa): `components/caixa/__tests__/CashierScreen.mobile.test.tsx` — tabs, badge, estado de carrinho preservado entre tabs — {{doc:0010F}}

**Scope additions (fora do spec original — ver addendum em about.md):**

- feat(caixa): `components/caixa/CaixaShell.tsx` — novo shell client com tabs Caixa + Notas a Receber; Caixa tab CSS-hidden (RN04 preservado)
- feat(caixa): `app/(app)/caixa/page.tsx` — usa `CaixaShell` em vez de `CashierScreen` diretamente
- feat(caixa): `components/caixa/PaymentDialog.tsx` — step de sucesso universal para todos os métodos (dinheiro, cartão, pix, fiado); `printInBrowser()` com janela térmica 280px; label fiado neutro (`Confirmar — {name}`)
- feat(caixa): `app/(app)/caixa/receipt-actions.ts` — server action `getSaleReceiptAction` com RLS + duplo filtro `saleId + tenantId`; validação Zod UUID; retorna `ReceiptDto`
- feat(caixa): `components/caixa/TodaySalesList.tsx` — ajustes responsivos
- feat(comandas): `components/comandas/ComandasScreen.tsx` — ajustes responsivos

**Review corrections (code review automático):**

- fix(layout): `components/layout/BottomNav.tsx` — NAV_DRAWER revertido a 4 itens spec-conforme (Clientes removido — RF04); overlay com `role="button"`, `onKeyDown` Escape (WCAG 2.1 SC 2.1.1)
- fix(caixa): `app/(app)/caixa/receipt-actions.ts` — validação Zod `z.string().uuid()` adicionada ao `saleId`

**Infra:**

- chore(deploy): `scripts/deploy.sh` — script de deploy para Hetzner
- chore(config): `next.config.ts` — limpo (sem opções inválidas de `allowedOrigins`)
- chore(deps): `package.json` — sem dependências novas adicionadas

## Breaking

none

## Migration

none

## Quick Ref

```json
{"id":"0010F","domain":"mobile layout","touched":["components/layout/","components/caixa/","app/(app)/","app/"],"patterns":["responsive-breakpoint","bottom-navigation","tab-switching","css-hide","rls-server-action"],"keywords":["mobile","bottom-nav","responsive","caixa-tabs","BottomNav","sidebar","receipt-print"]}
```
