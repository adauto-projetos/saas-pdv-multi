---
id: 0009F
type: discovery
slug: page-redesign
created: 2026-06-17
---

# Discovery — 0009F Page Redesign

## 1. Design Patterns (from PDVApp.jsx)

### 1.1 Visual Tokens

| Token | Value | Tailwind equivalent |
|---|---|---|
| `CARD` background | `#fff` | `bg-white` |
| `CARD` border | `1.5px solid #e5e7eb` | `border border-[#e5e7eb]` (or `border-gray-200`) |
| `CARD` border-radius | `12px` | `rounded-xl` |
| `CARD` shadow | `0 1px 4px rgba(0,0,0,0.03)` | `shadow-sm` (close enough) |
| `INPUT_BASE` border | `1.5px solid #e5e7eb` | `border border-[#e5e7eb]` |
| `INPUT_BASE` radius | `8px` | `rounded-lg` |
| `INPUT_BASE` padding | `10px 14px` | `px-3.5 py-2.5` |
| `INPUT_BASE` font size | `13px` | `text-[13px]` |
| `BTN_GREEN` background | `#16a34a` | `bg-green-600` |
| `BTN_GREEN` radius | `8px` | `rounded-lg` |
| `BTN_GREEN` padding | `10px 20px` | `px-5 py-2.5` |
| `BTN_GREEN` font size | `13px font-semibold` | `text-[13px] font-semibold` |
| `BTN_GHOST` background | `#fff` | `bg-white` |
| `BTN_GHOST` border | `1.5px solid #e5e7eb` | `border border-gray-200` |
| `BTN_GHOST` color | `#6b7280` | `text-gray-500` |
| `TH_BASE` font size | `10px uppercase 0.5px ls` | `text-[10px] uppercase tracking-[0.5px]` |
| `TH_BASE` color | `#6b7280` | `text-gray-500` |
| `TH_BASE` padding | `10px 20px` | `px-5 py-2.5` |
| `TD_BASE` font size | `13px` | `text-[13px]` |
| `TD_BASE` color | `#374151` | `text-gray-700` |
| `TD_BASE` padding | `12px 20px` | `px-5 py-3` |
| Page padding | `24px 28px` | `p-6 px-7` (or `px-7 py-6`) |
| Page gap | `gap:18` or `gap:16` | `gap-4` or `gap-5` |
| Page bg | `#f1f5f9` | `bg-slate-100` (already in layout) |
| Section label | `10px uppercase 0.7px ls #9ca3af` | `text-[10px] uppercase tracking-[0.7px] text-gray-400 font-semibold` |
| Large value (total/lucro) | `28-38px font-bold #111827` | `text-3xl font-bold text-gray-900` |
| Green value (money positive) | `#16a34a` | `text-green-600` |
| Red value (money negative/zero stock) | `#ef4444` | `text-red-500` |
| Muted text | `#6b7280` | `text-gray-500` |
| Primary text | `#111827` | `text-gray-900` |
| Card header text | `14px font-semibold #111827` | `text-sm font-semibold text-gray-900` |
| Badge green | `bg:#dcfce7 color:#15803d` | `bg-green-100 text-green-700` |
| Table bg stripe | `#f9fafb` | `bg-gray-50` |
| Table row divider | `1px solid #f3f4f6` | `border-t border-gray-100` |

### 1.2 Card Pattern

All content sections in the reference are wrapped in `CARD`:
```
bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden
```
Cards have an optional header row inside:
```
px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-900
```
Cards with forms have inner body padding: `p-5`

### 1.3 Payment Button Style (CaixaPage)

Three colored pill buttons (Dinheiro=green, Cartão=indigo, Pix=cyan) with:
- active: darker bg, white border `2px solid rgba(255,255,255,0.35)`, font-bold, shadow
- inactive: base color, transparent border, opacity 0.78

### 1.4 Tab Switcher Style

`display:inline-flex gap:3 bg:#f3f4f6 rounded-8 p:3` as pill container.
Each tab: active=`bg:#16a34a text-white font-semibold`, inactive=`bg:transparent text-gray-500`.

### 1.5 Typography Scale

| Usage | Size | Weight | Color |
|---|---|---|---|
| Page section label | 10px | 600 | #9ca3af |
| Table header | 10px | 600 | #6b7280 |
| Body/table cell | 13px | 400 | #374151 |
| Card header | 14px | 600 | #111827 |
| Nav item | 13px | 400/600 | rgba sidebar |
| Top bar title | 15px | 600 | #111827 |
| Large stat value | 28-38px | 700 | #111827 or #16a34a |
| Comanda card title | 16px | 700 | #111827 |

---

## 2. Page Inventory

| Page | Route | Current structure | Target (PDVApp.jsx) | Delta |
|---|---|---|---|---|
| **Caixa** | `/caixa` | `CashierScreen` root: `div.grid.gap-6` + `h1` + two-col layout (barcode+search left / cart+summary right) | Full-height flex column; top search row; `CARD` cart with table grid `1fr 130px 110px 110px`; bottom bar with payment pills + total + action buttons | **Large**: restructure `CashierScreen` into full-height layout, card-wrap cart, redesign bottom bar, payment pills style |
| **Vendas** | `/vendas` | `div.grid.gap-6` + `h1` + `TodaySalesList` (plain shadcn Table, inline summary text) | 3-col stats cards (Total/Vendas/Ticket) + `CARD`-wrapped table with "Histórico do dia" header | **Medium**: add 3 stats cards above table, wrap table in `CARD`, style header, badge for payment |
| **Produtos** | `/products` | `div.grid.gap-6` + `h1`+button row + `ProductsTable` (plain shadcn Table) | Search input (maxWidth 380) + `CARD`-wrapped table | **Small-Medium**: add client-side search input, wrap table in `CARD`, move "+ Novo produto" button (conflict — see §5) |
| **Estoque** | `/estoque` | `div.grid.gap-8` + `h1` + `section("Nova movimentação")` with `StockMovementDialog` + `section("Estoque baixo")` with `LowStockList` | `maxWidth:680`; `CARD`("Nova movimentação") with inline form; `CARD`("Estoque baixo") with amber header + table | **Medium**: wrap each section in `CARD`, constrain width to ~680px, redesign section headers, amber color on low-stock table header |
| **Comandas** | `/comandas` | `ComandasScreen`: `div.grid.gap-8` + header row (`h1`+`OpenComandaDialog`) + `section("Abertas")` (grid of `ComandaCard`) + `section("Histórico")` | `padding 24/28`; "Abertas" label as `10px uppercase section label`; card grid `auto-fill minmax(270px,1fr)`; each card with `CARD` styling; History with date filter | **Medium**: update `ComandasScreen` layout labels to design token style; card grid to `auto-fill minmax(270px,1fr)`; apply `CARD` style to `ComandaCard`; "+" button conflict (see §5) |
| **Financeiro/Caixa** | `/financeiro/caixa` | `div.grid.gap-8` + 5 sections: Turno (`CashSessionPanel`), Saldo (`CashBalanceCard`), Nova movimentação, Extrato (`CashStatement`), Histórico de turnos | `maxWidth:820`; 2-col grid for Turno+Saldo cards; `CARD`("Nova movimentação") with inline tab switcher; `CARD`("Extrato") with date filter in header | **Medium**: constrain width ~820px, put turno+saldo in 2-col grid, wrap movement form in `CARD`, wrap extrato in `CARD` with header+filter, apply CARD style to session/balance cards |
| **Lucro** | `/lucro` | `div.grid.gap-8` + `h1` + section wrapping `ProfitFilter` (dates) + `ProfitSummaryCard` | `maxWidth:680`; `CARD`("Período de análise") with date pickers + Filtrar button; `CARD`(lucro hero value) + 2x2 grid of sub-stats (Faturamento/Custo/Margem/Vendas) | **Medium**: constrain width ~680px, wrap period filter in `CARD`, redesign `ProfitSummaryCard` to hero layout with 2x2 stats grid |
| **Configurações** | `/settings` | `div.grid.max-w-sm.gap-6` + h1+p + `DefaultMarkupSettingsForm` | `maxWidth:520`; `CARD`("Margem padrão") with header+description + inner form | **Small**: wrap form in `CARD`, apply card header pattern, keep `max-w-sm`→`max-w-lg` |
| **Financeiro/Clientes** | `/financeiro/clientes` | `div.grid.gap-8` + `h1` + section("Novo cliente") + section("Clientes cadastrados") | Not in design reference — keep current structure, apply card wrapping if time allows | **Out of scope / cosmetic** |
| **Financeiro/Receber** | `/financeiro/receber` | `div.grid.gap-8` + `h1` + `ReceberView` | Not in design reference | **Out of scope / cosmetic** |
| **Financeiro/Pagar** | `/financeiro/pagar` | `div.grid.gap-8` + `h1` + `PagarView` | Not in design reference | **Out of scope / cosmetic** |
| **Estoque/[id]** | `/estoque/[id]` | Detail page — not in design reference | — | **Out of scope** |
| **Products/new** | `/products/new` | Form page — not in design reference | — | **Out of scope** |
| **Products/[id]/edit** | `/products/[id]/edit` | Form page — not in design reference | — | **Out of scope** |

---

## 3. Shared Components

These UI elements appear across multiple pages and should be built as reusable primitives:

| Component | Used by | Description |
|---|---|---|
| `PageCard` | Estoque, Financeiro, Lucro, Config, Comandas, Vendas, Produtos | White card wrapper: `bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden` |
| `PageCardHeader` | All cards with title | `px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-900` |
| `SectionLabel` | Comandas ("Abertas"/"Histórico") | `text-[10px] uppercase tracking-[0.7px] text-gray-400 font-semibold mb-3` |
| `StatsGrid` | Vendas (3-col), Lucro (2x2) | A `grid` of stat cards with label + big value + sub-text |
| `StatCard` | Vendas, Financeiro | Single stat: `CARD padding:20` + label(10px/uppercase) + value(28px/bold) + sub(12px/gray) |
| `TabSwitcher` | Estoque (Entrada/Ajuste), Financeiro (Suprimento/Sangria) | Pill tab group: inline-flex container + TabBtn |
| `TableCard` | Vendas, Produtos, Estoque, Financeiro | Card wrapping a table with standard TH/TD styles |
| `PaymentPills` | Caixa (Dinheiro/Cartão/Pix) | Three colored pill buttons with active state |
| `DateRangeFilter` | Financeiro, Lucro, Comandas history | Two `<input type="date">` side by side with "De"/"Até" labels |
| `AmberSectionHeader` | Estoque baixo | Card header with amber dot + "Estoque baixo" label on `#fffbeb` bg |

These could be added to `components/ui/` or `components/shared/` — NOT to any feature-specific folder.

---

## 4. Related Features

| Feature | Name | Relationship | Files Relevant to Redesign |
|---|---|---|---|
| **0001F** | Produtos & Markup | `depends-on` | `/products/page.tsx`, `/settings/page.tsx`; canonical `div.grid.gap-6` scaffold |
| **0002F** | Venda Rápida / Caixa | `depends-on` | `/caixa/page.tsx`, `components/caixa/*` — most layout-sensitive screen |
| **0003F** | Estoque | `depends-on` | `/estoque/page.tsx`, `components/estoque/*`; `section.grid.gap-3` pattern |
| **0004F** | Financeiro | `depends-on` | `/financeiro/*/page.tsx`, 16 components in `components/financeiro/` |
| **0005F** | Lucro & Fechamento | `depends-on` | `/lucro/page.tsx`, `ProfitFilter`, `ProfitSummaryCard`, `CashSessionPanel` |
| **0006F** | Comanda/Mesa | `depends-on` | `/comandas/page.tsx`, `ComandasScreen`, `ComandaCard`, 7 components |
| **0007F** | Impressao | `parallel` | `ReprintButton` in list rows — no layout changes; safe to ignore |
| **0008F** | Sidebar Layout | `depends-on` | `app/(app)/layout.tsx`, `AppTopBar.tsx`, `AppSidebar.tsx`, `globals.css` — shell 0009F works within |

---

## 5. Identified Patterns

### P1 — Page Wrapper Pattern (standard pages)

Current pages wrap content in `<div className="grid gap-6|8">`. After redesign, pages will add outer padding (`px-7 py-6`) and remove the bare `<h1>` (title stays in `AppTopBar`). Content flows directly as cards.

> Implementation: each `page.tsx` loses the `<h1>` and wraps its body in `<div className="px-7 py-6 flex flex-col gap-5">`. Individual sections become `<PageCard>` components.

### P2 — Caixa Full-Height Pattern

`CashierScreen` must fill the content area without scroll. Currently it uses `div.grid.gap-6` and the cart is in the right column — not full-height.

Target: `CashierScreen` becomes `<div className="flex flex-col h-full" style={{ padding: '16px 20px', gap: 12 }}>`. Uses `h-full` (not `calc(100vh - 52px)`) because `<main>` is already `flex-1`. The cart inner `<div>` becomes `flex-1 overflow-hidden` and items inside scroll.

### P3 — Card-Section Pattern (replacing bare `<section>`)

All bare `<section className="grid gap-3"><h2>…</h2>…</section>` blocks become `<PageCard>` with a `<PageCardHeader>` inside:
```tsx
<PageCard>
  <PageCardHeader>Nova movimentação</PageCardHeader>
  <div className="p-5">…content…</div>
</PageCard>
```

### P4 — Table Styling

Currently tables use `shadcn/ui <Table>` with default styles. Redesign keeps the same `<Table>` component but wraps it in `<TableCard>` (a `<PageCard>` with `overflow-hidden`) and applies:
- TH: `text-[10px] uppercase tracking-[0.5px] text-gray-500 font-semibold bg-gray-50 px-5 py-2.5`
- TD: `text-[13px] text-gray-700 px-5 py-3`

Since shadcn `<Table>` outputs `<table>/<thead>/<th>/<td>`, the redesign should either:
  - Apply these styles via Tailwind className on each `<TableHead>/<TableCell>`, or
  - Create thin `PdvTableHead` / `PdvTableCell` wrappers — preferred for DRY

### P5 — Stats Grid Pattern

Used by VendasPage (3-col) and LucroPage (2x2). A single `<StatsGrid>` component accepting an array of `{label, value, sub}` renders the card grid. For Lucro the "hero" value (lucro total) gets special treatment above the 2x2.

### P6 — Width Constraint Pattern

Reference pages use `maxWidth` on some pages:
- Estoque: ~680px
- Financeiro: ~820px
- Lucro: ~680px
- Config: ~520px (already `max-w-sm` ≈ 384px; reference says 520px → change to `max-w-lg`)
- Caixa, Vendas, Produtos, Comandas: no max-width, full available width

These constraints should be added on the outer page wrapper `<div>`, not in the layout.

### P7 — Section Label vs. Section H2

Current pages use `<h2 className="font-medium">` for section titles. In Estoque, these become card headers (P3). In Comandas, "Abertas" and "Histórico" become `<SectionLabel>` (uppercase/10px, no card header).

### P8 — Action Buttons Conflict

Reference `TopBar` shows "+ Novo produto" and "+ Abrir comanda" buttons on the right side. Current `AppTopBar` has no right slot.

**Decision for 0009F**: The recommended approach is **option (b): add a `rightSlot` prop to `AppTopBar`**, passed from the page via a RSC-friendly mechanism. Since `AppTopBar` is a Client Component that reads `pathname`, it can conditionally render the buttons internally (self-contained, no prop drilling needed). This avoids RSC→CC prop threading and matches the reference exactly.

Concrete plan: extend `AppTopBar` to include a right slot using the same `pathname`-switch pattern it already uses for titles. Add a `<Link>` for "Produtos" route and a client-rendered trigger for "Comandas" (needs `onClick` → requires CC).

The "Abrir comanda" button is the harder case: `OpenComandaDialog` is a Client Component. `AppTopBar` is already CC. Solution: import `OpenComandaDialog` directly into `AppTopBar` and render it conditionally on the `/comandas` route.

### P9 — Payment Pill vs. shadcn Button

Current `CartSummary` uses shadcn `<Button variant="outline">` for payment. Target design uses custom `PmBtn` (colored pills). Since `AppTopBar` already uses plain HTML, introducing custom pill buttons in `CashierScreen` is fine — they live in `components/caixa/` and don't violate the shadcn constraint (shadcn is used, not replaced).

---

## 6. Prerequisites

| # | Prerequisite | Why needed | Where |
|---|---|---|---|
| 1 | `PageCard` + `PageCardHeader` components | Used by 8+ pages/components; must exist before any page work starts | `components/ui/PageCard.tsx` |
| 2 | `SectionLabel` component | Used in Comandas, possibly Lucro section labels | `components/ui/SectionLabel.tsx` |
| 3 | `PdvTableHead` + `PdvTableCell` wrappers (or global TH/TD classes) | Consistent table styling across 6 tables | `components/ui/PdvTable.tsx` or via Tailwind CSS classes in `globals.css` |
| 4 | `StatCard` component | Used in Vendas (3) and Financeiro header | `components/ui/StatCard.tsx` |
| 5 | CSS vars for design tokens | `--pdv-green: #16a34a`, `--pdv-border: #e5e7eb` etc. — avoid repeating arbitrary Tailwind values | `app/globals.css` |
| 6 | `AppTopBar` right-slot extension | Required before Produtos/Comandas button placement can be resolved | `components/layout/AppTopBar.tsx` |
| 7 | Confirm `h-full` works inside `<main class="flex-1 overflow-y-auto">` | Caixa full-height layout depends on this; test with a dummy `h-full bg-red-100` div first | Verify in dev before implementing `CashierScreen` redesign |
| 8 | Confirm outer page `<h1>` removal doesn't break any test | `TodaySalesList`, `ProductsTable`, etc. are tested but pages themselves are not; safe to remove `<h1>` from pages | Run `npm test` after removing first `<h1>` to confirm |

---

## 7. Implementation Order (recommended)

1. **CSS tokens** — add `--pdv-green`, `--pdv-border`, etc. to `globals.css`
2. **Shared primitives** — `PageCard`, `PageCardHeader`, `SectionLabel`, `StatCard`, `PdvTableHead`/`PdvTableCell`
3. **AppTopBar right slot** — extend with Produtos link + Comandas dialog trigger
4. **Settings page** — smallest delta; validate pattern works end-to-end
5. **Estoque page** — medium delta; validates card-section pattern
6. **Lucro page** — redesign `ProfitSummaryCard` to hero+2x2 grid
7. **Vendas page** — add StatsGrid, wrap table in card
8. **Produtos page** — add client-side search, wrap table, remove in-page "+ Novo produto" button (now in TopBar)
9. **Comandas page** — update `ComandasScreen` + `ComandaCard` styles
10. **Financeiro/Caixa page** — 2-col header grid, wrap sections in cards
11. **Caixa page** — largest delta; redesign `CashierScreen` full-height layout last

---

## 8. Open Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| OD-1 | Action buttons placement (Produtos, Comandas) | (a) keep in-page; (b) move to `AppTopBar` right slot | **(b)** — matches reference, avoids layout↔page coupling via `pathname` switch already in TopBar |
| OD-2 | `CashierScreen` height approach | (a) `h-full`; (b) `calc(100vh - 52px)` | **(a) `h-full`** — `<main>` is `flex-1`, so `h-full` fills correctly without double-accounting |
| OD-3 | Table TH/TD styling method | (a) per-cell className; (b) wrapper components; (c) global CSS class | **(b) wrapper components** — reusable, co-located, avoids global bleed |
| OD-4 | `ProfitSummaryCard` redesign scope | (a) new component replacing current; (b) extend current | **(a) new card layout** — current `max-w-md` Card structure doesn't fit 2x2 grid hero layout |
| OD-5 | `StockMovementDialog` card wrapping | The `StockMovementDialog` is a dialog trigger, not an inline form. Reference shows inline form. | Keep as dialog trigger, just wrap the button in a `PageCard` — do not rebuild inline form (data/logic change) |
