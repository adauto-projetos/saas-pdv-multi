# Discovery: Fotos de Produto com Upload para Cloudflare R2

## Summary
```json
{
  "patterns": ["file-upload", "S3-compatible-storage", "tenant-scoped-assets"],
  "files_create": ["route handler para upload", "service de storage", "validation schema"],
  "files_modify": ["db/schema/products.ts", "lib/services/products/", "components/products/", "lib/validation/product.ts"],
  "deps": ["@aws-sdk/client-s3 (S3-compatible)", "sharp (redimensionamento/validação)", "tiny-invariant (type-safe)"],
  "complexity": "medium",
  "risks": ["CORS/presigned URLs", "tenant-scoped key naming", "file size limits", "cleanup de órfãos"]
}
```

---

## Technical Context

### Stack Relevante
- **Backend:** Next.js 16 (server actions + route handlers) | Drizzle ORM | Postgres
- **Frontend:** React 19 | shadcn/ui + Base UI | React Hook Form | zod v4
- **Infra:** Cloudflare R2 (S3-compatible) | env vars
- **Auth:** local (cookie httpOnly + bcrypt) via lib/auth/

### Identificar Padrões
1. **Multi-tenancy via RLS:** Todos os serviços usam `withUserRls(ctx.userId, ...)` + `ctx.tenantId` injetado na sessão. **Aplicar aqui:** chaves R2 prefixadas por `tenant_id` no bucket.
2. **Server Actions + validação Zod:** Fluxo padrão é `action → parseSchema → requireAuthContext → service → return ActionResult`. **Aplicar aqui:** novo schema `uploadProductImageSchema` + action wrapper para upload.
3. **Form-first UI:** ProductForm usa state local + submit → action. **Aplicar aqui:** input `type="file"` + FormData OR campos separados (foto depois do create).

---

## Codebase Analysis

### Schema de Produtos

**File:** `db/schema/products.ts` (linhas 1–74)

| Campo | Tipo | Atual | Nova adição |
|-------|------|-------|-------------|
| `id` | uuid | PK | — |
| `tenantId` | uuid | FK (obrigatório) | — |
| `name` | text | ✅ | — |
| `emoji` | text | ✅ (nullable) | Fallback visual |
| `barcode` | text | ✅ | — |
| `stockQuantity` | numeric(10,3) | ✅ | — |
| **NEW: `imageKey`** | text | — | **Chave R2 (s3://bucket/tenant_id/random.jpg)** |
| **NEW: `imageUrl`** | text | — | **URL pública presigned/public (cache-buster com versionamento)** |

**Decisão:** Armazenar **AMBOS** chave (para deletar) + URL (para exibir). Evita query extra ao bucket, e URL pode ter expiração/refresh controlado.

---

### Service de Produtos

**File:** `lib/services/products/product-service.ts` (linhas 1–140)

| Função | Muda? | Ação |
|--------|-------|------|
| `createProduct()` | ❌ | Sem mudança — imagem upload é pós-create (RF07 ≠ upload) |
| `updateProduct()` | ✅ | Adiciona suporte a `input.imageKey` + `input.imageUrl` no patch |
| `listProducts()` | ❌ | Sem mudança — já retorna ProductDto com imageUrl |
| `getProduct()` | ❌ | Sem mudança |
| **NEW: `uploadProductImage()`** | ✨ | Valida file (MIME, size), faz upload para R2, salva chave+URL no banco |
| **NEW: `deleteProductImage()`** | ✨ | Remove file do R2 + zera imageKey/imageUrl no banco |

**Padrão:** Service layer não faz HTTP direto. Cria uma classe `R2Client` (lib/services/storage/) que encapsula `@aws-sdk/client-s3`. Service chama `r2Client.put()` / `r2Client.delete()`.

---

### Validation Schemas

**File:** `lib/validation/product.ts` (linhas 1–103)

**Nova adição:**
```typescript
export const uploadProductImageSchema = z.object({
  id: z.uuid("Produto inválido"),
  file: z.instanceof(File)
    .refine((f) => f.size > 0, "Arquivo vazio")
    .refine((f) => f.size <= 5 * 1024 * 1024, "Máximo 5 MB")
    .refine((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type), 
      "Aceita JPEG, PNG ou WebP"),
});

export type UploadProductImageInput = z.infer<typeof uploadProductImageSchema>;
```

---

### Server Actions (Route Handlers vs Actions)

**File:** `app/(app)/products/actions.ts` (linhas 1–100)

**Decisão arquitetural:** Há duas opções.

**Opção A (Recomendada):** Server Action nova + route handler separado para recepcionar FormData
- `app/(app)/products/actions.ts` → `uploadProductImageAction()` (valida + chama service)
- `app/api/products/[id]/upload/route.ts` → POST handler que:
  1. Valida `FormData` com arquivo
  2. Chama `uploadProductImageAction()` do lado do servidor
  3. Retorna JSON com imageUrl / erro

**Opção B:** Tudo em Server Action (sem route handler)
- Server Action recebe `FormData` diretamente do cliente
- Mais simples, menos overhead de rede

**ESCOLHA:** Opção A (better separation, explicit file API endpoint, reutilizável).

---

### UI de Produtos (Forms)

**Files:**
- `components/products/ProductForm.tsx` (linhas 1–120)
- `components/products/EditProductForm.tsx`
- `components/products/NewProductForm.tsx`
- `app/(app)/products/new/page.tsx`
- `app/(app)/products/[id]/edit/page.tsx`

**Padrão atual:** Form com inputs HTML + state local (React.useState). Submission → `onSubmit()` callback → server action.

**Nova adição:**
```tsx
// No ProductForm ou novo componente ProductImageUpload
const [imageBlobUrl, setImageBlobUrl] = React.useState<string | null>(
  defaultValues?.imageUrl ?? null
);
const [uploading, setUploading] = React.useState(false);

async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.currentTarget.files?.[0];
  if (!file) return;
  
  setUploading(true);
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/products/${productId}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    const { imageUrl } = await res.json();
    setImageBlobUrl(imageUrl);
  } catch (err) {
    toast.error("Erro ao enviar foto");
  } finally {
    setUploading(false);
  }
}

// Display: emoji fallback OU foto
{imageBlobUrl ? (
  <img src={imageBlobUrl} alt="Produto" width={100} height={100} />
) : (
  <span style={{ fontSize: 64 }}>{emoji ?? "📦"}</span>
)}
```

**PDV (CashierScreen):** Exibição atual mostra emoji em quadrado 36x36 (linhas 393–400). Se `imageUrl` exist, substitui por `<img>`.

---

### Exibição de Produtos (Emoji → Imagem)

| Localização | Componente | Uso emoji | Mudança |
|-------------|-----------|-----------|---------|
| **Listagem (admin)** | ProductsTable | ❌ (não exibe emoji) | Adicionar coluna foto (thumbnail 40x40) |
| **PDV (caixa)** | CashierScreen (linhas 393–400) | ✅ (36x36 quadrado) | `{imageUrl ? <img> : emoji}` |
| **Carrinho** | Cart.tsx | ✅ | Idem |
| **Search compacto** | CashierScreen (linhas 398–400) | ✅ | Idem |

---

## File Mapping

### Create (Novos Arquivos)

| Arquivo | Propósito |
|---------|-----------|
| `lib/services/storage/r2-client.ts` | Cliente S3-compatible; `put()`, `delete()`, `generatePresignedUrl()` |
| `lib/services/products/image-service.ts` | Lógica upload (validação, redimensionamento, nomes aleatórios, cleanup) |
| `app/api/products/[id]/upload/route.ts` | Route handler POST para upload (recebe FormData, chama service) |
| `lib/validation/storage.ts` | Schemas zod para storage (imageKey, imageUrl, MIME types) |
| `components/products/ProductImageUpload.tsx` | Componente reutilizável: file input + preview + upload |

### Modify (Arquivos Existentes)

| Arquivo | Mudança |
|---------|---------|
| `db/schema/products.ts` | +`imageKey` (text, nullable), +`imageUrl` (text, nullable) |
| `lib/validation/product.ts` | +`uploadProductImageSchema` |
| `lib/services/products/product-service.ts` | +`uploadProductImage()`, +`deleteProductImage()` |
| `lib/services/products/data.ts` | +atualizar queries insert/update para incluir imageKey, imageUrl |
| `app/(app)/products/actions.ts` | +`uploadProductImageAction()`, +`deleteProductImageAction()` |
| `components/products/ProductForm.tsx` | +`ProductImageUpload` sub-component |
| `components/products/EditProductForm.tsx` | +`ProductImageUpload` sub-component |
| `components/products/ProductsTable.tsx` | +coluna com thumb foto/emoji (40x40) |
| `components/caixa/CashierScreen.tsx` | Substituir emoji por imagem (linhas 393–400, etc) |
| `next.config.ts` | `remotePatterns` para R2 domain (se usando presigned URLs com domínio público) |
| `.env.example` | +`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ACCESS_KEY_ID`, `CLOUDFLARE_SECRET_ACCESS_KEY`, `CLOUDFLARE_BUCKET_NAME` |

---

## Padrão de Ambientes & Env

**Atual (linhas do .env.example):**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pdv
SESSION_SECRET=troque-por-um-valor-aleatorio-bem-longo
```

**Nova adição:**
```
# Cloudflare R2 (S3-compatible)
CLOUDFLARE_ACCOUNT_ID=xxxx
CLOUDFLARE_BUCKET_NAME=pdv-product-images
CLOUDFLARE_ACCESS_KEY_ID=xxxx
CLOUDFLARE_SECRET_ACCESS_KEY=xxxx
# URL pública do bucket (ou gerada via presigned URL)
CLOUDFLARE_BUCKET_PUBLIC_URL=https://pdv.r2.cloudflarestorage.com
```

**Padrão de leitura:** direto `process.env.CLOUDFLARE_ACCESS_KEY_ID` em `lib/services/storage/r2-client.ts` (lado servidor). Não exponha secrets no cliente.

---

## Integration Points (CRÍTICO)

### 1. **Fluxo de Upload**
```
User seleciona arquivo
  ↓
<input type="file"> onChange
  ↓
Validação client-side (zod em FormData context)
  ↓
POST /api/products/{id}/upload
  ↓
Route handler:
  - Valida FormData
  - Chama uploadProductImageService(ctx, file, productId)
  ↓
Service (withUserRls):
  - sharp: redimensiona p/ 600x600 contain (fundo branco, sem corte) + WebP
  - Gera chave aleatória: {tenantId}/{uuid}.jpg
  - S3 PUT para R2
  - Salva imageKey + imageUrl no banco via data.updateProductRow()
  ↓
Retorna { imageUrl }
  ↓
Cliente atualiza preview + state
  ↓
RevalidatePath("/products")
```

### 2. **Exibição (PDV)**
```
CashierScreen renderiza produtos
  ↓
Para cada produto:
  - if (product.imageUrl) → <img src={imageUrl} alt="" width={36} height={36} />
  - else → <span>{emoji ?? "📦"}</span>
```

### 3. **Deletar Imagem**
```
User clica "Remover foto" em edit
  ↓
Chama deleteProductImageAction(productId)
  ↓
Service:
  - Recupera imageKey do banco
  - S3 DELETE para R2
  - Zera imageKey + imageUrl no banco
  ↓
RevalidatePath + toast success
```

### 4. **Tenant Scoping**
```
Chave no R2: {tenantId}/{random-uuid}.jpg
  ↓
Acesso controla via RLS:
  - updateProduct() roda sob withUserRls(userId)
  - Injeta GUC `app.current_user_id`
  - RLS policy filtra pelo tenant do usuário
  - Se alguém tenta acessar imageKey de outro tenant → RLS nega query
```

---

## Dependencies

### Externas (package.json)

| Lib | Versão | Propósito |
|-----|--------|----------|
| `@aws-sdk/client-s3` | ^3.x | Cliente S3-compatible (R2 é S3 API) |
| `sharp` | ^0.x | Redimensionamento, validação, otimização de imagens |
| `zod` | ^4.4.3 | **Já existe** — usado para validação de campos |

### Internas

| Módulo | Uso |
|--------|-----|
| `db/rls.ts` | `withUserRls()` para injetar tenant em transações |
| `lib/auth/index.ts` | `requireAuthContext()` no route handler |
| `lib/services/errors.ts` | `ConflictError`, `UnauthorizedError`, `ActionResult` |
| `lib/validation/product.ts` | Schemas zod existentes |

---

## Technical Assumptions

1. **R2 é S3-compatible:** @aws-sdk/client-s3 funciona direto com endpoint R2 (endpoint `https://ACCOUNT_ID.r2.cloudflarestorage.com`).
2. **Imagens são públicas:** URL retornada é acessível sem auth (bucket configured public ou presigned URLs com longa expiração).
3. **Não há cleanup automático de órfãos:** Se delete `Product` sem deletar antes a imagem, arquivo fica orphaned no R2. Considerar job de limpeza pós-MVP.
4. **Sharp está disponível:** Precisa de libvips nativa no runtime (ou camada binária no Docker/Vercel). Testar antes em produção.
5. **Tenant ID é sempre disponível em RLS:** `ctx.tenantId` vem de sessão validada, nunca do input.

---

## Identified Risks

| Risk | Mitigation |
|------|-----------|
| **Arquivo muito grande / slow upload** | Limitar a 5 MB no schema + timeout no fetch (30s). Sharp reduz para ~100KB. |
| **Malicious MIME types** | Whitelist apenas image/jpeg, image/png, image/webp. Validar magic bytes com sharp. |
| **Acesso cross-tenant** | Chave prefixada {tenantId} + RLS na updateProduct query. Dupla proteção. |
| **Orphaned files** | Deletar imageKey do R2 ANTES de zerar imageKey no DB, ou usar transação. |
| **Presigned URL expiration** | Se URL presigned com TTL curto, cliente não consegue exibir. Use TTL long (e.g., 1 ano) ou URL pública. |
| **R2 doesn't exist / credentials invalid** | Testar conexão no startup (health check) ou fail gracefully com fallback emoji. |
| **Build estático quebra** | PDV page usa `export const dynamic = "force-dynamic"` — OK. Product edit page também precisa. |

---

## File Structure (Resumo Visual)

```
lib/
├── services/
│   ├── storage/
│   │   └── r2-client.ts              (novo)
│   └── products/
│       ├── product-service.ts        (modifica: +upload, +delete)
│       ├── image-service.ts          (novo)
│       └── data.ts                   (modifica: imageKey, imageUrl)
├── validation/
│   ├── product.ts                    (modifica: +uploadImageSchema)
│   └── storage.ts                    (novo)
└── auth/
    └── index.ts                      (usa, sem mudança)

components/
└── products/
    ├── ProductImageUpload.tsx        (novo)
    ├── ProductForm.tsx               (modifica: +ProductImageUpload)
    ├── EditProductForm.tsx           (modifica: +ProductImageUpload)
    ├── ProductsTable.tsx             (modifica: +coluna foto)
    └── CashierScreen.tsx             (modifica: imagem vs emoji)

app/
├── (app)/
│   ├── products/
│   │   ├── actions.ts                (modifica: +uploadImageAction)
│   │   ├── [id]/edit/page.tsx        (modifica: força dynamic)
│   │   └── new/page.tsx              (modifica: força dynamic)
│   └── caixa/
│       └── page.tsx                  (modifica: força dynamic se não tiver)
└── api/
    └── products/
        └── [id]/
            └── upload/
                └── route.ts          (novo)

db/
└── schema/
    └── products.ts                   (modifica: +imageKey, +imageUrl)

docs/
└── features/
    └── 0016F-fotos-produto/
        └── discovery.md              (este arquivo)

.env.example                           (modifica: +R2 vars)
next.config.ts                         (modifica: remotePatterns para R2)
```

---

## Planning Summary

Complexidade **MEDIUM**:
- ✅ Stack já tem infra de multi-tenancy (RLS funciona)
- ✅ Validação (zod) e server actions existem
- ⚠️ Precisa novo cliente S3 (lib) + route handler API
- ⚠️ Sharp deve ser testado em produção
- ⚠️ Dois pontos de integração (schema + UI + service)

**Atenção especial:**
1. **Tenant scoping da chave R2** — validar que `{tenantId}` está prefixado
2. **Sharp em produção** — testar redimensionamento no Docker/Vercel antes de mergear
3. **RLS após upload** — confirmar que updateProductRow roda sob `withUserRls` (já faz, mas verificar)
4. **Emoji fallback** — garantir que se imageUrl falha ou expiração, emoji aparece

---

## Updates
[{"date":"2026-06-27","change":"Initial discovery: schema, services, UI, R2 integration, env patterns, risks"}]

---

## Metadata
```json
{
  "updated": "2026-06-27",
  "sessions": 1,
  "by": "discovery-agent",
  "feature": "0016F-fotos-produto"
}
```
