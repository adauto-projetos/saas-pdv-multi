---
id: 0010F
type: feature-about
slug: mobile-responsive
created: 2026-06-21
updated: 2026-06-21
related: [0008F, 0009F]
---

## TL;DR

This discovery covers how to make SAAS PDV.multi fully mobile-responsive. The fixed 248px sidebar must hide on viewports `< 1024px` and be replaced by a bottom navigation bar. The `/caixa` (cashier) screen requires special tab-switched layout on mobile. All protected routes need responsive layout adjustments. Motivation: 0008F and 0009F both deferred mobile as "future separate feature" — this is that feature.

## Prerequisites

1. **0008F — Sidebar Layout** — Shell structure with `AppSidebar` (248px fixed, all inline styles), `AppTopBar` (title display), and `app/(app)/layout.tsx` (flex row `sidebar + main`). This feature wraps those components in responsive display logic.
2. **0009F — Page Redesign** — All pages already use the card-based layout (PageCard, StatCard, tables in cards). Mobile responsive must preserve that structure and apply breakpoint-aware padding/grid collapsing.
3. **Tailwind v4 breakpoints** — Project uses `px-7 py-6`, `flex flex-col`, `grid gap-5` syntax; responsive variants like `lg:hidden`, `hidden lg:flex` work as expected.
4. **Existing `TITLE_MAP` in AppTopBar** — Already maps routes to page titles; no changes needed, just ensure title is visible on mobile viewports.
5. **State management for `/caixa` tabs** — Cart state already uses `useCart()` hook; tab switching must preserve it.

## Related Features

| Feature | Relation | Why |
|---|---|---|
| **0008F** | extends | `AppSidebar`, `AppTopBar`, `app/(app)/layout.tsx` — core shell components to make responsive |
| **0009F** | extends | All pages (`/caixa`, `/vendas`, `/products`, `/estoque`, `/comandas`, `/financeiro/caixa`, `/lucro`, `/settings`) already use PageCard/StatCard layout; mobile must adapt grids and padding |

## Files to Modify

| File | What to change | Complexity |
|---|---|---|
| `app/(app)/layout.tsx` | Add `flex flex-col lg:flex-row` to root div; apply `hidden lg:flex` to sidebar, `lg:hidden` to new bottom nav; move bottom nav below main | M |
| `components/layout/AppSidebar.tsx` | Add `hidden lg:flex` class | S |
| `components/layout/AppTopBar.tsx` | Ensure title visible on mobile; adjust padding for safe-area | S |
| `components/caixa/CashierScreen.tsx` | Replace two-column flex with mobile tabs (Produtos/Carrinho); use state for active tab; render grid OR cart by tab; desktop unchanged | L |
| `app/(app)/vendas/page.tsx` | Stat cards grid: `grid-cols-3` → `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | S |
| `app/(app)/products/page.tsx` | Add flex-col/md:flex-row to header; table auto-scrolls on mobile | S |
| `app/(app)/estoque/page.tsx` | Add `px-4 md:px-7` padding | S |
| `app/(app)/comandas/page.tsx` | Grid already responsive; add `px-4 md:px-7` padding | S |
| `app/(app)/financeiro/caixa/page.tsx` | Grid `grid-cols-2` → `grid-cols-1 md:grid-cols-2` | M |
| `app/(app)/lucro/page.tsx` | Add `px-4 md:px-7` padding | S |
| `app/(app)/settings/page.tsx` | Add `px-4 md:px-7` padding | S |
| `app/globals.css` | Add safe-area-inset CSS vars; optional touch-action utilities | S |
| `components/caixa/Cart.tsx` | Ensure widths flexible; width=72 safe for mobile | S |
| `components/caixa/TodaySalesList.tsx` | Stat cards grid: `grid-cols-3` → `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` | S |

## Files to Create

| File | Purpose |
|---|---|
| `components/layout/BottomNav.tsx` | Client Component; 5 primary nav items (Caixa, Comandas, Produtos, Financeiro, More) + drawer with 4 secondary items (Vendas, Estoque, Lucro, Configurações); active state via `usePathname()`; fixed position at bottom with safe-area padding |
| `components/layout/BottomNavDrawer.tsx` | (Optional) Separate drawer if logic grows; can be inline in BottomNav for MVP |

## Existing Patterns

### Layout & Spacing
- **Desktop padding:** `px-7 py-6` (28px horizontal, 24px vertical) — all pages consistent.
- **Mobile padding:** Adopt `px-4 md:px-7` pattern (16px on mobile, 28px on tablet+).
- **Gaps:** `gap-5` standard; no changes needed.
- **Flex/Grid:** `flex flex-col` for stacks, `grid gap-3` or inline `gridTemplateColumns` for product/card grids.
- **Max-widths:** `max-w-[680px]`, `max-w-[820px]` on specific pages — intentional, no changes.

### Tailwind Classes Already in Use
- `hidden lg:flex` / `lg:hidden` — pattern established; exact classes needed for sidebar/nav swap.
- `flex-col lg:flex-row` — direction toggle, already used.
- `grid grid-cols-1 md:grid-cols-3` — NOT yet in codebase; will introduce for stat grids.
- `px-4 md:px-7` — standard mobile-first padding; will standardize across pages.
- Typography: `text-[13px]`, `text-[14px]` etc. already scaled; no changes.

### Inline Styles That Will Break Responsive
- **CashierScreen (lines 123-643):** Outer `display: flex, height: 100vh`; cart `width: 392` hardcoded. Must become tabs on mobile.
- **Cart (lines 34-168):** All flexbox with min/max sizing; width=72 on subtotal column — shrinks on mobile, acceptable.
- **AppSidebar (lines 50-212):** `width: 248`, `height: 100vh`, `position: sticky` — will hide with `hidden lg:flex`.
- **CashierScreen product grid (line 306):** `gridTemplateColumns: repeat(auto-fill, minmax(150px, 1fr))` — already responsive.
- **ComandasScreen (line 57):** `gridTemplateColumns: repeat(auto-fill, minmax(270px, 1fr))` — already responsive.

## Risk Areas

### CashierScreen Mobile Tabs
- **Risk:** Two-column layout (product grid left, 392px cart right) breaks on mobile. Cart squeezed or scrolls horizontally.
- **Solution:** Detect mobile (`window.innerWidth < 1024` or CSS media query hook). Replace layout with tab switcher (Produtos | Carrinho). Render active tab's content in full-width scrollable container. Desktop layout unchanged.
- **State:** `useCart()` hook persists across tabs — switching tabs does NOT reset cart. Essential for UX.
- **Complexity:** Highest — refactor rendering logic, test barcode input + keyboard behavior.

### Table Responsive Behavior
- **Risk:** ProductsTable has 5 fixed columns with text-right alignment. On mobile, text overflows or columns squash.
- **Solution:** shadcn Table already renders native `<table>`. Mobile can scroll horizontally (standard UX). Alternative: build mobile card rows, but out of scope. Current behavior acceptable.
- **Complexity:** Low.

### Virtual Keyboard on `/caixa`
- **Risk:** Barcode input, total, and buttons at bottom may be pushed off-screen when virtual keyboard opens on mobile.
- **Solution:** `<main class="overflow-y-auto">` already scrolls. Input fields scroll into view. No additional fix needed.
- **Complexity:** Low.

### Stat Grid Collapse
- **Risk:** `grid grid-cols-3` on small screens squashes text (Vendas, Financeiro stat cards).
- **Solution:** Change to `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`. StatCard component unchanged; only outer grid.
- **Complexity:** Very Low.

### Sidebar Hidden on Mobile
- **Risk:** `hidden lg:flex` may not work if Tailwind config missing 1024px breakpoint.
- **Solution:** Verify `tailwind.config.js` uses default breakpoints (lg = 1024px). No custom config needed.
- **Complexity:** Very Low.

### Bottom Nav Drawer & Virtual Keyboard
- **Risk:** Drawer slides up from bottom; virtual keyboard may overlap on Android.
- **Solution:** Use `position: fixed bottom: 0`. Add `padding-bottom: env(safe-area-inset-bottom)` for iOS. Standard browser behavior handles Android. Drawer content scrollable.
- **Complexity:** Low.

### Page Padding on Mobile
- **Risk:** `px-7` (28px × 2 = 56px) on 375px width leaves only 319px. Tight but acceptable.
- **Solution:** Use `px-4 md:px-7` for more breathing room on mobile (16px × 2 = 32px, leaves 343px).
- **Complexity:** Very Low.

### Testing Coverage
- **Risk:** Existing tests run at ~1024px. Mobile layout untested by CI.
- **Solution:** Manual QA in Chrome DevTools Responsive Mode (375×667, 768×1024). Device testing out of scope. Document manual steps.
- **Complexity:** None.

## Implementation Order

1. **BottomNav component** — Create `components/layout/BottomNav.tsx` first.
2. **Shell layout** — Update `app/(app)/layout.tsx` with flex-col/flex-row and conditional render.
3. **Padding standardization** — Add `px-4 md:px-7` to all 8 pages.
4. **Stat grids** — Update TodaySalesList and Financeiro to responsive columns.
5. **CashierScreen tabs** — Largest change; defer to last.
6. **Manual QA** — Test at 375px, 768px, 1024px in Chrome DevTools.

## Example: CashierScreen Tab Implementation

### Current (Desktop Only)
```tsx
<div style={{ display: "flex", height: "100vh", ... }}>
  <div style={{ flex: 1, ... }}>
    {/* products grid */}
  </div>
  <div style={{ width: 392, ... }}>
    {/* cart */}
  </div>
</div>
```

### Mobile Refactor
```tsx
const [mobileTab, setMobileTab] = useState('products');
const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

return (
  <div style={{ display: "flex", height: "100vh", ... }}>
    {/* On mobile: tab switcher */}
    {isMobile && (
      <div style={{ display: "flex", gap: 10, padding: "10px 16px", ... }}>
        <button onClick={() => setMobileTab('products')}>Produtos</button>
        <button onClick={() => setMobileTab('carrinho')}>
          Carrinho ({cart.items.length})
        </button>
      </div>
    )}
    
    {/* Tab content */}
    {!isMobile || mobileTab === 'products' ? (
      <div style={{ flex: 1, ... }}>
        {/* products grid */}
      </div>
    ) : (
      <div style={{ flex: 1, ... }}>
        {/* cart */}
      </div>
    )}
  </div>
);
```

## Success Criteria

| Criterion | How to verify |
|---|---|
| Zero horizontal overflow | Chrome DevTools at 375px: no left-right scroll |
| Bottom nav works | All 5 items + 4 drawer items navigate correctly |
| Sidebar visibility | Sidebar absent at 374px, present at 1024px |
| Caixa tabs functional | Switch tabs, cart state preserved, keyboard works |
| No regressions | `npm test`, `npm run build`, `npm run typecheck` all pass |
| Stat grids responsive | 1-col at 375px, 2-col at 768px, 3-col at 1024px |
