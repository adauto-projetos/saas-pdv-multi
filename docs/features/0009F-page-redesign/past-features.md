---
id: 0009F
type: past-features
slug: page-redesign
created: 2026-06-17
related: [0001F, 0002F, 0003F, 0004F, 0005F, 0006F, 0007F, 0008F]
---

# Past Features — 0009F Page Redesign

## Relationship Table

| Feature | Name | Relationship | Files Touched Relevant to Redesign |
|---|---|---|---|
| **0001F** | Produtos & Markup | `depends-on` | `/products/page.tsx`, `/products/new/page.tsx`, `/products/[id]/edit/page.tsx`, `/settings/page.tsx`; established `<div class="grid gap-6">` + `<h1 class="text-xl font-semibold">` as the base page pattern |
| **0002F** | Venda Rápida / Caixa | `depends-on` | `/caixa/page.tsx` → `<CashierScreen>` (full-height flex column); `/vendas/page.tsx`; `components/caixa/*` — most layout-dense screen |
| **0003F** | Estoque | `depends-on` | `/estoque/page.tsx`, `/estoque/[id]/page.tsx`; `components/estoque/*`; introduced `<section class="grid gap-3">` + `<h2 class="font-medium">` for sub-sections |
| **0004F** | Financeiro | `depends-on` | `/financeiro/caixa/page.tsx`, `/financeiro/clientes/page.tsx`, `/financeiro/receber/page.tsx`, `/financeiro/pagar/page.tsx`; 13 components in `components/financeiro/`; owns the 4-route sub-section under `/financeiro/*` |
| **0005F** | Lucro & Fechamento | `depends-on` | `/lucro/page.tsx`; `components/lucro/ProfitFilter.tsx`, `ProfitSummaryCard.tsx`; retrofitted `/financeiro/caixa` with `CashSessionPanel` |
| **0006F** | Comanda/Mesa | `depends-on` | `/comandas/page.tsx` → `<ComandasScreen>`; 7 components in `components/comandas/`; most complex page (card grid + history) |
| **0007F** | Impressao | `parallel` | Adds `<ReprintButton>` to existing page views; no page layouts changed; prints from within current components |
| **0008F** | Sidebar Layout | `depends-on` | `app/(app)/layout.tsx` (rewritten to sidebar shell); `components/layout/AppSidebar.tsx`; `components/layout/AppTopBar.tsx`; `app/globals.css` (`--pdv-sidebar: #0d1526`); establishes the outer shell 0009F must work within |

## Per-Feature Notes

### 0001F — Produtos & Markup
**Pages:** `/products`, `/products/new`, `/products/[id]/edit`, `/settings`

Established the canonical page scaffold used by all subsequent features:
```tsx
<div className="grid gap-6">
  <div className="flex items-center justify-between">
    <h1 className="text-xl font-semibold">Título</h1>
    <ActionButton />
  </div>
  {/* content */}
</div>
```
`/settings/page.tsx` constrains itself with `max-w-sm` — a local override, not layout-level. This is the only page with a self-imposed max-width.

### 0002F — Venda Rápida / Caixa
**Pages:** `/caixa`, `/vendas`

`/caixa/page.tsx` is the simplest possible page: it renders only `<CashierScreen />` with no wrapper div. All layout is inside `CashierScreen`, which is a large Client Component. The design reference (`PDVApp.jsx`, `CaixaPage`) uses `height: calc(100vh - 52px)` — a full-height flex column with overflow control. This is the most sensitive screen for height/overflow changes.

`/vendas/page.tsx` uses the standard `<div class="grid gap-6">` pattern with a single `<h1>` and `<TodaySalesList>`.

### 0003F — Estoque
**Pages:** `/estoque`, `/estoque/[id]`

Introduced the `<section class="grid gap-3">` + `<h2 class="font-medium">` sub-section pattern now used across multiple pages:
```tsx
<div className="grid gap-8">
  <h1 className="text-xl font-semibold">...</h1>
  <section className="grid gap-3">
    <h2 className="font-medium">Nova movimentação</h2>
    ...
  </section>
  <section className="grid gap-3">
    <h2 className="font-medium">Estoque baixo</h2>
    ...
  </section>
</div>
```
`ProductsTable` in `components/products/` was retrofitted here to highlight negative stock rows.

### 0004F — Financeiro
**Pages:** `/financeiro/caixa`, `/financeiro/clientes`, `/financeiro/receber`, `/financeiro/pagar`

Biggest surface area of any single feature: 4 routes + 13 components. All 4 pages follow the `<div class="grid gap-8">` + section pattern. `/financeiro/caixa` is the heaviest page (turno, saldo, movimentação, extrato, histórico de turnos). Sub-navigation between the 4 Financeiro routes is done by links within pages — no shared tab component.

`components/financeiro/` components include dialogs (`CashMovementDialog`, `PaymentDialog`), lists (`CashStatement`, `ReceivableList`, `PayableList`), and forms (`CustomerForm`, `NewReceivableForm`, `NewPayableForm`).

### 0005F — Lucro & Fechamento
**Pages:** `/lucro`; retrofit of `/financeiro/caixa`

`/lucro/page.tsx` uses `<div class="grid gap-8">` with a `<ProfitFilter>` Client Component that controls the period. Added `CashSessionPanel`, `OpenSessionDialog`, `CloseSessionDialog`, `SessionHistory` to `/financeiro/caixa`.

### 0006F — Comanda/Mesa
**Pages:** `/comandas`

`/comandas/page.tsx` delegates entirely to `<ComandasScreen>` (Client Component). `ComandasScreen` uses `<div class="grid gap-8">` with a header row (`flex items-center justify-between`) for the "+ Abrir comanda" button, a card grid of open comandas, and a `<ComandaHistory>` table at the bottom. The design reference places action buttons in the top bar for this page — this creates a cross-cutting concern to resolve in 0009F.

### 0007F — Impressao
**Relationship: parallel — no page layout changes**

Adds `<ReprintButton>` components that can be embedded in existing list rows. No new pages; no changes to page structure or layout classes. Safe to ignore for layout redesign purposes.

### 0008F — Sidebar Layout (direct predecessor)
**Files:** `app/(app)/layout.tsx`, `components/layout/AppSidebar.tsx`, `components/layout/AppTopBar.tsx`, `app/globals.css`

This is the shell 0009F pages must fit into. Key facts:
- Outer shell: `<div class="flex h-screen overflow-hidden bg-slate-100">` — slate-100 body background
- Sidebar: fixed 220px, `#0d1526`, Client Component
- Top bar: 52px white bar, title from pathname map, no action buttons (left to page content)
- Content area: `<main class="flex-1 overflow-x-hidden overflow-y-auto">` — scrolls independently; no max-width set
- CSS var: `--pdv-sidebar: #0d1526` in `globals.css`
- `max-w-5xl` removed — pages now have full available width (viewport width minus 220px sidebar)

## Current Page Scaffold Patterns

Two patterns cover all existing pages:

**Pattern A — Standard (9 of 14 pages)**
```tsx
<div className="grid gap-6|8">
  <h1 className="text-xl font-semibold">Title</h1>
  {/* optional: <section class="grid gap-3"><h2>...</h2>...</section> */}
  {/* content */}
</div>
```
Pages: `/products`, `/vendas`, `/estoque`, `/estoque/[id]`, `/financeiro/caixa`, `/financeiro/clientes`, `/financeiro/receber`, `/financeiro/pagar`, `/lucro`, `/settings`

**Pattern B — Delegate-to-client (2 pages)**
```tsx
// page.tsx just renders a Client Component with no wrapper div
<CashierScreen />       // /caixa
<ComandasScreen ... />  // /comandas
```
These pages have all layout inside the root Client Component.

## Design Decisions Already Made (Constraints for 0009F)

| Decision | Where Set | Constraint |
|---|---|---|
| Shell is `flex h-screen overflow-hidden bg-slate-100` | `app/(app)/layout.tsx` (0008F) | Pages render inside `<main class="flex-1 overflow-x-hidden overflow-y-auto">` — 0009F cannot change outer shell |
| Sidebar 220px fixed, always visible | `AppSidebar.tsx` (0008F) | Content area is viewport − 220px; no mobile layout |
| Top bar 52px, title only — no action buttons | `AppTopBar.tsx` (0008F) | Per 0008F out-of-scope: "Botões de ação de página no top bar (permanecem dentro das páginas)". Design ref shows buttons in top bar for Produtos and Comandas — this is a conflict to revisit in 0009F |
| CSS var `--pdv-sidebar: #0d1526` | `globals.css` (0008F) | Color token established; do not use shadcn `--sidebar-*` vars |
| No `max-w-*` at layout level | `app/(app)/layout.tsx` (0008F) | Pages can use full available width; `/settings` still constrains itself to `max-w-sm` locally |
| shadcn/ui style: `base-nova` on `@base-ui/react` (not Radix) | project config (pre-0001F) | Do not install shadcn `<Sidebar>` or other Radix-based components |
| Tailwind v4, no `tailwind.config.js` | project config (pre-0001F) | Custom colors via CSS vars in `globals.css` or arbitrary Tailwind values (`bg-[#...]`) |
| Values in centavos (integer) | CLAUDE.md convention | Display layer must format centavos → BRL; `centsToBRL()` helper already in `lib/format/money` |

## Design Reference Relevance (PDVApp.jsx)

The reference (`docs/design/PDVApp.jsx.reference`) defines fully-designed pages for all 8 modules. Key per-page specs:

| Page | Reference location | Notable design elements |
|---|---|---|
| Caixa | `CaixaPage` (line ~152) | `height: calc(100vh - 52px)`, full-height flex column, card-based cart with grid columns `1fr 130px 110px 110px`, bottom bar with payment buttons + total |
| Vendas | `VendasPage` in reference | Table layout with columns: hora, itens, pagamento, total |
| Produtos | `ProdutosPage` in reference | Table with search/filter, "+ Novo produto" button in top bar |
| Estoque | `EstoquePage` in reference | Card-style low-stock list |
| Comandas | `ComandasPage` in reference | Card grid for open comandas, "+ Abrir comanda" button in top bar |
| Financeiro | `FinanceiroPage` in reference | Caixa sub-tab with balance card + statement table |
| Lucro | `LucroPage` in reference | Summary cards (faturamento/custo/lucro/margem%) + filter |
| Configurações | `ConfigPage` in reference | Simple form layout |

Shared style tokens defined in `PDVApp.jsx` (`CARD`, `INPUT_BASE`, `BTN_GREEN`, `BTN_GHOST`, `TH_BASE`, `TD_BASE`) are the visual baseline 0009F should match or translate into Tailwind equivalents.

## Open Conflicts / Decisions for 0009F

1. **Action buttons in top bar vs. in-page**: 0008F explicitly left buttons inside pages. The design reference places "+ Novo produto" (Produtos) and "+ Abrir comanda" (Comandas) in the top bar. 0009F must decide: (a) keep buttons in-page below the top bar, or (b) extend `AppTopBar` to accept a right-slot prop from each page (requires layout↔page coupling).

2. **Caixa full-height**: `CashierScreen` needs `height: calc(100vh - 52px)` to fill the content area without scrolling. The current `<main class="flex-1 overflow-y-auto">` wraps it — if `CashierScreen` sets its own height to fill the container, it should use `h-full` rather than `calc(100vh - 52px)` to avoid double-accounting.

3. **Financeiro sub-navigation**: The 4 `/financeiro/*` routes are separate pages, currently navigated via in-page links. The design reference shows a single tabbed "Financeiro" page. 0009F may introduce tab navigation within the Financeiro section or leave them as separate pages.

4. **Card visual style**: Current pages use minimal styling (plain divs, `grid gap-*`). The design reference uses `CARD = { background:'#fff', borderRadius:12, border:'1.5px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.03)' }`. 0009F must decide how broadly to apply card wrappers across page sections.
