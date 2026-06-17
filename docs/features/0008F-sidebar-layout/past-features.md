---
id: 0008F
type: past-features
slug: sidebar-layout
created: 2026-06-17
related: [0001F, 0002F, 0003F, 0004F, 0005F, 0006F]
---

# Past Features — 0008F Sidebar Layout

## Relationship Table

| Feature | Files Touched in `app/(app)/layout.tsx` | Relationship | Notes |
|---|---|---|---|
| **0001F** — Produtos & Markup | Created `app/(app)/layout.tsx` (protected shell, top navbar structure, logo, SignOutButton) | `layout-dependency` | Origin of the shell being replaced; established auth guard (`getAuthUser` → redirect `/login`) |
| **0002F** — Venda Rápida | Added "Caixa" and "Vendas" nav links to `layout.tsx` | `layout-dependency` | Two nav entries (`/caixa`, `/vendas`) live in the sidebar that will be built |
| **0003F** — Estoque | Added "Estoque" nav link to `layout.tsx` | `layout-dependency` | Nav entry `/estoque`; also owns `/estoque/[id]` sub-route |
| **0004F** — Financeiro | Added "Financeiro" nav link (`/financeiro/caixa`) to `layout.tsx` | `layout-dependency` | Nav entry points to `/financeiro/caixa`; owns 4 sub-routes (caixa, clientes, receber, pagar) |
| **0005F** — Lucro & Fechamento | Added "Lucro" nav link to `layout.tsx` | `layout-dependency` | Nav entry `/lucro` |
| **0006F** — Comanda/Mesa | Added "Comandas" nav link to `layout.tsx` after Caixa | `layout-dependency` | Nav entry `/comandas`; most recent touch to the layout |

All six prior features are `layout-dependency`: each added a nav link to the top navbar now being replaced. None added shared layout infrastructure beyond nav links.

## Pages / Routes Currently Under the Layout

All routes inside `app/(app)/` are children of `layout.tsx`. The sidebar must provide navigation to all of them:

| Route | Feature Origin | Nav Label (current) |
|---|---|---|
| `/products` | 0001F | "Produtos" (logo link) |
| `/products/new` | 0001F | — (no direct nav, reached via Produtos page) |
| `/products/[id]/edit` | 0001F | — (no direct nav) |
| `/caixa` | 0002F | "Caixa" |
| `/vendas` | 0002F | "Vendas" |
| `/estoque` | 0003F | "Estoque" |
| `/estoque/[id]` | 0003F | — (no direct nav, reached via Estoque page) |
| `/financeiro/caixa` | 0004F | "Financeiro" (entry point) |
| `/financeiro/clientes` | 0004F | — (sub-route, tabbed within Financeiro) |
| `/financeiro/receber` | 0004F | — (sub-route) |
| `/financeiro/pagar` | 0004F | — (sub-route) |
| `/lucro` | 0005F | "Lucro" |
| `/comandas` | 0006F | "Comandas" |
| `/settings` | 0001F | "Configurações" |

Current layout wraps `<main>` with `max-w-5xl` centering. The sidebar design will need to account for this constraint — either keep `max-w` on `<main>` or expand to full-width with sidebar offset.

## Shared UI Patterns That Must Keep Working

| Pattern | Where Defined | Notes |
|---|---|---|
| **Toast / Sonner** | `app/layout.tsx` (root layout, NOT `app/(app)/layout.tsx`) | `<Toaster richColors position="top-center" />` lives in the root layout — completely unaffected by the sidebar change. All `toast()` calls across every page will continue to work. |
| **Auth guard** | `app/(app)/layout.tsx` (lines 13-14) | `getAuthUser()` + redirect is inline in the layout component. Must be preserved in the sidebar rewrite — move to the new layout component, not to individual pages. |
| **SignOutButton** | `components/auth/SignOutButton` | Currently rendered in the top navbar. Must be repositioned in the sidebar (e.g., bottom of sidebar). No logic change needed. |
| **`/financeiro` sub-navigation** | No shared tab component — each sub-page is a separate route | The Financeiro section has 4 routes. The sidebar may want a collapsible group or sub-items. Currently only `/financeiro/caixa` is in the nav; the others are reached via in-page tabs or links inside the Financeiro screens. Verify with design reference before deciding. |

## Key Constraints for the Sidebar Implementation

1. **No server actions or DB touches** — this is a pure UI shell replacement.
2. **Auth guard must stay** — `getAuthUser()` redirect is the only server logic in `layout.tsx` and must be carried over.
3. **`<Toaster>` is safe** — it lives in `app/layout.tsx` (root), not in the app shell being replaced.
4. **8 nav items** (current top navbar): Caixa, Vendas, Produtos, Estoque, Comandas, Financeiro, Lucro, Configurações + SignOut. Sidebar must accommodate all.
5. **`max-w-5xl` on `<main>`** — current constraint. The design reference (`PDVApp.jsx`) should dictate whether to keep or drop this once the sidebar takes the left portion.
