# Tasks: 0001F — Product Markup Pricing

## Metadata

| Field | Value |
|-------|-------|
| Complexity | COMPLEX |
| Total tasks | 22 |
| Services | infra, database, backend, frontend, test |
| Status | implemented + verificado local — gates verdes (typecheck/lint/test/build). Postgres no Docker; 34/34 testes passam (inclui RLS/constraints). Auth local (sem Supabase). |

> COMPLEX (13+) is expected and accepted here: this is feature #1, establishing the multi-tenant + auth + RLS foundation alongside the full product CRUD, markup engine (RF02/RF06), and tenant settings (RF05). Do NOT split — the foundation and the feature that exercises it must land together.

## Requirements Coverage

- [x] RF01 — Cadastrar produto (nome, código, unidade `un`|`kg`, estoque inicial)
- [x] RF02 — Calcular preço de venda = custo + (custo × %)
- [x] RF03 — Preço calculado editável (override manual)
- [x] RF04 — Cadastrar sem custo, preço de venda direto
- [x] RF05 — % de margem padrão configurável por tenant, pré-preenchida
- [x] RF06 — Recalcular preço ao mudar custo, com confirmação (preview + apply)
- [x] RF07 — Listar e editar produtos cadastrados
- [x] RF08 — Visualizar estoque (somente leitura) na lista
- [x] RN01 — Código de barras único por tenant
- [x] RN02 — Custo e preço de venda não negativos
- [x] RN03 — Sem custo → margem/lucro indefinidos (aceito)
- [x] RN04 — Markup auxiliar — não obrigatório para salvar
- [x] RN05 — Dados de produto isolados por tenant (multi-tenancy / RLS)

## TDD

- [x] T-TEST-22 Negative sale price rejected by CHECK constraint (RN02) — `db/__tests__/products-constraints.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-25 Tenant A cannot read tenant B product under RLS (RN05) — `db/__tests__/products-rls.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-26 Tenant A cannot write tenant B product under RLS (RN05) — `db/__tests__/products-rls.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-03 Calc sale price from cost+markup (RF02) — `lib/services/products/markup.test.ts`
- [x] T-TEST-04 Markup rounds half-up to cent (RF02) — `lib/services/products/markup.test.ts`
- [x] T-TEST-05 Manual price overrides calc, sets manual flag (RF03) — `lib/services/products/markup.test.ts`
- [x] T-TEST-10 Preview cost change persists nothing (RF06) — `lib/services/products/markup.test.ts`
- [x] T-TEST-13 Preview warns on manual price (RF06) — `lib/services/products/markup.test.ts`
- [x] T-TEST-02 Reject invalid unit value (RF01) — `lib/validation/product.test.ts`
- [x] T-TEST-20 Negative cost rejected by zod (RN02) — `lib/validation/product.test.ts`
- [x] T-TEST-21 Non-negative cost/price accepted (RN02) — `lib/validation/product.test.ts`
- [x] T-TEST-23 Markup not required to save (RN04) — `lib/validation/product.test.ts`
- [x] T-TEST-24 Save with neither price nor cost fails (RN04) — `lib/validation/product.test.ts`
- [x] T-TEST-07 Create without cost, price direct (RF04) — `lib/services/products/product-service.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-11 Apply accept=true updates cost+price (RF06) — `lib/services/products/product-service.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-12 Apply accept=false saves cost only (RF06) — `lib/services/products/product-service.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-15 List products with stock read-only (RF07, RF08) — `lib/services/products/product-service.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-16 Edit existing product fields (RF07) — `lib/services/products/product-service.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-18 Barcode duplicate same tenant rejected (RN01) — `lib/services/products/product-service.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-19 Same barcode different tenants ok (RN01) — `lib/services/products/product-service.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-27 tenantId derived from auth not input (RN05) — `lib/services/products/product-service.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-09 Update tenant default markup (RF05) — `lib/services/tenants/settings-service.test.ts` *(escrito; executa com banco)*
- [x] T-TEST-01 Create product action with all base fields (RF01) — `app/(app)/products/actions.test.ts`
- [x] T-TEST-06 Sale price editable flag tracked in form (RF03) — `components/products/ProductForm.test.tsx`
- [x] T-TEST-08 Default markup pre-fills new form (RF05) — `components/products/ProductForm.test.tsx`
- [x] T-TEST-14 RF06 dialog shows warning + confirm (RF06) — `components/products/PriceSuggestionDialog.test.tsx`
- [x] T-TEST-17 Stock shown read-only in table (RF08) — `components/products/ProductsTable.test.tsx`

## Execution

- [x] T01 Scaffold Next.js + Tailwind + shadcn + Drizzle + Supabase
  - Service: infra
  - Files: `package.json`, `drizzle.config.ts`, `tsconfig.json`
  - Deps: -
  - Verify: `npm run build` succeeds ✓ (Next 16 + React 19 + Tailwind v4 + shadcn base-nova/Base UI)

- [x] T02 Wire authed Supabase server client (RLS context)
  - Service: infra
  - Files: `lib/supabase/server.ts`, `lib/supabase/client.ts`
  - Deps: T01
  - Verify: `npx tsc --noEmit` passes ✓; server client lê a sessão dos cookies

- [x] T03 Define tenants + tenant_members Drizzle schema
  - Service: database
  - Files: `db/schema/tenants.ts`, `db/schema/tenant-members.ts`
  - Deps: T01
  - Verify: `npx drizzle-kit generate` emite tenants + tenant_members ✓

- [x] T04 Define products Drizzle schema with CHECK + unique
  - Service: database
  - Files: `db/schema/products.ts`
  - Deps: T03
  - Verify: migration `0000` inclui cost>=0, sale_price>=0, unit CHECK, partial unique (tenant_id, barcode) ✓

- [x] T05 Add tenant(id) index + push migration
  - Service: database
  - Files: `db/schema/products.ts`, `db/migrations/0000_*.sql`
  - Deps: T04
  - Verify: `npm run db:push` aplicado ao Postgres local ✓; índice `products(tenant_id)` presente

- [x] T06 Enable RLS policies on all tables
  - Service: database
  - Files: `db/migrations/0001_rls.sql`
  - Deps: T05
  - Verify: `npm run db:rls` aplicado ✓; papel `app_user` + `current_app_user()` + políticas tenant_self_read/tenant_self_update/tenant_member_isolation (não-recursiva)/tenant_isolation + user_self_read

- [x] T07 DB constraint test — negative sale price rejected
  - Service: test
  - Files: `db/__tests__/products-constraints.test.ts`
  - Deps: T05
  - Verify: `npx vitest run db/__tests__/products-constraints.test.ts` *(escrito; pulado sem DATABASE_URL)*

- [x] T08 DB RLS tests under authenticated user JWT
  - Service: test
  - Files: `db/__tests__/products-rls.test.ts`, `db/__tests__/seed.ts`
  - Deps: T06
  - Verify: `npx vitest run db/__tests__/products-rls.test.ts` *(escrito; usa JWT autenticado via withUserRls, não service-role; pulado sem creds)*

- [x] T09 Signup onboarding: create tenant + tenant_members
  - Service: backend
  - Files: `lib/services/tenants/onboarding.ts`, `app/(auth)/signup/actions.ts`
  - Deps: T06
  - Verify: signup cria tenant + owner member (onboarding via db direto, bypassa RLS) ✓ tsc

- [x] T10 Typed domain errors (Conflict/Validation/NotFound)
  - Service: backend
  - Files: `lib/services/errors.ts`
  - Deps: T01
  - Verify: `npx tsc --noEmit` ✓; erros mapeiam para ActionResult seguro

- [x] T11 Zod schemas for product + cost-change + markup DTOs
  - Service: backend
  - Files: `lib/validation/product.ts`, `lib/validation/product.test.ts`
  - Deps: T10
  - Verify: `npx vitest run lib/validation/product.test.ts` ✓ (T02, T20, T21, T23, T24)

- [x] T12 Markup engine: calc, resolve, suggest (pure)
  - Service: backend
  - Files: `lib/services/products/markup.ts`, `lib/services/products/markup.test.ts`
  - Deps: T11
  - Verify: `npx vitest run lib/services/products/markup.test.ts` ✓ (T03, T04, T05, T10, T13)

- [x] T13 Drizzle data layer for products + tenant markup
  - Service: backend
  - Files: `lib/services/products/data.ts`
  - Deps: T05, T12
  - Verify: `npx tsc --noEmit` ✓; numeric(5,2)/numeric(10,3) coeridos para number; todas as fns filtram tenant_id

- [x] T14 Product service: create/update/list/get + RF06 apply
  - Service: backend
  - Files: `lib/services/products/product-service.ts`, `lib/services/products/product-service.test.ts`
  - Deps: T13
  - Verify: `npx vitest run lib/services/products/product-service.test.ts` *(escrito; T07,T11,T12,T15,T16,T18,T19,T23,T27; executa com banco)*

- [x] T15 Tenant settings service: get/update default markup
  - Service: backend
  - Files: `lib/services/tenants/settings-service.ts`, `lib/services/tenants/settings-service.test.ts`
  - Deps: T13
  - Verify: `npx vitest run lib/services/tenants/settings-service.test.ts` *(escrito; T09; executa com banco)*

- [x] T16 Product server actions + error→message mapping
  - Service: backend
  - Files: `app/(app)/products/actions.ts`, `app/(app)/products/actions.test.ts`
  - Deps: T14
  - Verify: `npx vitest run "app/(app)/products/actions.test.ts"` ✓ (T01, mockado); tenantId da sessão via requireAuthContext

- [x] T17 Settings server action: updateDefaultMarkup
  - Service: backend
  - Files: `app/(app)/settings/actions.ts`
  - Deps: T15
  - Verify: `npx tsc --noEmit` ✓; action chama updateDefaultMarkup + revalidatePath

- [x] T18 Auth shell: login page + protected layouts
  - Service: frontend
  - Files: `app/(auth)/layout.tsx`, `app/(app)/layout.tsx`, `components/auth/LoginForm.tsx` (+ signup, SignOutButton, proxy.ts, lib/supabase/middleware.ts)
  - Deps: T09
  - Verify: `npm run build` ✓; sem sessão redireciona para /login

- [x] T19 Money/percent/quantity inputs + format helpers
  - Service: frontend
  - Files: `components/ui/MoneyInput.tsx`, `components/ui/PercentInput.tsx`, `components/ui/QuantityInput.tsx`, `lib/format/money.ts`, `lib/format/percent.ts`
  - Deps: T01
  - Verify: `npx vitest run lib/format` ✓; centsToBRL/brlToCents round-trip

- [x] T20 ProductForm + MarkupCalculatorFields with live calc
  - Service: frontend
  - Files: `components/products/ProductForm.tsx`, `components/products/MarkupCalculatorFields.tsx`, `components/products/ProductForm.test.tsx`
  - Deps: T16, T19
  - Verify: `npx vitest run components/products/ProductForm.test.tsx` ✓ (T06, T08); live calc reaproveita calculateSalePrice

- [x] T21 RF06 PriceSuggestionDialog + cost-change flow
  - Service: frontend
  - Files: `components/products/PriceSuggestionDialog.tsx`, `components/products/PriceSuggestionDialog.test.tsx`, `components/products/EditProductForm.tsx`
  - Deps: T16, T20
  - Verify: `npx vitest run components/products/PriceSuggestionDialog.test.tsx` ✓ (T14)

- [x] T22 Products list/new/edit pages + settings page
  - Service: frontend
  - Files: `app/(app)/products/page.tsx`, `app/(app)/products/new/page.tsx`, `app/(app)/products/[id]/edit/page.tsx`, `app/(app)/settings/page.tsx`, `components/products/ProductsTable.tsx`, `components/products/ProductsTable.test.tsx`, `components/products/NewProductForm.tsx`, `components/settings/DefaultMarkupSettingsForm.tsx`
  - Deps: T20, T21, T17
  - Verify: `npx vitest run components/products/ProductsTable.test.tsx` ✓ (T17); manual: cadastro < 30s (validar no app rodando)

## Acceptance Checklist

- [x] Table `tenants` has `default_markup_percent numeric(5,2) NOT NULL DEFAULT 30.00` (RF05)
- [x] Table `tenant_members` links `user_id`→`auth.users` with `UNIQUE(tenant_id, user_id)` (RN05)
- [x] Table `products` has `tenant_id` FK NOT NULL, money columns as `integer` cents (RF01, RN05)
- [x] CHECK constraint `cost_cents >= 0` and `sale_price_cents >= 0` on `products` (RN02)
- [x] CHECK constraint `unit IN ('un','kg')` on `products` (RF01)
- [x] `cost_cents` and `markup_percent` are NULLABLE on `products` (RF04, RN03)
- [x] Partial UNIQUE `(tenant_id, barcode) WHERE barcode IS NOT NULL` on `products` (RN01)
- [x] RLS policy `tenant_isolation` on `products` via `tenant_members` subquery blocks cross-tenant read/write (RN05) *(SQL pronto; aplicar com `npm run db:rls`)*
- [x] Signup onboarding creates a `tenants` row + owner `tenant_members` row so session has tenant_id (RN05)
- [x] Zod `createProductSchema` refine requires `salePriceCents` OR `costCents` present (RN04)
- [x] Zod rejects negative `costCents`/`salePriceCents` and invalid `unit` (RN02, RF01)
- [x] Service `calculateSalePrice` returns `Math.round(cost + cost*pct/100)` half-up cents (RF02)
- [x] Service `resolvePriceOnCreate` sets `priceIsManual=true` on manual price, `false` on cost+markup (RF03, RF04)
- [x] Service `suggestPriceOnCostChange` returns `PriceSuggestionDto` and persists nothing (RF06)
- [x] `PriceSuggestionDto.warnManualOverride` is true when product `priceIsManual` (RF06)
- [x] Service `applyCostChange` saves cost+price on accept, cost-only on cancel (RF06)
- [x] Service `createProduct` catches 23505 → `ConflictError` on barcode field (RN01)
- [x] Service `createProduct`/`updateProduct` derive `tenantId` from auth session, never input (RN05)
- [x] Server action `listProducts` returns `ProductDto[]` including read-only `stockQuantity` (RF07, RF08)
- [x] Server action `getDefaultMarkup`/`updateDefaultMarkup` read/write `tenants.default_markup_percent` (RF05)
- [x] Component `ProductForm` pre-fills markup from tenant default and tracks `priceIsManual` (RF03, RF05)
- [x] Component `MarkupCalculatorFields` shows live computed sale price on cost/markup change (RF02)
- [x] Component `PriceSuggestionDialog` renders manual-override warning + confirm/cancel actions (RF06)
- [x] Component `ProductsTable` shows stock cell read-only with no edit control (RF08)
- [x] Page `/products` lists products and `/products/[id]/edit` allows editing fields (RF07)
- [x] Product without cost saves with `costCents=null`, margin/profit undefined (RF04, RN03)

### Verificação local (Postgres no Docker — sem Supabase)

Tudo aplicado e rodando local:

- **T05/T06** aplicados via `npm run db:setup` no `pdv_postgres` (Docker).
- **34/34 testes passam** com `npm test` — incluindo os 12 de banco antes pulados: T-TEST-07/09/11/12/15/16/18/19/22/25/26/27 (RLS T25/T26 confirmam isolamento cross-tenant de verdade).
- **Smoke HTTP** ✓: `/login` 200, `/products` redireciona p/ `/login` sem sessão, `/` → `/products`.
- **E2E Playwright** ✓ (`npm run e2e`): fluxo real no navegador — criar loja → cadastrar produto com markup (preço ao vivo 13,00) → produto aparece na lista. Exercita form + server action + sessão + RLS + banco.

### Known Issues

- Nenhum. Gates verdes: `npm run typecheck` (0), `npm run lint` (0), `npm test` (34 passam), `npm run build` (ok).
- Nota de auth: substituído Supabase Auth por auth local (cookie httpOnly + bcrypt) por decisão do founder de rodar Postgres puro no Docker. RLS via papel `app_user` + `current_app_user()` (ver `db/migrations/0001_rls.sql`, decisions.jsonl).
