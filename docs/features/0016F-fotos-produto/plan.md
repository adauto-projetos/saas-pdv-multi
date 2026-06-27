---
id: 0016F
type: feature-plan
slug: fotos-produto
created: 2026-06-27
updated: 2026-06-27
related: [0016F, 0011F]
---

## TL;DR

Plano técnico da feature {{doc:0016F}}: cada produto ganha 1 foto opcional armazenada no Cloudflare R2 (S3-compatible), com o banco guardando só `image_key` + `image_url`. Decisão central: upload via route handler `POST /api/products/[id]/upload` (recebe FormData) → service que valida/redimensiona (sharp → WebP 600x600 contain, fundo branco) → grava chave aleatória sob uma pasta por loja (`<slug-da-loja>-<tenantId>/<uuid>.webp`) no R2 e a referência no banco sob RLS. Objeto servido por URL pública imprevisível (sem presigned, sem RLS no arquivo; listagem do bucket desabilitada). Exibição com fallback foto → emoji → ícone no PDV e na listagem. Stack: Next 16 + Drizzle + Postgres; duas deps novas (`@aws-sdk/client-s3`, `sharp`).

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Test Specification](#test-specification)
- [Database](#database)
- [Backend](#backend)
- [Frontend](#frontend)
- [Risks](#risks)
- [Validation](#validation)
- [Overview](#overview)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)
- [Requirements Coverage](#requirements-coverage)

## Context

A spec {{doc:0016F}} pede 1 foto por produto para o operador distinguir itens parecidos no PDV (hoje só nome + emoji). Este plano adiciona o **como**: o primeiro route handler do repo (`app/api/`), o primeiro cliente de object storage (`lib/services/storage/r2-client.ts`), o pipeline de imagem com sharp, e os pontos de exibição. Não há sistema de eventos nem workers nesta stack — todas as mutações são server actions + service layer sob `withUserRls`; órfãos no R2 são tolerados por design (sem job de limpeza).

## Architecture Decisions

| Decision | Rationale | Alternativa rejeitada | Constraint que forçou |
|---|---|---|---|
| Storage externo no R2, banco guarda só chave+URL | Binário fora do Postgres; URL pública evita query extra ao bucket na exibição | BLOB no banco — incha a base, custa em cada leitura do PDV | Centenas de itens no PDV (RNF03) |
| URL pública + nome aleatório (sem presigned) | Isolamento vem da imprevisibilidade da chave (RN04); zero overhead de assinatura por exibição | Presigned URLs — expiram, quebram `<img>` no catálogo; sugeridas no discovery, descartadas pelo about.md | Exibição de muitos itens sem auth por arquivo (RN03) |
| Route handler para upload (Opção A) | API explícita p/ FormData, reutilizável; service não faz HTTP | Tudo em server action (Opção B) — menos isolável, sem endpoint de arquivo | Recepção de `multipart/form-data` |
| Foto desacoplada do create/update | Falha de upload não bloqueia salvar o produto (RF08) | Upload dentro do create — falha do R2 derrubaria o cadastro | R2 pode estar indisponível (RF08) |
| Create-then-upload no produto novo | Endpoint precisa do `id`, que só existe após o create; `createProductAction` já retorna `ProductDto` | Upload antes do create — sem id para a chave | RF01 (foto no cadastro novo) |
| sharp valida por magic bytes + redimensiona p/ 600x600 contain | Uma lib cobre validação real (RN05) e resize quadrado 600x600 fundo branco + WebP (RNF01); contain não corta o produto | Validar só por extensão/MIME — falsificável; cover (corta bordas) descartado p/ não perder detalhe do produto | RN05 (imagem real), RNF01 (tamanho padrão) |
| `<img loading="lazy">` em vez de `next/image` | Nenhum componente usa `next/image` hoje; evita configurar `remotePatterns` | `next/image` — exigiria allowlist de domínio R2 | Consistência com o codebase + RNF03 |

---

## Test Specification

### Contract Tests (from RFs/RNs)

| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | upload anexa foto a produto novo | backend | RF01 | POST upload, valid jpeg, product id | 200 `{imageUrl}`; row imageKey/imageUrl set | imageUrl truthy + row patched |
| T02 | edit troca foto existente | backend | RF02/RF06 | upload over product that has imageKey | 200; new imageUrl; old key r2.delete called | new key persisted, delete(oldKey) invoked |
| T03 | preview component stages file pre-save | frontend | RF03 | select File in create mode (no productId) | blob preview shown, remove button, no POST | stagedFile set, fetch NOT called |
| T04 | remove clears staged preview | frontend | RF03 | click remove on staged photo | preview cleared, blob revoked | previewUrl null, revokeObjectURL called |
| T05 | display shows photo when imageUrl set | frontend | RF04 | product `{imageUrl:"u"}` | renders `<img src="u" loading="lazy">` | img rendered, not emoji span |
| T06 | fallback foto→emoji→ícone | frontend | RF05 | no imageUrl+emoji "🍺" / neither | emoji "🍺" / "📦" icon | chain resolves correctly |
| T07 | replace deletes old R2 file | backend | RF06 | upload, product has prior imageKey | r2Client.delete(oldKey) called once | delete invoked with old key |
| T08 | product delete removes its photo | backend | RF07 | deleteProduct with imageKey present | row deleted, r2.delete(imageKey) called | delete invoked; no delete if key null |
| T09 | upload failure does not block save | backend | RF08 | create then upload throws (R2 down) | product saved (id exists), action returns warning | product persisted, no rollback |
| T10 | failed-upload toast then redirect | frontend | RF08 | staged photo, upload POST !ok | warning toast, redirect proceeds | router.push still called |
| T11 | old-file delete failure tolerated | backend | RF09 | replace, r2.delete(old) rejects | main op succeeds, new ref persisted | no throw, new imageKey saved |
| T12 | delete-product file-delete failure tolerated | backend | RF09 | deleteProduct, r2.delete rejects | product still deleted | no throw, row gone |
| T13 | photo optional — product valid sans foto | backend | RN01 | createProduct no image fields | product created, imageKey/imageUrl null | row valid, both null |
| T14 | upload replaces, never adds 2nd | backend | RN02 | second upload on product w/ foto | single imageKey (overwrite, old deleted) | one key only, old removed |
| T15 | key prefixed by tenantId | backend | RN03 | upload under tenant t1 | key matches `t1/<rand>.webp` | key startsWith tenantId+"/" |
| T16 | tenant cannot read other tenant img ref | database | RN03 | userA selects productB.imageKey via RLS | 0 rows | RLS blocks cross-tenant read |
| T17 | filename random/unpredictable | backend | RN04 | two uploads same product/name | distinct random keys, not derived from name | keys differ, no name substring |
| T18 | accepts real image (magic bytes) | backend | RN05 | bytes of valid PNG | 200, processed | sharp accepts, upload runs |
| T19 | rejects fake image (wrong magic bytes) | backend | RN05 | .jpg-named text/exe bytes | 400 ApiErrorDto | rejected, no r2.put |
| T20 | rejects file >5MB | backend | RN06 | 6MB file | 400 "Máximo 5 MB" | schema/handler rejects |
| T21 | accepts file ≤5MB and non-empty | backend | RN06 | 4MB jpeg / 0-byte file | ≤5MB ok; empty → 400 | boundary + empty handled |
| T22 | resize 600x600 contain + WebP | backend | RNF01 | 1200x800 jpeg input | output exatamente 600x600 webp, sem corte, sobra em fundo branco | dims=600x600, format=webp |
| T23 | R2 creds read from env not code | backend | RNF02 | unset R2_* env | client init/upload fails gracefully | reads process.env, no hardcoded secret |
| T24 | display uses lazy-loading | frontend | RNF03 | render grid/table thumb | `<img loading="lazy">` | loading attr present |
| T25 | upload without session → 401 | backend | RF01/sec | POST no auth | 401 ApiErrorDto | requireAuthContext enforced |
| T26 | upload without permission → 403 | backend | sec | POST lacks `produtos` | 403 ApiErrorDto | requirePermission enforced |

### Test File Mapping

| Area | Test File | Test IDs |
|------|-----------|----------|
| validation | `lib/validation/storage.test.ts` | T20, T21 (schema-level), T19 (type whitelist) |
| backend (service) | `lib/services/products/image-service.test.ts` | T07, T11, T17, T18, T19, T22 |
| backend (service) | `lib/services/products/product-service.test.ts` | T01, T02, T08, T09, T12, T13, T14, T15 (integração, HAS_AUTH) |
| backend (storage) | `lib/services/storage/r2-client.test.ts` | T23 |
| backend (route) | `app/api/products/[id]/upload/route.test.ts` | T19, T20, T21, T25, T26 |
| frontend | `components/products/ProductImageUpload.test.tsx` | T03, T04 |
| frontend | `components/products/NewProductForm.test.tsx` | T10 |
| frontend | `components/caixa/CashierScreen.test.tsx` | T05, T06, T24 |
| database | `db/__tests__/products-rls.test.ts` | T16 |

---

## Database

### Entities

| Entity | Table | Key Fields | Reference |
|--------|-------|------------|-----------|
| Product | `products` | `id`, `tenant_id`, `image_key` (nullable text), `image_url` (nullable text) | Existing: `db/schema/products.ts` |

No new tables. Two nullable columns added to the existing `products` table.

### Migration

- ADD COLUMN: `products.image_key` — `text`, nullable, no default (Drizzle: `imageKey`)
- ADD COLUMN: `products.image_url` — `text`, nullable, no default (Drizzle: `imageUrl`)
- No new indexes — columns are not queried directly; access always goes through `tenant_id` scope
- No CHECK constraints — both columns accept any text value; format is enforced at service layer (RN03/RN04/RNF01)
- Migration tool: Drizzle — modify `db/schema/products.ts`, then run `npm run db:setup` (= `db:push` + `db:rls`)
- Reference: `db/schema/products.ts` (existing nullable pattern: `emoji: text("emoji")`)

> WARNING: `drizzle-kit push` drops RLS policies. Always run `npm run db:setup`, never `db:push` alone (CLAUDE.md).

### RLS

Products table already has `tenant_isolation` policy (FOR ALL) covering SELECT/INSERT/UPDATE/DELETE via `tenant_members` subquery — verified in `db/migrations/0001_rls.sql` lines 79–93. No new RLS policy needed; the two new columns are covered automatically by the existing row-level policy.

### Repository

| Method | Purpose |
|--------|---------|
| `updateProduct()` | Extended to patch `imageKey` + `imageUrl` when provided in input |
| `uploadProductImage()` | Saves `imageKey` + `imageUrl` after successful R2 PUT |
| `deleteProductImage()` | Zeroes `imageKey` + `imageUrl` (sets both null) after R2 DELETE |

Reference: `lib/services/products/product-service.ts` (existing `updateProduct` pattern)

---

## Backend

New deps to install: `@aws-sdk/client-s3` (R2 é S3-compatible) e `sharp` (resize + WebP + magic-byte validation). `zod` já presente. Pinar versão estável no install.

### Endpoints
| Method | Path | Request DTO | Response DTO | Status | Purpose |
|--------|------|-------------|--------------|--------|---------|
| POST | /api/products/[id]/upload | UploadProductImageDto (multipart) | ProductImageResponseDto | 200 | Upload/replace product photo, returns imageUrl |
| POST | /api/products/[id]/upload | — | ApiErrorDto | 400 | Invalid file (type/size/empty/not real image RN05/RN06) |
| POST | /api/products/[id]/upload | — | ApiErrorDto | 401 | No session (requireAuthContext fails) |
| POST | /api/products/[id]/upload | — | ApiErrorDto | 403 | Lacks `produtos` permission |
| POST | /api/products/[id]/upload | — | ApiErrorDto | 404 | Product not in tenant (RLS) |

Photo removal reuses a server action (no endpoint), consistent with existing action-based mutations.

### DTOs
| DTO | Fields | Validations |
|-----|--------|-------------|
| UploadProductImageDto | `id` (path), `file` (FormData "file") | id: uuid; file: instanceof File, size>0, size<=5MB (RN06), real image via sharp magic bytes (RN05) |
| ProductImageResponseDto | `imageUrl: string` | URL pública R2 (PUBLIC_URL + key) |
| ProductImageRemoveInput | `id: uuid` | uuid only (server action input) |
| ApiErrorDto | `error: string` | maps domain error → HTTP status |

`image_key`/`image_url` added to existing ProductDto / data mappers (Database section).

### Server Actions & Service Methods
(stack sem CQRS — "commands" são server actions + métodos de service)
{"uploadProductImage (service)":{"triggeredBy":"POST /api/products/[id]/upload route handler","actions":"sharp validate+resize 600x600 contain fundo branco+WebP (RNF01/RN05) → random key sob pasta por loja <slug>-<tenantId>/<uuid>.webp (RN03/RN04) → r2Client.put → withUserRls updateProductRow(imageKey,imageUrl); if old key existed, r2Client.delete old (RF06, swallow failure RF09)"}}
{"removeProductImageAction":{"triggeredBy":"'Remover foto' in edit form","actions":"requireAuthContext + requirePermission('produtos') → service.removeProductImage: read current imageKey under RLS, set imageKey/imageUrl null, r2Client.delete (RF09 tolerant) → revalidatePath('/products')"}}
{"deleteProduct (extend)":{"triggeredBy":"existing product delete","actions":"after row delete, r2Client.delete imageKey if present (RF07, swallow failure RF09)"}}
{"create/updateProduct":{"triggeredBy":"existing forms","actions":"NO photo coupling — product saves even if later upload fails (RF08); upload is a separate post-save call"}}

### Events / Workers
N/A — sem event bus nesta stack; sem job de limpeza de órfãos por design (about.md Scope; RF09 tolera órfãos).

### Module Structure
```text
lib/services/storage/
  r2-client.ts          (new) put(key,bytes,contentType) / delete(key); reads R2 env (RNF02); builds public URL
lib/services/products/
  image-service.ts      (new) validateAndProcess (sharp), randomKey, upload, replace, remove, cleanupOnDelete
  product-service.ts    (mod) call image cleanup in delete; keep create/update photo-decoupled (RF08)
  data.ts               (mod) imageKey/imageUrl in CreateProductData/UpdateProductData + mappers
lib/validation/
  storage.ts            (new) uploadProductImageSchema, imageRemoveSchema
app/(app)/products/
  actions.ts            (mod) removeProductImageAction (uses ActionResult/toActionError)
app/api/products/[id]/upload/
  route.ts              (new) POST: requireAuthContext + requirePermission('produtos'); parse FormData; call image-service; map domain errors → JSON+status
.env.example            (mod) R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL (RNF02)
```
Primeiro route handler do repo — sem precedente em `app/api/`. Referências: `lib/services/products/product-service.ts`, `app/(app)/products/actions.ts`, `lib/services/errors.ts` (ActionResult/toActionError), `db/rls.ts` (withUserRls), `lib/auth.ts` (requireAuthContext).

---

## Frontend

Stack usa local React state (`useState`/`useReducer`) + server actions + um `fetch` ao route handler de upload. NÃO existe TanStack Query / Zustand — não introduzir. Exibição com `<img loading="lazy">` (nenhum `next/image` no repo), então `next.config.ts` remotePatterns NÃO é necessário. Fallback foto → emoji → ícone "📦" (RF05).

### New-product-needs-id (RF01) — two-step UX
O endpoint precisa de um product id, que só existe após o create. Fluxo: NewProductForm submete → `createProductAction` retorna `ProductDto` (com `id`) → se uma foto foi staged (blob local), POST para `/api/products/{id}/upload`, depois redireciona. Falha de foto NÃO bloqueia (RF08): toast de aviso + redireciona; operador reanexa na edição. Em `ProductImageUpload`, sem `productId` (create mode) ele só guarda o File staged + preview blob; o parent dispara o upload após o create. Em edit mode faz upload imediato na seleção.

### Pages
| Route | Page Component | Purpose |
|-------|----------------|---------|
| /products/new | NewProductPage (existing, no change) | hospeda NewProductForm (agora staga foto) |
| /products/[id]/edit | EditProductPage (existing, no change) | hospeda EditProductForm (agora faz upload) |
| /caixa | CashierScreen (existing) | PDV grid/search mostram thumb da foto |

### Components
{"ProductImageUpload":{"location":"components/products/","purpose":"file input + blob preview before save + remove button; staged(create) vs immediate-upload(edit)"},"ProductForm":{"location":"components/products/","purpose":"mod: render ProductImageUpload, expose staged File + imageUrl to parent"},"NewProductForm":{"location":"components/products/","purpose":"mod: after create, POST staged photo to upload route (RF01/RF08)"},"EditProductForm":{"location":"components/products/","purpose":"mod: pass productId so uploads/remove run immediately (RF02/RF06)"},"ProductsTable":{"location":"components/products/","purpose":"mod: add ~40x40 thumb column, fallback foto→emoji→📦"},"CashierScreen":{"location":"components/caixa/","purpose":"mod: replace 36x36 emoji square in grid+compact search with foto fallback"},"Cart":{"location":"components/caixa/","purpose":"mod: 32x32 tile shows foto fallback"}}

### Hooks & State
{"hooks":{"use-cart (mod)":"CartItem gains imageUrl:string|null; reducer maps product.imageUrl into item (add/addWithQty)"},"localState":{"ProductImageUpload":"useState<File|null> stagedFile, useState<string|null> previewUrl (blob ou imageUrl), useState<boolean> uploading; URL.revokeObjectURL no cleanup","forms":"existing useState pattern; upload via fetch POST FormData('file')"},"stores":"none — sem global store no repo"}

### Types (mirror from backend)
{"ProductImageResponseDto":{"fields":"imageUrl: string","sourceDTO":"backend ProductImageResponseDto (fetch .json())"},"ProductDto (extend)":{"fields":"imageKey: string|null; imageUrl: string|null","sourceDTO":"types/product.ts + Database image_key/image_url"},"CartItem (extend)":{"fields":"imageUrl: string|null","sourceDTO":"derived from ProductDto.imageUrl"},"ApiErrorDto":{"fields":"error: string","sourceDTO":"backend ApiErrorDto (non-ok fetch → toast)"}}

Reference: `components/products/ProductForm.tsx`, `components/products/NewProductForm.tsx` (action retorna ProductDto → router.push), `components/products/EditProductForm.tsx`, `components/caixa/CashierScreen.tsx` ~393–400, `components/caixa/Cart.tsx` ~48–63, `components/caixa/use-cart.ts`, `components/products/ProductsTable.tsx`, `app/(app)/products/actions.ts`.

---

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| sharp exige libvips nativa no runtime (Docker/produção) | Média | Build/runtime quebra ao processar imagem | Testar sharp no Docker antes do merge; sharp traz binários pré-compilados p/ a plataforma alvo no install |
| Build estático quebra (página consulta banco/R2) | Média | `docker build` falha (ECONNREFUSED) | `export const dynamic="force-dynamic"` nas páginas afetadas (padrão já documentado no projeto) |
| Credenciais R2 inválidas/ausentes | Média | Upload falha em produção | RF08 já degrada (salva sem foto); validar `.env` no setup; r2-client falha graciosamente |
| Arquivo órfão no R2 ao falhar delete | Baixa | Custo de storage marginal | Tolerado por design (RF09); sem job de limpeza (Scope) |
| Upload lento / arquivo grande | Baixa | UX ruim no cadastro | Limite 5MB (RN06) + sharp reduz p/ ~50KB; `loading="lazy"` na exibição |
| Vazamento cross-tenant via URL | Baixa | Foto de uma loja acessível por outra | Chave aleatória imprevisível (RN04) + listagem do bucket desabilitada (RN03) |

## Validation

Gates obrigatórios (todos exit 0): `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

- **Testes:** 26 casos de contrato (T01–T26) cobrindo 100% de RF01–09 / RN01–06 / RNF01–03 — ver Test Specification. Testes que tocam o banco rodam com Postgres do Docker no ar + `DATABASE_URL`.
- **DB:** `npm run db:setup` após alterar o schema (nunca `db:push` avulso — derruba RLS).
- **Manual:** subir R2 real (bucket + chaves no `.env.local`), cadastrar produto novo com foto, trocar foto (verificar arquivo antigo some do bucket), excluir produto (verificar arquivo some), recarregar PDV (foto aparece, fallback emoji onde não há foto), testar upload de não-imagem (rejeitado) e >5MB (rejeitado).
- **Métricas (about.md):** ≥30% catálogo com foto aos 60d; ≥98% uploads sem erro; peso médio ≤50KB pós-resize.

## Overview

A feature dá a cada produto uma foto real opcional, exibida no PDV e na listagem, com fallback para o emoji existente e depois um ícone genérico. O binário vive no Cloudflare R2; o banco guarda apenas a chave (para deletar) e a URL pública (para exibir). Upload e exibição são desacoplados do cadastro: o produto sempre pode ser salvo mesmo se o R2 falhar.

## Main Flow

Upload (edit): Operador seleciona arquivo → `<input type=file>` onChange → preview blob local (RF03) → `POST /api/products/{id}/upload` (FormData) → route handler: `requireAuthContext` + `requirePermission('produtos')` → image-service: sharp valida (RN05) + resize 600x600 contain (fundo branco) + WebP (RNF01) → chave `<slug-da-loja>-<tenantId>/<uuid>.webp` (RN03/RN04) → `r2Client.put` → `withUserRls` grava imageKey/imageUrl; se havia chave antiga → `r2Client.delete` (RF06, tolerante RF09) → retorna `{imageUrl}` → cliente atualiza preview + `revalidatePath('/products')`.
Upload (novo): create → `createProductAction` retorna `ProductDto` com id → POST staged photo → redirect (falha não bloqueia, RF08).
Exibição: render produto → `imageUrl ? <img loading="lazy"> : emoji ? <span>emoji</span> : 📦` (RF04/RF05/RNF03).
Remover: clicar "Remover foto" → `removeProductImageAction` → service lê imageKey sob RLS → zera colunas → `r2Client.delete` (RF09) → `revalidatePath`.
Excluir produto: `deleteProduct` → row deletada → `r2Client.delete(imageKey)` se presente (RF07, tolerante RF09).

## Implementation Order

1. **Deps + env:** instalar `@aws-sdk/client-s3` + `sharp`; adicionar vars R2 ao `.env.example`.
2. **Database:** colunas `image_key`/`image_url` em `db/schema/products.ts` → `npm run db:setup`.
3. **Backend:** `r2-client.ts` → `lib/validation/storage.ts` → `image-service.ts` → estender `data.ts`/`product-service.ts` → `route.ts` → `removeProductImageAction`.
4. **Frontend:** `ProductImageUpload` → integrar em New/EditProductForm → exibição em CashierScreen/Cart/ProductsTable → estender `use-cart`.
5. **Tests + gates:** escrever T01–T26 → rodar typecheck/lint/test/build.

## Quick Reference

| Pattern | Codebase search term |
|---|---|
| Entity / schema | `db/schema/products.ts` (coluna `emoji` nullable) |
| Repository / data | `lib/services/products/data.ts`, `product-service.ts` |
| Server action | `app/(app)/products/actions.ts` |
| Auth no route/action | `lib/auth.ts` → `requireAuthContext`, `requirePermission` |
| RLS | `db/rls.ts` → `withUserRls`; `db/migrations/0001_rls.sql` |
| Erros / ActionResult | `lib/services/errors.ts` |
| Validation zod | `lib/validation/product.ts` |
| Form pattern | `components/products/ProductForm.tsx` |
| Exibição emoji (PDV) | `components/caixa/CashierScreen.tsx` ~393–400, `Cart.tsx` |
| force-dynamic | páginas que consultam banco/R2 (evita quebrar build Docker) |

## Requirements Coverage

| ID | Requirement | Covered? | Area | Tasks (tasks.md) |
|----|-------------|----------|------|------------------|
| RF01 | Anexar 1 foto no cadastro novo | YES | Backend + Frontend | upload route, image-service, NewProductForm, ProductImageUpload |
| RF02 | Anexar/trocar/remover na edição | YES | Backend + Frontend | EditProductForm, removeProductImageAction, upload route |
| RF03 | Pré-visualização antes de salvar | YES | Frontend | ProductImageUpload (blob preview + remove) |
| RF04 | Exibir foto no PDV e listagem | YES | Frontend | CashierScreen, Cart, ProductsTable |
| RF05 | Fallback foto → emoji → ícone | YES | Frontend | exibição nos 4 sites |
| RF06 | Trocar foto remove arquivo antigo | YES | Backend | image-service (delete old key) |
| RF07 | Excluir produto remove a foto | YES | Backend | deleteProduct (extend) |
| RF08 | Falha de upload não bloqueia salvar | YES | Backend + Frontend | create/update desacoplado, NewProductForm |
| RF09 | Falha de delete tolerada (órfão) | YES | Backend | swallow failure em replace/delete |
| RN01 | Foto opcional | YES | Database + Backend | colunas nullable |
| RN02 | Máximo 1 foto | YES | Backend | upload sobrescreve (single key) |
| RN03 | Chave prefixada por tenant | YES | Backend | image-service key gen + RLS row |
| RN04 | Nome aleatório/imprevisível | YES | Backend | random uuid key |
| RN05 | Só imagem real (magic bytes) | YES | Backend | sharp validate |
| RN06 | Máximo 5 MB | YES | Backend | uploadProductImageSchema |
| RNF01 | Resize ~600px + WebP | YES | Backend | image-service (sharp) |
| RNF02 | Credenciais R2 em env | YES | Backend | r2-client (process.env), .env.example |
| RNF03 | Lazy-loading na exibição | YES | Frontend | `<img loading="lazy">` |

100% dos requisitos mapeados. Escopo "Does NOT Include" (galeria, limite por plano, edição de imagem, job de limpeza) intencionalmente fora — ver {{doc:0016F}}.
