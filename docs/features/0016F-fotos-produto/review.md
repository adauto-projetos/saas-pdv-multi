# Review: 0016F-fotos-produto

> **Date:** 2026-06-27 | **Branch:** feature/0016F-fotos-produto

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` → exit 0; route `ƒ /api/products/[id]/upload` registrada (nodejs runtime) |
| Spec Compliance | ✅ PASSED | 24/24 itens da Acceptance Checklist compliant; RF01–09, RN01–06, RNF01–03 cobertos |
| Code Review Score | ✅ PASSED | 9.75/10 (backend 10 + frontend 9.5) — threshold ≥ 7 |
| Product Validation | ✅ PASSED | RF: 9/9, RN: 6/6, RNF: 3/3 implementados e verificados em file:line |
| Validation Gates | ✅ PASSED | `npm run typecheck` → 0 · `npm run lint` → 0 (7 warnings, sem erros) · `npx vitest run` → 0 (486 passed) · `npm run build` → 0 |
| **Overall** | **✅ PASSED** | **Pronto para merge** |

> Reviewed at: 2026-06-27 · Reviewed by: /add.review (model: claude-opus-4-8[1m])

## Spec Compliance Audit

| Item | Type | Expected (plan.md / about.md) | Found at | Status |
|------|------|-------------------------------|----------|--------|
| Route upload FormData → 200 {imageUrl} | Route | POST /api/products/[id]/upload | `app/api/products/[id]/upload/route.ts:21` | COMPLIANT |
| Service grava imageKey/imageUrl pós-PUT | Service | uploadProductImage | `lib/services/products/product-service.ts:99` | COMPLIANT |
| Troca persiste nova ref (upload imediato) | Frontend | edit mode immediate | `components/products/ProductImageUpload.tsx:80` | COMPLIANT |
| removeProductImageAction zera + deleta R2 | Action | server action | `app/(app)/products/actions.ts:107` | COMPLIANT |
| Preview blob staged + remover (pré-save) | Frontend | RF03 | `ProductImageUpload.tsx:65,104` | COMPLIANT |
| PDV + listagem renderizam `<img>` | Frontend | RF04 | `CashierScreen.tsx:399,533`; `ProductsTable.tsx:35` | COMPLIANT |
| Cadeia imageUrl → emoji → 📦 (4 sites) | Frontend | RF05 | ProductsTable, CashierScreen (grid+busca), Cart | COMPLIANT |
| delete(oldKey) ao trocar foto | Service | RF06 | `image-service.ts:93` | COMPLIANT |
| deleteProduct chama delete(imageKey) | Service | RF07 | `product-service.ts:177` | COMPLIANT |
| create/update desacoplados da foto | Service | RF08 | `product-service.ts` (sem coupling) | COMPLIANT |
| NewProductForm warn toast + redirect | Frontend | RF08 | `NewProductForm.tsx:31,43` | COMPLIANT |
| Falha de r2.delete engolida | Service | RF09 | `image-service.ts:104` (safeDelete) | COMPLIANT |
| create sem foto → imageKey/url null | Backend | RN01 | `data.ts` mapper + schema nullable | COMPLIANT |
| 2º upload sobrescreve (1 key) | Service | RN02 | `product-service.ts:123` | COMPLIANT |
| Chave na pasta por loja + RLS | Service/DB | RN03 | `image-service.ts:69` `<slug>-<tenantId>`; RLS T16 | COMPLIANT ⚠️ |
| UUID aleatório, não derivado do nome | Service | RN04 | `image-service.ts:74` | COMPLIANT |
| sharp valida magic bytes → 400 | Service | RN05 | `image-service.ts:29` | COMPLIANT |
| Rejeita >5MB e vazio | Validation | RN06 | `lib/validation/storage.ts:30` | COMPLIANT |
| WebP 600x600 contain fundo branco | Service | RNF01 | `image-service.ts:38` | COMPLIANT |
| R2 creds de process.env | Storage | RNF02 | `r2-client.ts:27` + `.env.example` | COMPLIANT |
| `<img loading="lazy">` na exibição | Frontend | RNF03 | 5 imgs de exibição | COMPLIANT |
| 401 sem sessão | Route | sec | `route.ts:31` | COMPLIANT |
| 403 sem permissão `produtos` | Route | sec | `route.ts:36` | COMPLIANT |
| RLS bloqueia leitura cross-tenant | DB | RN03 | `db/__tests__/products-rls.test.ts` (T16) | COMPLIANT |

**Resumo:** 24/24 COMPLIANT · 0 DIVERGENT · 0 MISSING · 0 STALE_TICK · RF/RN coverage 100% → **SPEC_AUDIT_STATUS = COMPLIANT**

⚠️ Nota: o pivot registrado em `decisions.jsonl` mudou a pasta de `<tenantId>/` para `<slug>-<tenantId>/`. O comportamento, os testes (`product-service.test.ts:234` → `loja-a-${tenantId}`) e o about.md (RN03) já refletiam o pivot. Comentários cosméticos que ainda citavam `<tenant_id>/<uuid>.webp` (`db/schema/products.ts`, `types/product.ts`) e o texto da checklist em `tasks.md` foram **corrigidos neste review** para `<slug-da-loja>-<tenantId>/<uuid>.webp`. Sem impacto funcional.

## Code Review Summary

### Backend — Score 10/10 (sem correções)
- Layering correto: route → service → image-service/data → r2-client; service é HTTP-free; route é a única camada ciente de HTTP.
- `withUserRls` envolve todo acesso ao banco; I/O do R2 ocorre **fora** da transação (correto).
- Segurança: auth(401)+permissão(403) antes de ler o corpo; sem segredos hardcoded; validação por magic bytes (não confia no MIME do cliente); limite 5MB; chave UUID aleatória; `tenantId` sempre do `ctx`.
- Crash-safety de `removeProductImage`: deleta o arquivo no R2 **antes** de zerar a ref no banco (chave retryable em vez de órfão sem rastro) — raciocínio válido.
- Init preguiçosa do `r2-client` (memoizada) → import do módulo não lê env → build estático seguro sem `R2_*`.

### Frontend — Score 9.5/10 (3 correções LOW aplicadas)
- Ciclo de vida do blob correto: `revokeObjectURL` no change e no unmount, com guarda `isBlobUrl` (nunca revoga URL do R2, nem revoga em dobro).
- Modo staged (create) vs upload imediato (edit) corretos; EditProductForm ignora `stagedImage`.
- RF08: NewProductForm avisa e **mesmo assim** redireciona em falha de upload.
- **Correções aplicadas:** fallback de emoji vazio `?? "📦"` → `|| "📦"` em `CashierScreen.tsx` (busca compacta + grid) e `Cart.tsx:71`, alinhando os 4 sites de exibição ao check truthy já usado em `ProductsTable`. Sem isso, `emoji === ""` renderizaria um tile em branco em vez de cair no 📦.

## Product Validation

| Grupo | Resultado |
|-------|-----------|
| RF01–RF09 | 9/9 PASS |
| RN01–RN06 | 6/6 PASS |
| RNF01–RNF03 | 3/3 PASS |
| Pré-requisitos (deps `@aws-sdk/client-s3`, `sharp`; colunas `image_key`/`image_url`; vars `R2_*` no `.env.example`) | Presentes |

**Product Status: PASSED**

## Files Modified During Review
- `components/caixa/CashierScreen.tsx` (fallback emoji vazio → 📦, 2 sites)
- `components/caixa/Cart.tsx` (fallback emoji vazio → 📦)
- `db/schema/products.ts`, `types/product.ts`, `tasks.md` (comentários/texto da chave R2 alinhados ao pivot `<slug>-<tenantId>/`)

## Next Steps
- ✅ Pronto para `/add.done` (merge + changelog + bump de versão).
- Lembrete operacional: produção exige as 5 vars `R2_*` no ambiente (`npm run r2:check` valida) — ver memória `r2-product-photos-env`.
