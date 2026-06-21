---
id: 0010F
type: feature-plan
slug: mobile-responsive
status: planned
created: 2026-06-21
updated: 2026-06-21
related: [0010F]
---

# Plan: 0010F — Mobile Responsive

## TL;DR

Plano de implementação para tornar o SAAS PDV.multi totalmente utilizável em dispositivos móveis. Feature é exclusivamente UI/layout — RN01 proíbe qualquer mudança em server actions, services ou banco. Resultado: um novo `BottomNav` Client Component, ajustes de breakpoint no shell, refactor de tabs no `/caixa`, e padronização de padding/grid em 13 páginas.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Frontend](#frontend)
- [Risks](#risks)
- [Validation](#validation)
- [Test Specification](#test-specification)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Context

Ver `{{doc:0010F}}` (about.md) para problem statement, users, scope completo e architecture decisions originais. Foundations: `{{doc:0008F}}` criou o shell (AppSidebar, AppTopBar, layout.tsx) que esta feature torna responsivo; `{{doc:0009F}}` criou o visual das páginas (PageCard, StatCard) que precisam de padding/grid mobile.

## Architecture Decisions

| Decisão | Rationale | Alternativa rejeitada | Constraint |
|---|---|---|---|
| `hidden lg:flex` / `lg:hidden` CSS-only | SSR-safe — sem JS breakpoint detection; Tailwind v4 `lg:` = 1024px | `window.innerWidth` — falha em SSR, hydration mismatch | Shell tem Server Component (auth) |
| Wrapper div na sidebar | `AppSidebar.tsx` tem `display: flex` inline — `className` conflitaria com inline style | Adicionar `className` direto na `<aside>` | Inline styles intocáveis (RN01) |
| CSS-hide (não conditional render) no CashierScreen | Cart state deve persistir entre tabs (RN04) — unmount resetaria useCart | Conditional render — desmonta panel, reseta carrinho | RN04 |
| `drawerOpen` local useState no BottomNav | Estado de drawer é UI efêmero, não compartilhado | Zustand store — overhead desnecessário | RN01 (UI-only) |
| lucide-react (existente) | Já importado em AppSidebar; zero nova dependência | Nova lib de ícones | Simplicidade / escopo |

## Frontend

### Shell Layout Change

**Atual** (`app/(app)/layout.tsx`):
```
<div className="flex h-screen overflow-hidden">
  <AppSidebar />
  <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">{children}</main>
</div>
```

**Target:**
1. Root div: adicionar `flex-col lg:flex-row`
2. `<AppSidebar>` envolto em `<div className="hidden lg:flex">`
3. `<main>`: adicionar `pb-16 lg:pb-0` (espaço para BottomNav fixo)
4. Após `<main>`: `<BottomNav className="lg:hidden" />` (position:fixed, fora do flow)

### Components

```json
{"BottomNav":{"location":"components/layout/BottomNav.tsx","type":"'use client'","purpose":"5 itens primários (Caixa /caixa, Comandas /comandas, Produtos /products, Financeiro /financeiro/caixa, Mais) + drawer 4 secundários (Vendas /vendas, Estoque /estoque, Lucro /lucro, Configurações /settings). Active via usePathname() com pathname.startsWith(). position:fixed bottom:0. padding-bottom:env(safe-area-inset-bottom). min-h-[44px] min-w-[44px] por botão.","state":"drawerOpen: boolean (useState)","icons":"lucide-react — reusar imports de AppSidebar.tsx"},"AppSidebar":{"location":"components/layout/AppSidebar.tsx","type":"modify","purpose":"Envolver <aside> em <div className='hidden lg:flex'>; inline styles internos intocados"},"TodaySalesList":{"location":"components/caixa/TodaySalesList.tsx","type":"modify","purpose":"grid-cols-3 → grid-cols-1 md:grid-cols-2 lg:grid-cols-3"},"Cart":{"location":"components/caixa/Cart.tsx","type":"modify","purpose":"Nenhuma mudança necessária — width:72 aceitável; tab container define width:100%"}}
```

### CashierScreen Tab Logic

- `mobileTab: 'products' | 'cart'` — `useState('products')`
- Tab bar: `className="flex lg:hidden"` (sempre no DOM, CSS-hide em desktop — SSR-safe)
- Painel produtos: visível se `mobileTab === 'products'` OU `lg:flex` (desktop sempre visível)
- Painel carrinho: visível se `mobileTab === 'cart'` OU `lg:flex` (desktop sempre visível)
- Badge: `cart.items.length` de `useCart()` — hook chamado uma vez no topo; tabs nunca desmontam (RN04)
- Keyboard guard (RNF03): footer do carrinho com Cobrar usa `flex-shrink-0`; items acima em `overflow-y-auto`

### Pages

| Rota | Mudança | Complexidade |
|---|---|---|
| /caixa | CashierScreen: tabs móveis Produtos/Carrinho; desktop inalterado | L |
| /vendas, /lucro | `grid-cols-3` → `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | S |
| /products | Header `flex-col md:flex-row`; tabela em `overflow-x-auto` | S |
| /financeiro/caixa | `grid-cols-2` → `grid-cols-1 md:grid-cols-2` | M |
| /products/new, /products/[id]/edit, /estoque, /estoque/[id], /comandas, /financeiro/clientes, /financeiro/receber, /financeiro/pagar, /settings | `px-4 md:px-7` padding | S each |
| globals.css | `env(safe-area-inset-bottom)` CSS var; `app/layout.tsx` viewport-fit=cover | S |

### Hooks

```json
{"usePathname":{"source":"next/navigation","use":"BottomNav active state"},"useCart":{"source":"components/caixa/use-cart (existing)","use":"badge count no tab Carrinho"},"useState(mobileTab)":{"source":"react","use":"controle de tab ativa no CashierScreen"},"useState(drawerOpen)":{"source":"react","use":"drawer Mais no BottomNav"}}
```

## Risks

| Risco | Prob | Impacto | Mitigação |
|---|---|---|---|
| Tailwind v4 purge remove `hidden lg:flex` (não usada antes) | Baixa | Crítico | Usar strings de classe estáticas (não dinâmicas concatenadas) |
| `env(safe-area-inset-bottom)` no-op sem `viewport-fit=cover` | Média | Alto | Adicionar `viewport-fit=cover` ao metadata do `app/layout.tsx`; verificar T45 |
| Scanner de código de barras perde foco ao trocar tab | Baixa | Médio | Input de barcode está no painel Produtos; retorna ao foco ao voltar para a tab |
| Conflito TypeScript no `NavItem` type | Baixa | Baixo | Tipo interno ao `BottomNav.tsx`; typecheck gate detecta |

## Validation

Gates (do CLAUDE.md):
```json
{"typecheck":"npm run typecheck","lint":"npm run lint","test":"npm test","build":"npm run build"}
```

QA Manual mínimo:
- 375×667: zero overflow horizontal nas 14 rotas; bottom nav funcional; tabs do caixa funcionam
- 1024×768: sidebar visível; bottom nav ausente; layout duas colunas do caixa intacto
- iPhone X (375×812): safe-area-inset-bottom correto; home bar não sobreposta

---

## Test Specification

### Contract Tests

| ID | Test Case | Área | RF/RN | Input | Expected Output | Verificar |
|----|-----------|------|-------|-------|-----------------|-----------|
| T01 | BottomNav renders 5 primary nav items | frontend | RF03 | Render `<BottomNav />` | 5 botões: Caixa, Comandas, Produtos, Financeiro, Mais | `getAllByRole('button').toHaveLength(5)` |
| T02–T05 | BottomNav hrefs corretos (Caixa, Comandas, Produtos, Financeiro) | frontend | RF03 | Render + inspect hrefs | `/caixa`, `/comandas`, `/products`, `/financeiro/caixa` | `.closest('[href]')` em cada item |
| T06–T09 | Active item em indigo (pathname exato + startsWith) | frontend | RF05 | Mock `usePathname` → cada rota | Item correto com classe indigo | Mock `usePathname`; assert active class |
| T10–T15 | Drawer: fechado por default; abre com "Mais"; 4 itens corretos | frontend | RF04 | Click "Mais" | Drawer visível com Vendas, Estoque, Lucro, Configurações | `queryByText('Vendas')` null antes; present depois |
| T16–T20 | CashierScreen: tab bar presente; default Produtos; switch Carrinho; badge count | frontend | RF07 | Render + interações | Tab state correto; badge mostra `cart.items.length` | `getByText`, `toHaveClass`, mock useCart |
| T21 | Produtos tab tem search bar | frontend | RF08 | Render, tab Produtos ativa | Input de busca presente | `getByRole('searchbox')` |
| T22–T23 | Carrinho tab tem Cobrar e Limpar | frontend | RF09 | Render, switch Carrinho | Ambos os botões no DOM | `getByRole('button', {name: /cobrar/i})` |
| T24 | Cart state preservado entre tabs | frontend | RN04 | Add 2 itens; switch tabs; voltar | `cart.items.length === 2` | Mock useCart; assert count após round-trip |
| T25–T27 | Classes `lg:hidden` / `hidden lg:flex` corretas; mutuamente exclusivas | frontend | RN02 | Inspect classNames | BottomNav tem `lg:hidden`; sidebar wrapper tem `hidden lg:flex` | `toHaveClass` |
| T28–T30 | Zero imports de server actions/services/DB em BottomNav, CashierScreen (novo código), layout.tsx | frontend | RN01 | Static analysis | Nenhum import de `lib/services`, `db/`, `lib/actions` | grep dos arquivos |
| T31–T34 | Breakpoint 1023px/1024px: sidebar/nav swap | manual | RF01/RF02 | DevTools 1023px e 1024px | Display correto em cada viewport | Elements panel: computed display |
| T35–T36 | AppTopBar title visível em todos os viewports | manual | RF06 | DevTools 375px e 1280px | Título visível sem clip | Elements panel |
| T37–T44 | Zero overflow horizontal nas 8 rotas em 375px | manual | RF10 | DevTools 375×667 por rota | `scrollWidth === clientWidth` | Elements → html |
| T45 | safe-area-inset-bottom correto | manual | RNF01 | DevTools iPhone X viewport | Gap entre nav e home bar | Computed `padding-bottom` |
| T46 | Touch targets ≥44×44px | manual | RNF02 | DevTools inspector em cada botão BottomNav | `width ≥ 44, height ≥ 44` | Computed panel |
| T47 | Cobrar visível com teclado virtual aberto | manual | RNF03 | DevTools 375px; simular keyboard; tab Carrinho | Cobrar permanece visível | Reduzir viewport height para ~400px |
| T48–T50 | Caixa mobile: Produtos + busca; Carrinho + total; desktop: sem tabs | manual | RF07/RF08/RF09 | DevTools 375px e 1280px | Layouts corretos em cada viewport | Percorrer UI manualmente |

### Coverage vs Requirements

| RF/RN/RNF | Testes | Coberto? |
|-----------|--------|----------|
| RF01 | T31, T33, T34 | YES |
| RF02 | T32, T33, T34, T50 | YES |
| RF03 | T01–T05 | YES |
| RF04 | T10–T15 | YES |
| RF05 | T06–T09 | YES |
| RF06 | T35, T36 | YES |
| RF07 | T16–T20, T48, T50 | YES |
| RF08 | T21, T48 | YES |
| RF09 | T22–T23, T49 | YES |
| RF10 | T37–T44 | YES |
| RNF01 | T45 | YES |
| RNF02 | T46 | YES |
| RNF03 | T47 | YES |
| RN01 | T28–T30 | YES |
| RN02 | T25–T27, T31, T32 | YES |
| RN03 | T30 | YES |
| RN04 | T24 | YES |
| RN05 | `npm test` gate | YES |

### Test File Mapping

| Área | Arquivo | IDs |
|------|---------|-----|
| frontend (Vitest) | `components/layout/__tests__/BottomNav.test.tsx` | T01–T15, T25–T28 |
| frontend (Vitest) | `components/caixa/__tests__/CashierScreen.mobile.test.tsx` | T16–T24, T29–T30 |
| manual (DevTools) | Chrome DevTools 375×667 | T31–T50 |

---

## Implementation Order

1. `components/layout/BottomNav.tsx` — criar primeiro (independente)
2. `app/(app)/layout.tsx` — shell responsivo + integrar BottomNav
3. Padding `px-4 md:px-7` nas 11 páginas + grids responsivos
4. `components/caixa/CashierScreen.tsx` — tabs (maior risco, defer para último)
5. `app/globals.css` + `app/layout.tsx` meta — safe-area-inset

## Quick Reference

| Pattern | Buscar em |
|---|---|
| Client Component com usePathname | `components/layout/AppTopBar.tsx` |
| Sidebar active state logic | `components/layout/AppSidebar.tsx` (isActive pattern) |
| useCart hook | `components/caixa/use-cart.ts` |
| Shell layout atual | `app/(app)/layout.tsx` |
| CashierScreen layout inline styles | `components/caixa/CashierScreen.tsx` linhas 123–643 |
| lucide-react icons disponíveis | `components/layout/AppSidebar.tsx` imports |
