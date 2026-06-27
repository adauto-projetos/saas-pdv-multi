---
id: CHG0016
type: changelog
date: 2026-06-27
related: [0016F]
---

## TL;DR

Cada produto pode ter 1 foto real enviada no cadastro ou edição. O arquivo é redimensionado para WebP 600x600 (contain, fundo branco) e armazenado no Cloudflare R2 sob chave `<slug-loja>-<tenantId>/<uuid>.webp`; o banco guarda só a referência (`image_key` + `image_url`). A foto aparece no PDV e na listagem com cadeia de fallback foto → emoji → 📦. Upload e remoção do produto são desacoplados: falha de R2 não bloqueia o cadastro, e arquivos antigos são removidos do bucket ao trocar/excluir.

## Changes

- feat(storage): cliente R2 (`lib/services/storage/r2-client.ts`) com init preguiçosa memoizada (`put`/`delete`) lendo `R2_*` de `process.env` — import do módulo não toca env, mantendo build estático seguro sem credenciais
- feat(products): `image-service.ts` — valida magic bytes via `sharp`, redimensiona para WebP 600x600 contain/fundo branco, gera chave `<slug-loja>-<tenantId>/<uuid>.webp` (nome aleatório), `safeDelete` engole falha de remoção (órfão tolerado)
- feat(api): route handler `POST /api/products/[id]/upload` (nodejs runtime) — auth 401 + permissão `produtos` 403 antes de ler o corpo, FormData → 200 `{imageUrl}`
- feat(products): `product-service.ts` — `uploadProductImage` grava `imageKey`/`imageUrl` pós-PUT e deleta a chave antiga ao trocar; `deleteProduct` remove o arquivo no R2; create/update desacoplados da foto
- feat(actions): `removeProductImageAction` (`app/(app)/products/actions.ts`) zera as colunas e deleta o objeto no R2 (deleta antes de zerar a ref → chave retryable, não órfão sem rastro)
- feat(ui): `ProductImageUpload.tsx` — preview blob staged no create (com remover pré-save) e upload imediato no edit; ciclo de vida do blob com `revokeObjectURL` no change/unmount guardado por `isBlobUrl`
- feat(ui): exibição da foto com `<img loading="lazy">` no PDV (`CashierScreen` grid + busca), listagem (`ProductsTable`) e `Cart`, com fallback truthy foto → emoji → 📦 nos 4 sites
- feat(forms): `NewProductForm`/`EditProductForm`/`ProductForm` integram o upload; `NewProductForm` avisa via toast e **mesmo assim** redireciona se o upload falhar (RF08)
- feat(db): colunas `image_key`/`image_url` (nullable) em `db/schema/products.ts` + mapper em `data.ts`; RLS protege a linha do produto (teste cross-tenant T16 em `products-rls.test.ts`)
- feat(validation): `lib/validation/storage.ts` — rejeita arquivos >5 MB e vazios
- feat(env): vars `R2_*` documentadas no `.env.example` + `scripts/r2-check.ts` (`npm run r2:check`) para validar o ambiente de produção
- chore(deps): `@aws-sdk/client-s3` e `sharp` adicionados
- test: gates verdes — typecheck 0 erros, lint 0 erros (7 warnings), 486 testes passando, build com rota `/api/products/[id]/upload` registrada

## Breaking

- Nenhuma para dados existentes. Produtos sem foto continuam válidos (colunas nullable, fallback emoji/ícone preservado). **Operacional:** produção exige as 5 vars `R2_*` no ambiente — sem elas o upload falha (mas o cadastro do produto não bloqueia).

## Migration

- `npm run db:setup` (ou `db:push` + `db:rls`) para criar as colunas `image_key`/`image_url`.
- Provisionar bucket Cloudflare R2 com **listagem desabilitada** e domínio público; preencher as 5 vars `R2_*` (access key, secret, endpoint/account id, bucket, URL pública). Validar com `npm run r2:check`.

## Quick Ref

```json
{"id":"0016F","domain":"fotos de produto (R2 object storage)","touched":["lib/services/storage/","lib/services/products/","app/api/products/[id]/upload/","app/(app)/products/","components/products/","components/caixa/","lib/validation/","db/schema/","scripts/"],"patterns":["object storage externo (R2) com referência no banco","multi-tenancy por prefixo de chave + RLS na linha","lazy R2 client (build estático sem env)","desacoplamento foto vs produto (falha não bloqueia)","validação por magic bytes (sharp)"],"keywords":["foto","imagem","upload","R2","Cloudflare","sharp","webp","FormData","fallback emoji","multi-tenant"]}
```
