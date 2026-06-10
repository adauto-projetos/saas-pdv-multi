---
id: 0001F
type: feature-plan
slug: product-markup-pricing
status: planned
created: 2026-06-08
updated: 2026-06-08
related: [0001F, PRODUCT, OWNER]
---

# Plan: 0001F — Product Markup Pricing

## TL;DR

Plano técnico de {{doc:0001F}} — cadastro de produtos com markup automático (custo + %), preço editável e recálculo confirmado ao mudar o custo. Por ser a **1ª feature** do projeto greenfield, ela também estabelece a fundação multi-tenant: tabela `tenants`, vínculo usuário→tenant (`tenant_members`), Supabase Auth básico e políticas RLS — produtos nascem isolados por loja de verdade. Stack: Next.js (app router, server actions) + Drizzle + Supabase/PostgreSQL. Headline: dinheiro sempre em centavos (inteiro), markup em `numeric(5,2)`, e a regra RF06 modelada como preview (não persiste) + confirmação (persiste).

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Test Specification](#test-specification)
- [Database](#database)
- [Backend](#backend)
- [Frontend](#frontend)
- [Risks](#risks)
- [Validation](#validation)
- [Requirements Coverage](#requirements-coverage)
- [Quick Reference](#quick-reference)

## Context

{{doc:0001F}} especifica o cadastro de produtos com calculadora de markup auxiliar. Este plano acrescenta as decisões técnicas que o about.md não fixa: o modelo de dados (3 tabelas), a fundação de multi-tenancy/auth (decidida com o founder como **incluída** nesta feature), a divisão preview-vs-confirmação da RF06, e a regra de arredondamento do markup. A discovery.md listava 3 bloqueios (stack, multi-tenancy, CLAUDE.md) — **todos resolvidos** pelo CLAUDE.md atual, que sobrescreve a nota desatualizada da discovery.

## Architecture Decisions

| Decision | Rationale | Alternative rejected | Triggering constraint |
|---|---|---|---|
| Fundação multi-tenant + auth dentro de 0001F | 1ª feature; produtos já nascem isolados de verdade, sem retrabalho | Stub de tenant + auth depois — produto teria que ser remodelado | RN05 (isolamento) + RF05 (config por tenant) exigem o conceito de tenant |
| Dinheiro em `integer` (centavos) | Evita erro de arredondamento de float em preço/markup | float/decimal de moeda — drift de centavos | CLAUDE.md (Conventions: valores monetários inteiros) |
| Markup em `numeric(5,2)` | Percentual exato 0–999.99 (ex. 33.33), comparável produto↔tenant | integer basis points — menos legível p/ founder beginner | RF02/RF05 (percentual com casas decimais) |
| RLS via subquery em `tenant_members` | Última linha de defesa no banco; mesmo padrão em toda tabela futura | Filtro só na aplicação — vaza dado entre lojas se a query esquecer o filtro | CLAUDE.md Multi-Tenancy (RLS obrigatória) + RN05 |
| RF06 = 2 operações (preview não persiste + apply confirma) | Impede que uma troca de custo altere o preço sem confirmação | `updateProduct` único sobrescrevendo preço | RF06 (só aplica após confirmação; cancelar mantém custo, não o preço) |
| Flag `price_is_manual` no produto | RF06 precisa saber se o preço atual foi digitado à mão p/ avisar | Tabela de histórico de preço — over-engineering no MVP | RF03 (preço editável) + RF06 (aviso de override manual) |
| Server actions + RSC, sem React Query | Simples p/ founder beginner; cobre todas as leituras/escritas do MVP | Lib de query no client — complexidade sem ganho no MVP | OWNER (beginner; favorecer simples) + métrica cadastro < 30s |
| Unique parcial `(tenant_id, barcode) WHERE barcode IS NOT NULL` | Unicidade por loja; vários produtos sem código não conflitam | Unique global — quebraria RN01; ou unique cheia — bloquearia múltiplos sem código | RN01 (código único por tenant) + RF01 (código opcional) |

## Main Flow

- **Cadastro com markup (RF01/RF02/RF05):** form abre → `getDefaultMarkup` pré-preenche % → usuário digita custo+% → preço calculado ao vivo (`Math.round(cost+cost*%/100)`) → `createProduct` valida (zod) → insere sob RLS.
- **Cadastro sem custo (RF04):** usuário digita preço direto → `price_is_manual=true`, custo/markup nulos → `createProduct`.
- **Editar custo de produto existente (RF06):** muda custo → `previewPriceOnCostChange` (não persiste) → `PriceSuggestionDialog` mostra sugestão (+ aviso se `warnManualOverride`) → confirma `applyCostChange(accept=true)` (custo+preço) | cancela `accept=false` (só custo).
- **Configurar margem padrão (RF05):** /settings → `updateDefaultMarkup` grava `tenants.default_markup_percent`.
- **Auth/isolamento (RN05):** login Supabase → sessão resolve `tenant_id` via `tenant_members` → toda query roda sob o JWT → RLS filtra.

## Implementation Order

Database → Backend → Frontend (cada camada depende dos contratos da anterior). Auth/RLS antes de qualquer query de produto. Detalhe de tarefas em `tasks.md`.

---

## Test Specification

### Contract Tests (from RFs/RNs)

| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | Create product with all base fields | backend | RF01 | CreateProductInput{name, barcode, unit:'un', stockQuantity, salePriceCents} | ProductDto persisted, id returned | name/barcode/unit/stock match input |
| T02 | Reject invalid unit value | backend | RF01 | CreateProductInput{unit:'lt'} | ValidationError | unit enum rejected, no insert |
| T03 | Calc sale price from cost+markup | backend | RF02 | calculateSalePrice(1000, 30) | 1300 | sale_price = cost+cost×% |
| T04 | Markup rounds half-up to cent | backend | RF02 | calculateSalePrice(1000, 33.33) | 1333 | Math.round half-up applied |
| T05 | Manual price overrides calc | backend | RF03 | resolvePriceOnCreate{cost:1000, markup:30, salePriceCents:1500} | salePriceCents=1500, priceIsManual=true | manual value wins, flag true |
| T06 | Salesprice editable flag in form | frontend | RF03 | edit salePrice field directly | priceIsManual=true tracked | useProductForm sets manual flag |
| T07 | Create without cost, price direct | backend | RF04 | CreateProductInput{salePriceCents:500, no costCents} | ProductDto{costCents:null, salePriceCents:500} | saves; cost null accepted |
| T08 | Default markup pre-fills new form | frontend | RF05 | NewProductPage with tenant default 30 | markup field = 30.00 | getDefaultMarkup prefilled |
| T09 | Update tenant default markup | backend | RF05 | UpdateDefaultMarkupInput{percent:25} | TenantSettingsDto{defaultMarkupPercent:25} | persisted on tenant row |
| T10 | Preview cost change persists nothing | backend | RF06 | previewPriceOnCostChange{id, newCostCents:2000} | PriceSuggestionDto, DB unchanged | row cost/price unchanged after call |
| T11 | Apply accept=true updates cost+price | backend | RF06 | applyCostChange{newCostCents:2000, acceptSuggestion:true} | ProductDto cost=2000, price=suggested | both persisted |
| T12 | Apply accept=false saves cost only | backend | RF06 | applyCostChange{newCostCents:2000, acceptSuggestion:false} | ProductDto cost=2000, price unchanged | cost saved, salePrice/priceIsManual intact |
| T13 | Preview warns on manual price | backend | RF06 | preview on product priceIsManual=true | PriceSuggestionDto{warnManualOverride:true} | warn flag true |
| T14 | RF06 dialog shows warning+confirm | frontend | RF06 | PriceSuggestionDialog with warnManualOverride | warning text + confirm/cancel buttons | warning rendered, actions wired |
| T15 | List products with stock read-only | backend | RF07,RF08 | listProducts(tenantId) | ProductDto[] incl stockQuantity | stock present, returned for tenant |
| T16 | Edit existing product fields | backend | RF07 | updateProduct{id, name:'X'} | ProductDto{name:'X'} | change persisted under tenant |
| T17 | Stock shown read-only in table | frontend | RF08 | ProductsTable render ProductDto | stock cell read-only, no edit input | no editable stock control |
| T18 | Barcode duplicate same tenant rejected | backend | RN01 | createProduct duplicate barcode, same tenant | ConflictError on barcode | 23505 caught, field error |
| T19 | Same barcode different tenants ok | backend | RN01 | barcode 'X' in tenant A and tenant B | both persist | no conflict across tenants |
| T20 | Negative cost rejected | backend | RN02 | CreateProductInput{costCents:-1} | ValidationError | refuse, no insert |
| T21 | Non-negative cost/price accepted | backend | RN02 | CreateProductInput{costCents:0, salePriceCents:0} | ProductDto persisted | zero allowed |
| T22 | Negative sale price rejected | database | RN02 | insert sale_price_cents=-5 | CHECK constraint violation | DB rejects row |
| T23 | Markup not required to save | backend | RN04 | CreateProductInput{salePriceCents:900, no cost/markup} | ProductDto persisted | refine passes on price-only path |
| T24 | Save with neither price nor cost fails | backend | RN04 | CreateProductInput{no salePriceCents, no costCents} | ValidationError | refine rejects empty path |
| T25 | Tenant A cannot read tenant B product | database | RN05 | select B's product as user A (RLS) | empty / no rows | RLS blocks cross-tenant read |
| T26 | Tenant A cannot write tenant B product | database | RN05 | update B's product as user A | denied / 0 rows affected | RLS blocks cross-tenant write |
| T27 | tenantId derived from auth not input | backend | RN05 | createProduct with forged tenantId in input | uses session tenant | input tenantId ignored |

### Test File Mapping

| Area | Test File | Test IDs |
|------|-----------|----------|
| backend | lib/services/products/markup.test.ts | T03, T04, T05, T10, T13 |
| backend | lib/services/products/product-service.test.ts | T07, T11, T12, T15, T16, T18, T19, T23, T27 |
| backend | lib/validation/product.test.ts | T02, T20, T21, T23, T24 |
| backend | lib/services/tenants/settings-service.test.ts | T09 |
| frontend | components/products/ProductForm.test.tsx | T06, T08 |
| frontend | components/products/PriceSuggestionDialog.test.tsx | T14 |
| frontend | components/products/ProductsTable.test.tsx | T17 |
| backend | app/(app)/products/actions.test.ts | T01 |
| database | db/__tests__/products-constraints.test.ts | T22 |
| database | db/__tests__/products-rls.test.ts | T25, T26 |

> Nota: T25/T26 exigem rodar sob um JWT autenticado real (não o client service-role, que ignora RLS).

---

## Database

### Type Decisions (inline)

| Value | Column type | Reason |
|-------|-------------|--------|
| Money (cost, sale_price) | `integer` (cents) | Avoids float rounding; R$ 10,50 → 1050. Convention from CLAUDE.md. |
| Markup percent | `numeric(5,2)` | Supports 0.00–999.99%; precise decimal, no float drift. e.g. 33.33, 30.00. |
| Default markup (tenant) | `numeric(5,2)` | Same type as product-level markup for consistency (RF05). |
| Stock quantity | `numeric(10,3)` | Supports `un` (whole: 1.000) and `kg` (fractional: 0.500). 3 decimals = gram precision. |

### Entities

| Entity | Table | Key Fields | Reference |
|--------|-------|------------|-----------|
| Tenant (establishment) | `tenants` | `id uuid PK`, `name text NOT NULL`, `default_markup_percent numeric(5,2) NOT NULL DEFAULT 30.00` | `db/schema/tenants.ts` |
| Tenant Member (user→tenant link) | `tenant_members` | `id uuid PK`, `tenant_id uuid FK→tenants`, `user_id uuid FK→auth.users`, `role text NOT NULL` | `db/schema/tenant-members.ts` |
| Product | `products` | `id uuid PK`, `tenant_id uuid FK→tenants NOT NULL`, `name text NOT NULL`, `barcode text`, `unit text NOT NULL CHECK(unit IN ('un','kg'))`, `cost_cents integer`, `markup_percent numeric(5,2)`, `sale_price_cents integer NOT NULL`, `price_is_manual boolean NOT NULL DEFAULT false`, `stock_quantity numeric(10,3) NOT NULL DEFAULT 0`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()` | `db/schema/products.ts` |

### Migration

- **Create** `tenants` — id (uuid, PK, gen_random_uuid()), name (text, NOT NULL), default_markup_percent (numeric(5,2), NOT NULL, DEFAULT 30.00), timestamps
- **Create** `tenant_members` — id (uuid, PK), tenant_id (FK → tenants CASCADE DELETE), user_id (FK → auth.users CASCADE DELETE), role (text, NOT NULL), UNIQUE(tenant_id, user_id), timestamps
- **Create** `products` — all fields above; cost_cents NULLABLE (RN03/RF04); markup_percent NULLABLE (undefined without cost); sale_price_cents NOT NULL
- **CHECK** `products`: `cost_cents >= 0` (RN02), `sale_price_cents >= 0` (RN02)
- **CHECK** `products`: `unit IN ('un', 'kg')` (RF01)
- **UNIQUE** composite: `(tenant_id, barcode)` WHERE barcode IS NOT NULL — uniqueness per tenant, not global (RN01/CLAUDE.md)
- **Index** `products(tenant_id)` — all queries are tenant-scoped; primary access pattern
- Migration files: `db/schema/tenants.ts`, `db/schema/tenant-members.ts`, `db/schema/products.ts` (Drizzle table definitions)

### RLS Policies

| Table | Policy | Rule |
|-------|--------|------|
| `tenants` | `tenant_self_read` | `id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())` |
| `tenant_members` | `tenant_member_isolation` | `tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())` |
| `products` | `tenant_isolation` | `tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid())` |
| All business tables | *(pattern)* | Every future table follows the same subquery against `tenant_members`; never trust app-level filter alone |

### Repository / Data access (`lib/services/` data layer via Drizzle)

| Method | Purpose |
|--------|---------|
| `createProduct(tenantId, data)` | Inserts product; price_is_manual=false if cost+markup, true if price direct (RF03/RF04) |
| `updateProduct(tenantId, productId, data)` | Updates product fields; always filters by tenant_id |
| `listProducts(tenantId)` | Returns all products for tenant including stock_quantity (read-only, RF08) |
| `getProductById(tenantId, productId)` | Single product lookup scoped to tenant |
| `getTenantDefaultMarkup(tenantId)` | Reads default_markup_percent for pre-fill (RF05) |
| `updateTenantDefaultMarkup(tenantId, percent)` | Updates tenant-level default markup (RF05) |

---

## Backend

### Server Actions / Endpoints
| Action / Route | Kind | Input DTO | Output DTO | Purpose |
|----------------|------|-----------|------------|---------|
| createProduct | server action | CreateProductInput | ProductDto | Create via markup (cost+%) or manual price (RF01/RF02/RF04) |
| updateProduct | server action | UpdateProductInput | ProductDto | Edit product fields (RF07); recomputes price_is_manual |
| listProducts | server action | — | ProductDto[] | List tenant products incl. read-only stock (RF07/RF08) |
| getProduct | server action | ProductIdInput | ProductDto | Single product for edit form (RF07) |
| previewPriceOnCostChange | server action | PreviewCostChangeInput | PriceSuggestionDto | RF06 suggestion only — NO persist |
| applyCostChange | server action | ApplyCostChangeInput | ProductDto | RF06 confirm step — persists new cost (+ price if accepted) |
| updateDefaultMarkup | server action | UpdateDefaultMarkupInput | TenantSettingsDto | Settings: tenant.default_markup_percent (RF05) |
| getDefaultMarkup | server action | — | TenantSettingsDto | Pre-fill markup on new-product form (RF05) |

### DTOs / Schemas (zod, lib/validation/)
| DTO | Fields (name: type) | Validations |
|-----|---------------------|-------------|
| CreateProductInput | name: string; barcode?: string; unit: 'un'\|'kg'; stockQuantity: number; costCents?: int; markupPercent?: number; salePriceCents?: int | name non-empty; unit enum; stockQuantity ≥0; costCents int ≥0 (RN02); markupPercent 0–999.99; salePriceCents int ≥0; **refine:** salePriceCents OR costCents present — markup auxiliary (RN04) |
| UpdateProductInput | id: uuid; + CreateProductInput fields (partial) | id uuid; same field rules; cost change routed through RF06 flow, not raw overwrite |
| ProductIdInput | id: uuid | id uuid |
| PreviewCostChangeInput | id: uuid; newCostCents: int | id uuid; newCostCents int ≥0 (RN02) |
| ApplyCostChangeInput | id: uuid; newCostCents: int; acceptSuggestion: boolean | id uuid; newCostCents int ≥0; boolean confirms RF06 |
| UpdateDefaultMarkupInput | percent: number | 0–999.99 numeric(5,2) range |
| ProductDto | id; tenantId; name; barcode\|null; unit; costCents\|null; markupPercent\|null; salePriceCents; priceIsManual; stockQuantity; createdAt; updatedAt | — (response shape; never expose raw row) |
| PriceSuggestionDto | currentSalePriceCents; suggestedSalePriceCents; newCostCents; markupPercent\|null; priceIsManual; warnManualOverride: boolean | — |
| TenantSettingsDto | tenantId; defaultMarkupPercent | — |

### Services (lib/services/)
| Service fn | Responsibility |
|-----------|----------------|
| calculateSalePrice(costCents, markupPct) | RF02 calc + rounding rule (below); returns int cents |
| resolvePriceOnCreate(input) | Decide price + priceIsManual: manual salePrice → true; cost+markup → calc, false (RF03/RF04/RN04) |
| suggestPriceOnCostChange(product, newCostCents) | RF06 PURE preview: builds PriceSuggestionDto; warnManualOverride = product.priceIsManual; no persist |
| applyCostChange(tenantId, product, newCostCents, accept) | RF06 confirm: always saves newCost; updates salePrice only if accept; cancel keeps price + flag |
| getProductsForTenant / getProduct / createProduct / updateProduct | Orchestrate validated DTO → Drizzle data fns under RLS auth context |
| getDefaultMarkup / updateDefaultMarkup | Read/write tenant.default_markup_percent (RF05) |

### Business Rules mapping
- **RF02/RF06 rounding:** `salePriceCents = Math.round(costCents + costCents * markupPercent / 100)` — round HALF-UP to nearest integer cent. Arithmetic rounding of the cents result only; NOT price-to-.99 rounding (excluded by about.md "Does NOT Include").
- **RF06 preview-vs-confirm split:** `previewPriceOnCostChange` returns PriceSuggestionDto, persists nothing. UI shows suggestion (warning when `warnManualOverride`). `applyCostChange` is the only persisting step: `accept=true` → cost+price; `accept=false` → cost only (cancel semantics).
- **RN01:** Barcode unique per tenant enforced by DB composite unique. Service catches 23505 → typed ConflictError → friendly field error on `barcode` ("código de barras já cadastrado nesta loja").
- **RN02/RN04:** Non-negative cost/price validated in zod input DTOs at the action boundary. Markup NOT required to save — enforced via CreateProductInput refine (salePrice OR cost path).
- **RN05 (RLS/auth context):** Every action resolves the Supabase server client from the authenticated session; tenantId derived from auth/`tenant_members`, NEVER from input. Queries run under the user's JWT so RLS applies; app-level filter is additive.

### Module Structure (Next.js layout)
- `lib/validation/product.ts` — Create/Update/PreviewCostChange/ApplyCostChange/DefaultMarkup zod schemas + inferred types.
- `lib/services/products/` — `markup.ts` (calc + suggest + resolve), `product-service.ts` (create/update/list/get/applyCostChange), `data.ts` (Drizzle data fns).
- `lib/services/tenants/settings-service.ts` — get/updateDefaultMarkup.
- `lib/supabase/server.ts` — authed server client (RLS context).
- `app/(app)/products/actions.ts` — server actions wrapping product services + zod parse + error→message mapping.
- `app/(app)/settings/actions.ts` — updateDefaultMarkup server action.
- `lib/services/errors.ts` — typed domain errors (ConflictError, ValidationError, NotFoundError) mapped to safe action results.

---

## Frontend

### Pages
| Route | Page Component | Purpose |
|-------|----------------|---------|
| /login | LoginPage | Minimal Supabase Auth (email+senha); redirect to /products on success |
| /products | ProductsListPage | RSC: listProducts → table w/ name, sale price, unit, read-only stock (RF07/RF08); loading/empty/error |
| /products/new | NewProductPage | RSC pre-fetch getDefaultMarkup → ProductForm (create mode) (RF01–RF05) |
| /products/[id]/edit | EditProductPage | RSC getProduct → ProductForm (edit mode); cost change triggers RF06 dialog |
| /settings | SettingsPage | RSC getDefaultMarkup → DefaultMarkupSettingsForm (RF05) |

Layout: `app/(app)/layout.tsx` protected shell (redirect to /login if no session); `app/(auth)/layout.tsx` for login.

### Components
{"ProductForm":{"location":"components/products/","purpose":"client form create+edit, all fields, calls server actions, surfaces field errors (barcode RN01)"},"MarkupCalculatorFields":{"location":"components/products/","purpose":"cost+markup%+salePrice trio with live RF02 calc; salePrice editable→price_is_manual (RF03/RF04)"},"PriceSuggestionDialog":{"location":"components/products/","purpose":"RF06 shadcn AlertDialog: suggested price, manual-override warning, confirm/cancel"},"ProductsTable":{"location":"components/products/","purpose":"shadcn Table of ProductDto; sale price BRL, unit badge, read-only stock, edit link"},"DefaultMarkupSettingsForm":{"location":"components/settings/","purpose":"single percent field, updateDefaultMarkup (RF05)"},"MoneyInput":{"location":"components/ui/","purpose":"BRL masked input ↔ cents"},"PercentInput":{"location":"components/ui/","purpose":"numeric percent input (0–999.99)"},"QuantityInput":{"location":"components/ui/","purpose":"stock input; un=integer step, kg=0.001 step"},"LoginForm":{"location":"components/auth/","purpose":"email+password Supabase sign-in"},"EmptyState":{"location":"components/ui/","purpose":"reusable empty-collection message + CTA"}}
(shadcn primitives to add: button, input, label, table, dialog/alert-dialog, select, form, badge, sonner toast)

### Hooks & State
{"hooks":{"useProductForm":{"type":"react-hook-form + zodResolver","purpose":"form state, zod validation mirroring CreateProductInput, derives live salePrice from cost+markup, tracks priceIsManual when salePrice edited"},"useCostChangeFlow":{"type":"client flow state","purpose":"edit mode: on cost change call previewPriceOnCostChange→open PriceSuggestionDialog→applyCostChange(accept)"}},"stores":{}}
Server state via RSC + server actions (no React Query MVP); mutations call actions then `revalidatePath`. Toasts (sonner) for success/error. Form lib: react-hook-form + zod (schemas reused from lib/validation/product.ts).

### Money/Unit handling
- `lib/format/money.ts`: `centsToBRL(cents)` → "R$ 10,50"; `brlToCents(str)` → integer. Display = cents formatted; submit = cents.
- `lib/format/percent.ts`: parse/format numeric percent (e.g. 30.00); markup is percent NOT cents.
- Unit: QuantityInput switches step by `unit` — `un` integer, `kg` 3-decimal. Send `stockQuantity` as number (numeric(10,3)).
- Live calc: `salePriceCents = Math.round(costCents + costCents*markupPercent/100)` mirrors backend; recompute on cost/markup change unless priceIsManual.

### Types (mirror from backend)
{"ProductDto":{"fields":"id,tenantId,name; barcode:string|null; unit:'un'|'kg'; costCents:number|null; markupPercent:number|null; salePriceCents:number; priceIsManual:boolean; stockQuantity:number; createdAt:string; updatedAt:string","sourceDTO":"ProductDto"},"CreateProductInput":{"fields":"name:string; barcode?:string; unit:'un'|'kg'; stockQuantity:number; costCents?:number; markupPercent?:number; salePriceCents?:number","sourceDTO":"CreateProductInput"},"UpdateProductInput":{"fields":"id:string; +CreateProductInput fields","sourceDTO":"UpdateProductInput"},"PreviewCostChangeInput":{"fields":"id:string; newCostCents:number","sourceDTO":"PreviewCostChangeInput"},"ApplyCostChangeInput":{"fields":"id:string; newCostCents:number; acceptSuggestion:boolean","sourceDTO":"ApplyCostChangeInput"},"PriceSuggestionDto":{"fields":"currentSalePriceCents:number; suggestedSalePriceCents:number; newCostCents:number; markupPercent:number|null; priceIsManual:boolean; warnManualOverride:boolean","sourceDTO":"PriceSuggestionDto"},"TenantSettingsDto":{"fields":"tenantId:string; defaultMarkupPercent:number","sourceDTO":"TenantSettingsDto"},"UpdateDefaultMarkupInput":{"fields":"percent:number","sourceDTO":"UpdateDefaultMarkupInput"}}
Types in `types/product.ts`; enums as unions; Date→string. Import zod schemas from `lib/validation/product.ts` to infer form types.

---

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| RLS mal configurada vaza dados entre lojas | Média | Alto | Testes T25/T26 sob JWT real (não service-role); RLS habilitada por padrão em toda tabela |
| Onboarding do 1º tenant/membro indefinido (signup → cria tenant + tenant_members) | Alta | Médio | Definir fluxo de signup/seed em tasks.md antes do CRUD de produtos; sem ele não há `tenant_id` na sessão |
| Cálculo de preço diverge entre frontend (ao vivo) e backend | Média | Médio | Fórmula única `Math.round(cost+cost*%/100)` espelhada; testes T03/T04 no backend |
| Service-role client ignora RLS e mascara falha nos testes | Média | Alto | Testes de RLS rodam com client autenticado de usuário, documentado no test-spec |
| Parse/format de kg fracionário (vírgula vs ponto, gramas) confunde input | Média | Baixo | QuantityInput com step por unidade; helpers money/percent centralizados |
| Markup numeric(5,2) trafega como string do Postgres e quebra cálculo JS | Baixa | Médio | Coerção explícita para number na camada data.ts; testes de cálculo cobrem o tipo |

## Validation

- **Contract tests:** 27 casos (T01–T27) verdes; cobertura RF/RN = 100% (tabela abaixo).
- **RLS:** T25/T26 confirmam isolamento cross-tenant sob usuário autenticado.
- **Markup:** T03 (1000+30%→1300) e T04 (33.33% half-up→1333) confirmam a regra de arredondamento.
- **RF06:** T10 (preview não persiste), T11/T12 (accept true/false), T13/T14 (aviso manual).
- **Métrica de produto:** cadastrar um produto em < 30s (about.md) — verificação manual no fluxo /products/new.
- **Quality gates:** `lint`, `typecheck`, `build`, `test` — a registrar no CLAUDE.md (Validation Gates) após o scaffolding; ainda não existem comandos.

## Requirements Coverage

| ID | Requirement | Covered? | Area | Tests |
|----|-------------|----------|------|-------|
| RF01 | Cadastrar produto (nome, código, unidade, estoque inicial) | YES | DB + Backend + Frontend | T01, T02 |
| RF02 | Calcular preço = custo + custo×% | YES | Backend + Frontend | T03, T04 |
| RF03 | Preço calculado editável (override manual) | YES | Backend + Frontend | T05, T06 |
| RF04 | Cadastrar sem custo, preço direto | YES | Backend + Frontend | T07 |
| RF05 | % de margem padrão configurável por tenant | YES | DB + Backend + Frontend | T08, T09 |
| RF06 | Recalcular preço ao mudar custo, com confirmação | YES | Backend + Frontend | T10, T11, T12, T13, T14 |
| RF07 | Listar e editar produtos | YES | Backend + Frontend | T15, T16 |
| RF08 | Visualizar estoque (read-only) na lista | YES | Backend + Frontend | T15, T17 |
| RN01 | Código de barras único por tenant | YES | DB + Backend | T18, T19 |
| RN02 | Custo e preço não negativos | YES | DB + Backend | T20, T21, T22 |
| RN03 | Sem custo → margem/lucro indefinidos (aceito) | YES | DB + Backend | T07 |
| RN04 | Markup auxiliar — não obrigatório p/ salvar | YES | Backend | T23, T24 |
| RN05 | Dados de produto isolados por tenant | YES | DB (RLS) + Backend | T25, T26, T27 |

## Quick Reference

| Pattern | Codebase search terms (greenfield — estabelecer) |
|---|---|
| Entity / Schema | `db/schema/products.ts`, `db/schema/tenants.ts`, `db/schema/tenant-members.ts` |
| Data layer (Drizzle) | `lib/services/products/data.ts` |
| Service (markup/RF06) | `lib/services/products/markup.ts`, `product-service.ts` |
| Validation (zod) | `lib/validation/product.ts` |
| Server actions | `app/(app)/products/actions.ts`, `app/(app)/settings/actions.ts` |
| Supabase / RLS | `lib/supabase/server.ts`, políticas `tenant_isolation` |
| Form / live calc | `components/products/ProductForm.tsx`, `MarkupCalculatorFields.tsx` |
| RF06 dialog | `components/products/PriceSuggestionDialog.tsx` |
| Page | `app/(app)/products/`, `app/(app)/settings/` |
