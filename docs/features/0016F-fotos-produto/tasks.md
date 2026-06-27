# Tasks: Fotos de Produto

## Metadata

| Field | Value |
|-------|-------|
| Complexity | COMPLEX |
| Total tasks | 18 |
| Services | infra, database, backend, frontend, test |

> COMPLEX (18 > 13). Not split as an epic by design: single bounded feature (1 photo per product) with one new external boundary (R2 storage) and a shared image pipeline that would fragment poorly across subfeatures. Scope is cohesive; the task count comes from the 4 display sites + new storage client, not from multiple domains.

## Requirements Coverage

- [x] RF01 — Anexar 1 foto no cadastro de novo produto
- [x] RF02 — Anexar/trocar/remover foto na edição
- [x] RF03 — Pré-visualização antes de salvar, com remover
- [x] RF04 — Exibir foto no PDV e na listagem
- [x] RF05 — Fallback foto → emoji → ícone genérico
- [x] RF06 — Trocar foto remove o arquivo antigo no R2
- [x] RF07 — Excluir produto remove sua foto no R2
- [x] RF08 — Falha de upload não bloqueia salvar o produto
- [x] RF09 — Falha de delete de arquivo é tolerada (órfão)
- [x] RN01 — Foto é opcional; produto sem foto é válido
- [x] RN02 — No máximo 1 foto por produto
- [x] RN03 — Chave do arquivo prefixada por tenant_id
- [x] RN04 — Nome do arquivo aleatório/imprevisível
- [x] RN05 — Aceita só imagem real (magic bytes)
- [x] RN06 — Tamanho máximo de 5 MB
- [x] RNF01 — Redimensiona p/ 600x600 contain (fundo branco) + WebP
- [x] RNF02 — Credenciais R2 em variáveis de ambiente
- [x] RNF03 — Lazy-loading na exibição (PDV/listagem)

## TDD

- [x] T-TEST-01 Schema de upload: tamanho/vazio/tipo (RN06, RN05) — `lib/validation/storage.test.ts`
- [x] T-TEST-02 image-service: validação real, resize/WebP, chave aleatória, delete tolerante (RN05, RNF01, RN04, RF07, RF09) — `lib/services/products/image-service.test.ts`
- [x] T-TEST-03 r2-client lê credenciais do env, não do código (RNF02) — `lib/services/storage/r2-client.test.ts`
- [x] T-TEST-04 product-service: upload/replace/delete/decoupled/opcional/prefixo-tenant (RF01, RF02, RF07, RF08, RF09, RN01, RN02, RN03) — `lib/services/products/product-service.test.ts`
- [x] T-TEST-05 route handler: rejeições, auth e permissão (RN05, RN06, RF01, sec) — `app/api/products/[id]/upload/route.test.ts`
- [x] T-TEST-06 RLS bloqueia leitura cross-tenant da referência (RN03) — `db/__tests__/products-rls.test.ts`
- [x] T-TEST-07 ProductImageUpload: staged preview + remover (RF03) — `components/products/ProductImageUpload.test.tsx`
- [x] T-TEST-08 NewProductForm: upload pós-create, falha não bloqueia (RF01, RF08) — `components/products/NewProductForm.test.tsx`
- [x] T-TEST-09 CashierScreen: exibe foto, fallback e lazy-loading (RF04, RF05, RNF03) — `components/caixa/CashierScreen.test.tsx`

## Execution

- [x] T01 Instalar deps de storage e imagem
  - Service: infra
  - Files: `package.json`
  - Deps: -
  - Verify: `npm ls @aws-sdk/client-s3 sharp` exits 0

- [x] T02 Documentar variáveis R2 no env de exemplo
  - Service: infra
  - Files: `.env.example`
  - Deps: -
  - Verify: `grep -q R2_PUBLIC_URL .env.example`

- [x] T03 Adicionar colunas image_key/image_url ao schema
  - Service: database
  - Files: `db/schema/products.ts`
  - Deps: -
  - Verify: `npm run db:setup` exits 0; columns present in `products`

- [x] T04 Schema de validação do upload (size/empty/type)
  - Service: backend
  - Files: `lib/validation/storage.ts`
  - Deps: -
  - Verify: `npm test -- storage` exits 0

- [x] T05 Cliente R2: put/delete + URL pública, env-driven
  - Service: backend
  - Files: `lib/services/storage/r2-client.ts`
  - Deps: T01, T02
  - Verify: `npm test -- r2-client` exits 0

- [x] T06 image-service: validate+resize+WebP, chave aleatória
  - Service: backend
  - Files: `lib/services/products/image-service.ts`
  - Deps: T04, T05
  - Verify: `npm test -- image-service` exits 0

- [x] T07 Mappers/data: imageKey/imageUrl no row e no DTO
  - Service: backend
  - Files: `lib/services/products/data.ts`
  - Deps: T03
  - Verify: `npm run typecheck` exits 0

- [x] T08 product-service: upload/replace/remove + delete decoupled
  - Service: backend
  - Files: `lib/services/products/product-service.ts`
  - Deps: T06, T07
  - Verify: `npm test -- product-service` exits 0

- [x] T09 Route handler POST upload com auth+permissão
  - Service: backend
  - Files: `app/api/products/[id]/upload/route.ts`
  - Deps: T08
  - Verify: `npm test -- upload/route` exits 0

- [x] T10 Server action removeProductImageAction
  - Service: backend
  - Files: `app/(app)/products/actions.ts`
  - Deps: T08
  - Verify: `npm run typecheck` exits 0

- [x] T11 ProductImageUpload: input + preview blob + remover
  - Service: frontend
  - Files: `components/products/ProductImageUpload.tsx`
  - Deps: T09, T10
  - Verify: `npm test -- ProductImageUpload` exits 0

- [x] T12 Integrar upload no ProductForm (staged vs imediato)
  - Service: frontend
  - Files: `components/products/ProductForm.tsx`
  - Deps: T11
  - Verify: `npm run typecheck` exits 0

- [x] T13 NewProductForm: upload pós-create, falha não bloqueia
  - Service: frontend
  - Files: `components/products/NewProductForm.tsx`
  - Deps: T12
  - Verify: `npm test -- NewProductForm` exits 0

- [x] T14 EditProductForm: upload/remove imediato com productId
  - Service: frontend
  - Files: `components/products/EditProductForm.tsx`
  - Deps: T12
  - Verify: `npm run typecheck` exits 0

- [x] T15 Coluna thumb na listagem (fallback foto→emoji→📦)
  - Service: frontend
  - Files: `components/products/ProductsTable.tsx`
  - Deps: T07
  - Verify: `npm run typecheck` exits 0

- [x] T16 CartItem.imageUrl no reducer do carrinho
  - Service: frontend
  - Files: `components/caixa/use-cart.ts`
  - Deps: T07
  - Verify: `npm run typecheck` exits 0

- [x] T17 Exibir foto no PDV: grid/busca + carrinho, lazy
  - Service: frontend
  - Files: `components/caixa/CashierScreen.tsx`, `components/caixa/Cart.tsx`
  - Deps: T16
  - Verify: `npm test -- CashierScreen` exits 0

- [x] T18 RLS: leitura cross-tenant da referência bloqueada
  - Service: test
  - Files: `db/__tests__/products-rls.test.ts`
  - Deps: T03
  - Verify: `npm test -- products-rls` exits 0

## Acceptance Checklist

- [x] Route `POST /api/products/[id]/upload` recebe FormData "file" e retorna 200 `{imageUrl}` (RF01)
- [x] Service grava `imageKey`/`imageUrl` no produto após PUT no R2 (RF01)
- [x] Edição substitui a foto: nova referência persistida via upload imediato (RF02)
- [x] Server action `removeProductImageAction` zera `imageKey`/`imageUrl` e deleta do R2 (RF02)
- [x] `ProductImageUpload` mostra preview blob staged e botão remover antes de salvar (RF03)
- [x] PDV (`CashierScreen`) e listagem (`ProductsTable`) renderizam `<img>` quando há `imageUrl` (RF04)
- [x] Exibição resolve cadeia `imageUrl` → `emoji` → ícone "📦" nos 4 sites (RF05)
- [x] image-service chama `r2Client.delete(oldKey)` ao trocar foto existente (RF06)
- [x] `deleteProduct` chama `r2Client.delete(imageKey)` quando presente (RF07)
- [x] `createProduct`/`updateProduct` salvam sem acoplar foto; upload é pós-save (RF08)
- [x] NewProductForm emite toast de aviso e redireciona quando upload falha (RF08)
- [x] Falha de `r2.delete` em replace/delete é engolida; operação principal conclui (RF09)
- [x] `createProduct` sem campos de foto produz produto válido com `imageKey`/`imageUrl` null (RN01)
- [x] Segundo upload sobrescreve: apenas uma `imageKey` por produto, antiga removida (RN02)
- [x] Chave gerada fica sob a pasta por loja `<slug-da-loja>-<tenantId>/` (RN03)
- [x] RLS bloqueia leitura da referência de produto de outro tenant (RN03)
- [x] Chave usa UUID aleatório, não derivado do nome/dados do produto (RN04)
- [x] sharp valida por magic bytes; arquivo falso (`.jpg` com bytes não-imagem) → 400, sem `r2.put` (RN05)
- [x] `uploadProductImageSchema` rejeita arquivo >5MB e arquivo vazio (0 byte) (RN06)
- [x] image-service produz WebP de exatamente 600x600 (contain, sobra em fundo branco, sem corte) (RNF01)
- [x] `r2-client` lê `R2_*` de `process.env`, sem segredo hardcoded (RNF02)
- [x] Imagens na grade/tabela usam `<img loading="lazy">` (RNF03)
- [x] Route handler retorna 401 sem sessão (`requireAuthContext`) (RF01)
- [x] Route handler retorna 403 sem permissão `produtos` (`requirePermission`) (RF02)

## Validation Gates

- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures
