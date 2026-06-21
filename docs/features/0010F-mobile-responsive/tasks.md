---
id: 0010F
type: feature-tasks
slug: mobile-responsive
status: planned
created: 2026-06-21
updated: 2026-06-21
related: [0010F]
---

# Tasks: 0010F — Mobile Responsive

## Metadata

| Field | Value |
|-------|-------|
| Complexity | COMPLEX (16 tasks — pure UI/layout; no split needed: all tasks are atomic and independently deployable) |
| Total tasks | 16 |
| Services | frontend, test |

## Requirements Coverage

- [x] RF01 — Em viewport `< 1024px`, sidebar some e bottom nav aparece
- [x] RF02 — Em viewport `≥ 1024px`, sidebar visível e bottom nav ausente
- [x] RF03 — Bottom nav exibe 5 itens primários com rotas corretas
- [x] RF04 — Item "Mais" abre drawer com 4 itens secundários
- [x] RF05 — Item ativo na bottom nav tem destaque visual indigo
- [x] RF06 — AppTopBar exibe título em todos os viewports
- [x] RF07 — `/caixa` mobile exibe tabs Produtos/Carrinho com badge
- [x] RF08 — Tab Produtos em `/caixa` mobile tem grade com busca
- [x] RF09 — Tab Carrinho em `/caixa` mobile tem itens, total e Cobrar/Limpar
- [x] RF10 — Todas as rotas renderizam sem overflow horizontal em 375px
- [x] RNF01 — Bottom nav tem `padding-bottom: env(safe-area-inset-bottom)`
- [x] RNF02 — Cada item da bottom nav tem área de toque mínima de 44×44px
- [x] RNF03 — Em `/caixa` mobile, teclado virtual não empurra botão Cobrar para fora do viewport
- [x] RN01 — Zero mudanças em server actions, services, schema ou banco
- [x] RN02 — AppSidebar e BottomNav nunca aparecem simultaneamente
- [x] RN03 — Auth em `layout.tsx` permanece Server Component
- [x] RN04 — Estado do carrinho preservado ao alternar tabs em `/caixa`
- [x] RN05 — Nenhum teste existente quebra

## TDD

- [x] T-TEST-01 BottomNav: renders, hrefs, active state, drawer, RN01/RN02 — `components/layout/__tests__/BottomNav.test.tsx`
- [x] T-TEST-02 CashierScreen mobile: tabs, badge, cart preservation, RN01 — `components/caixa/__tests__/CashierScreen.mobile.test.tsx`

## Execution

- [x] T03 Create BottomNav Client Component with 5 primary items
  - Service: frontend
  - Files: `components/layout/BottomNav.tsx`
  - Deps: T-TEST-01
  - Verify: `npm run typecheck`

- [x] T04 Update shell layout for responsive sidebar and BottomNav
  - Service: frontend
  - Files: `app/(app)/layout.tsx`
  - Deps: T03
  - Verify: DevTools 375px — sidebar hidden, BottomNav visible; 1024px — reverse

- [x] T05 Wrap AppSidebar aside in `hidden lg:flex` div
  - Service: frontend
  - Files: `components/layout/AppSidebar.tsx`
  - Deps: T04
  - Verify: DevTools 375px — sidebar absent; 1024px — sidebar present

- [x] T06 Add safe-area-inset CSS var and viewport-fit=cover meta
  - Service: frontend
  - Files: `app/globals.css`, `app/layout.tsx`
  - Deps: -
  - Verify: DevTools iPhone X — BottomNav gap above home bar visible

- [x] T07 Verify AppTopBar title visibility with safe-area top padding
  - Service: frontend
  - Files: `components/layout/AppTopBar.tsx`
  - Deps: T06
  - Verify: DevTools 375px — page title visible and unclipped in elements panel

- [x] T08 CashierScreen — add mobileTab state and tab bar (lg:hidden)
  - Service: frontend
  - Files: `components/caixa/CashierScreen.tsx`
  - Deps: T-TEST-02
  - Verify: DevTools 375px — tab bar visible with Produtos and Carrinho buttons

- [x] T09 CashierScreen — CSS-hide panels by tab; add cart badge
  - Service: frontend
  - Files: `components/caixa/CashierScreen.tsx`
  - Deps: T08
  - Verify: Switch tabs — only active panel visible; badge shows cart item count

- [x] T10 Responsive padding — estoque, comandas, settings pages
  - Service: frontend
  - Files: `app/(app)/estoque/page.tsx`, `app/(app)/comandas/page.tsx`, `app/(app)/settings/page.tsx`
  - Deps: -
  - Verify: DevTools 375px — each page zero horizontal overflow; `scrollWidth === clientWidth` on `<html>`

- [x] T11 Responsive padding — lucro, financeiro/clientes, financeiro/receber pages
  - Service: frontend
  - Files: `app/(app)/lucro/page.tsx`, `app/(app)/financeiro/clientes/page.tsx`, `app/(app)/financeiro/receber/page.tsx`
  - Deps: -
  - Verify: DevTools 375px — each page zero horizontal overflow

- [x] T12 Responsive padding — financeiro/pagar, products/new, products/[id]/edit pages
  - Service: frontend
  - Files: `app/(app)/financeiro/pagar/page.tsx`, `app/(app)/products/new/page.tsx`, `app/(app)/products/[id]/edit/page.tsx`
  - Deps: -
  - Verify: DevTools 375px — each page zero horizontal overflow

- [x] T13 Responsive padding — estoque/[id] page
  - Service: frontend
  - Files: `app/(app)/estoque/[id]/page.tsx`
  - Deps: -
  - Verify: DevTools 375px — page zero horizontal overflow

- [x] T14 Responsive grid collapse — vendas and TodaySalesList stat cards
  - Service: frontend
  - Files: `app/(app)/vendas/page.tsx`, `components/caixa/TodaySalesList.tsx`
  - Deps: -
  - Verify: DevTools 375px — 1 column; 768px — 2 columns; 1024px — 3 columns

- [x] T15 Responsive grid collapse — financeiro/caixa stat cards
  - Service: frontend
  - Files: `app/(app)/financeiro/caixa/page.tsx`
  - Deps: -
  - Verify: DevTools 375px — 1 column; 768px — 2 columns

- [x] T16 Responsive products page — header flex-col and table overflow-x-auto
  - Service: frontend
  - Files: `app/(app)/products/page.tsx`
  - Deps: -
  - Verify: DevTools 375px — header stacks vertically; table scrolls horizontally without page overflow

## Acceptance Checklist

- [x] `BottomNav.tsx` is `'use client'` and renders exactly 5 primary buttons (RF03)
- [x] BottomNav hrefs: Caixa → `/caixa`, Comandas → `/comandas`, Produtos → `/products`, Financeiro → `/financeiro/caixa` (RF03)
- [x] "Mais" button toggles drawer with Vendas, Estoque, Lucro, Configurações links (RF04)
- [x] Active BottomNav item has indigo color class when pathname matches via `usePathname()` + `startsWith()` (RF05)
- [x] Each BottomNav button has `min-h-[44px] min-w-[44px]` touch target classes (RNF02)
- [x] BottomNav root element has `padding-bottom: env(safe-area-inset-bottom)` style (RNF01)
- [x] BottomNav has `className="lg:hidden"` (fixed, not conditional render) (RF01, RN02)
- [x] `app/(app)/layout.tsx` sidebar wrapper (`AppSidebar`) is inside `hidden lg:flex` div in `AppSidebar.tsx` (RF02, RN02)
- [x] `app/(app)/layout.tsx` `<main>` has `pb-16 lg:pb-0` class for BottomNav clearance (RF01)
- [x] `app/(app)/layout.tsx` root div has `flex-col lg:flex-row` (RF01, RF02)
- [x] `app/(app)/layout.tsx` auth (`getAuthUser()`) remains in Server Component scope (RN03)
- [x] `AppTopBar.tsx` title visible and unclipped at 375px viewport width (RF06)
- [x] `app/globals.css` includes `env(safe-area-inset-bottom)` CSS custom property (RNF01)
- [x] `app/layout.tsx` viewport metadata includes `viewport-fit=cover` (RNF01)
- [x] `CashierScreen.tsx` has `mobileTab: 'products' | 'cart'` state initialized to `'products'` (RF07)
- [x] CashierScreen tab bar has `className="flex lg:hidden"` (always in DOM, CSS-hidden on desktop) (RF07, RN04)
- [x] CashierScreen product panel is CSS-visible when `mobileTab === 'products'` OR on lg viewport (RF08)
- [x] CashierScreen cart panel is CSS-visible when `mobileTab === 'cart'` OR on lg viewport (RF09)
- [x] Cart badge on tab displays `cart.items.length` from `useCart()` (RF07)
- [x] Cart footer (Cobrar button) has `flex-shrink-0` to resist virtual keyboard compression (RNF03)
- [x] Cart items area above Cobrar has `overflow-y-auto` to scroll independently (RNF03)
- [x] Neither `BottomNav.tsx` nor `CashierScreen.tsx` new code imports from `lib/services/`, `db/`, or `lib/actions/` (RN01)
- [x] `app/(app)/layout.tsx` new code imports no server actions, services, or DB modules (RN01)
- [x] All 11 pages receive `px-4 md:px-7` (or equivalent mobile-first padding) (RF10)
- [x] `vendas/page.tsx` and `TodaySalesList.tsx` grid changed to `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (RF10)
- [x] `financeiro/caixa/page.tsx` grid changed to `grid-cols-1 md:grid-cols-2` (RF10)
- [x] `products/page.tsx` header uses `flex-col md:flex-row`; table wrapped in `overflow-x-auto` container (RF10)
- [x] `npm test` exits 0 with no new failures after all changes (RN05)

## Validation Gates

- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
