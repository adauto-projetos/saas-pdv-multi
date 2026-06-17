---
id: 0008F
type: feature-discovery
slug: sidebar-layout
created: 2026-06-17
updated: 2026-06-17
related: [0001F, 0002F, 0003F, 0004F, 0005F, 0006F]
---

# 0008F — Sidebar Layout: Discovery

## TL;DR

Feature 0008F replaces the current horizontal top-navbar layout in `app/(app)/layout.tsx` with a sidebar-first layout: a fixed 220px dark sidebar (`#0d1526`) on the left, a white 52px top bar per page, and a full-width content area — removing the `max-w-5xl` centering constraint that all current page content inherits. The auth guard (`getAuthUser()` + `redirect("/login")`), the `<SignOutButton>`, and all 8 nav links are preserved; only their structural placement changes. Nothing in `app/layout.tsx` (root fonts, `<Toaster>`) is touched. No page files need changes — removing `max-w-5xl` from the layout is sufficient since pages do not set their own max-width.

---

## Current Layout Analysis

**File:** `app/(app)/layout.tsx`

### Auth guard (lines 12–13)
```ts
const user = await getAuthUser();
if (!user) redirect("/login");
```
Server-side, runs before any JSX. Must be kept verbatim — it is the only auth protection for all 8 pages.

### Structure
```
<div class="flex min-h-screen flex-col">
  <header class="border-b">
    <div class="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
      Logo link → /products
      <nav class="flex items-center gap-4 text-sm">
        8 × <Link> + <SignOutButton />
      </nav>
    </div>
  </header>
  <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
    {children}
  </main>
</div>
```

### Nav links inventory
| Label | href |
|---|---|
| Caixa | /caixa |
| Vendas | /vendas |
| Produtos | /products |
| Estoque | /estoque |
| Comandas | /comandas |
| Financeiro | /financeiro/caixa |
| Lucro | /lucro |
| Configurações | /settings |

### Key constraints coming from current layout
- `max-w-5xl` on both header and `<main>` — limits content to ~1024px, centered. Removed in sidebar layout.
- `h-14` (56px) header height — replaced by 52px top bar per design reference.
- Logo href points to `/products`, not `/caixa` — can be corrected in rewrite.
- `<SignOutButton>` is a `"use client"` component (uses `useRouter`) — stays Client Component, moves to sidebar footer.

---

## Design Reference Analysis

**File:** `Design funcional e moderno/download/PDVApp.jsx`

### Root app shell (lines 691–708)
```jsx
<div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f1f5f9' }}>
  <Sidebar />
  <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minWidth:0 }}>
    <TopBar />   {/* height: 52px */}
    <div style={{ flex:1, overflowY:'auto', overflowX:'hidden' }}>
      {pageContent}
    </div>
  </div>
</div>
```
Body background: `#f1f5f9` (Tailwind `slate-100`).

### Sidebar (lines 113–135)
- Width: `220px`, `flex-shrink: 0`
- Background: `#0d1526` (deep navy, no Tailwind token — must be set inline or as CSS var)
- Three zones:
  1. **Header** (`padding: 22px 18px 16px`, `border-bottom: 1px solid rgba(255,255,255,0.06)`): logo "PDV.multi", subtitle "PONTO DE VENDA"
  2. **Nav** (`flex: 1`, `padding: 10px 8px`, `overflow-y: auto`): 5 primary items + divider + 3 secondary items
  3. **User footer** (`border-top: 1px solid rgba(255,255,255,0.06)`, `padding: 12px 14px`): avatar circle, "Usuário / Admin", "Sair" text

### Nav item active state
- Active: `color: #c7d2fe` (indigo-200), `background: rgba(99,102,241,0.18)` (indigo-600 at 18%)
- Inactive: `color: rgba(148,163,184,0.7)` (slate-400 at 70%)
- Item padding: `9px 12px`, border-radius: `7px`, font-size: `13px`

### Nav grouping (two groups, separated by `1px` divider)
- Group 1: Caixa, Vendas, Produtos, Estoque, Comandas
- Divider: `height:1, background: rgba(255,255,255,0.05)`
- Group 2: Financeiro, Lucro, Configurações

### Top bar (lines 142–150)
- Height: `52px`, background: `#fff`, `border-bottom: 1px solid #e5e7eb`
- Left: page title (`font-size: 15px, font-weight: 600, color: #111827`)
- Right: contextual action buttons (only on Produtos and Comandas pages in the reference)

### Icons
Each nav item has an inline SVG icon (15×15, `stroke="currentColor"`, `strokeWidth="1.8"`). All 8 icons defined in the JSX — can be extracted or replicated with Lucide React (already available in the project via shadcn).

---

## Integration Points

### Files that MUST change

| File | Change |
|---|---|
| `app/(app)/layout.tsx` | Full rewrite: flex-row shell, extract sidebar as `<AppSidebar>`, extract top bar as `<AppTopBar>` or inline, remove `max-w-5xl`, keep auth guard |

### New files to create

| File | Purpose |
|---|---|
| `components/layout/AppSidebar.tsx` | Dark sidebar — logo, nav links, user footer with `<SignOutButton>`. Client Component (needs active-link detection via `usePathname`) |
| `components/layout/AppTopBar.tsx` | White 52px top bar — page title derived from pathname. Server Component or thin client wrapper |

### Files that are READ-ONLY (no changes needed)

| File | Reason |
|---|---|
| `app/layout.tsx` | Root layout with `<Toaster>` — untouched |
| `components/auth/SignOutButton.tsx` | Already a Client Component, just relocates to sidebar footer |
| `app/(app)/caixa/page.tsx` | Pages render inside `{children}` — no layout classes of their own |
| `app/(app)/vendas/page.tsx` | Uses `<div class="grid gap-6">` — not tied to max-width |
| `app/(app)/comandas/page.tsx` | Delegates to `<ComandasScreen>` — not tied to max-width |
| All other `app/(app)/*/page.tsx` | Same — none set their own `max-w-*` |

---

## Constraints

### Tailwind v4 — no `tailwind.config.js`
The project uses Tailwind v4 with CSS-vars-only configuration (`app/globals.css`). There is no `tailwind.config.ts`. Arbitrary color values like `#0d1526` are written as Tailwind arbitrary values (`bg-[#0d1526]`) or added as CSS custom properties in `:root` inside `globals.css`. The sidebar color is not in the existing token set — it must be added as `--sidebar-bg: #0d1526` or used inline.

Existing `globals.css` already has sidebar CSS vars (`--sidebar`, `--sidebar-foreground`, etc.) but they map to light grays (`:root { --sidebar: oklch(0.985 0 0) }`) — not the dark navy needed. These vars are shadcn tokens and should NOT be repurposed; use a new `--pdv-sidebar` token or Tailwind arbitrary value.

### shadcn/ui — Base UI (not Radix)
shadcn is installed with `base-nova` style using `@base-ui/react`. No Radix dependencies. If shadcn has a `<Sidebar>` component in its registry, it likely targets Radix — do NOT install it. Build `AppSidebar` from scratch using plain HTML/Tailwind.

### Next.js App Router — Server Component layout
`app/(app)/layout.tsx` is an async Server Component (calls `getAuthUser()`). The sidebar needs `usePathname()` for active-link highlighting — that hook is Client-only. Solution: keep `layout.tsx` as a Server Component; split `<AppSidebar>` into a `"use client"` component that receives the nav link definitions as props or defines them inline. The auth guard stays in the Server Component layout.

### Top bar — page title source
The design reference derives the title from `activePage` state (SPA). In Next.js App Router the equivalent is `usePathname()` in a Client Component, or each page exports its own `metadata.title` (Server). The cleanest approach: a `"use client"` `<AppTopBar>` that maps `pathname` to a title string — same data structure as the design reference's `titles` map.

### Action buttons in top bar
The design shows page-specific action buttons (e.g., "+ Novo produto" on Produtos, "+ Abrir comanda" on Comandas). These cannot be rendered by a shared layout component — they live in the page itself. The top bar should leave a right-side slot empty; pages render their own buttons inside their content area (current pages already do this with `<h1>` + button patterns). This avoids a cross-cutting concern and keeps pages self-contained.

---

## Related Features

| Feature ID | Relationship | What it contributes |
|---|---|---|
| 0001F | Produtos (CRUD) | Added `/products` nav link; page uses `<div class="grid gap-6">` pattern |
| 0002F | Estoque | Added `/estoque` nav link |
| 0003F | Financeiro | Added `/financeiro/caixa` nav link (note: href differs from label) |
| 0004F | Lucro | Added `/lucro` nav link |
| 0005F | Configurações | Added `/settings` nav link |
| 0006F | Caixa + Comandas merge | Added `/caixa` and `/comandas` nav links; `CaixaPage` uses full-height layout (`h-[calc(100vh-52px)]` in design ref) — sidebar layout makes this possible by removing the top nav height from the equation |
