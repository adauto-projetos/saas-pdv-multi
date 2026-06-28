---
id: 0018F
type: feature-plan
slug: rebrand-logo
created: 2026-06-27
updated: 2026-06-27
related: [0018F]
---

# Plan: 0018F — rebrand-logo (PDV.multi → PDV.ART.br)

## Overview

Rebrand do produto de "PDV.multi" para "PDV.ART.br" (alinhado ao domínio pdv.art.br) em 12 superfícies textuais, mais introdução do logotipo no login/signup (tema escuro + logo fundo preto), no caixa (logo fundo branco), marca em texto estilizado na sidebar/admin/manual, recibo com o nome da loja + rodapé "via PDV.ART.br", e favicon próprio. Os dois PNGs de logo (1.1 MB / 1.5 MB) são convertidos para WebP < 100 KB cada.

Feature majoritariamente frontend. Única mudança de dados: estender o server action `getSaleReceiptAction` para o `ReceiptDto` carregar `storeName` (lido de `tenants.name`, escopado por tenant sob RLS).

## Main Flow

1. **Lojista** abre `/login` ou `/signup` → vê tela em tema escuro com o logo de fundo preto acima do card (RF02).
2. **Lojista** entra no PDV (`/caixa`) → header da `CaixaShell` exibe o logo de fundo branco (RF03).
3. **Lojista** finaliza uma venda → `PaymentDialog` chama `getSaleReceiptAction`, que retorna `storeName` (= `tenants.name`); o recibo impresso mostra o nome da loja no cabeçalho + rodapé "via PDV.ART.br" (RF05/RN02).
4. **Qualquer usuário** vê a marca em texto "PDV.ART.br" na sidebar, no header admin e na intro do manual (RF04/RN01), e o favicon na aba (RF06).

## Implementation Order

1. **Assets** — converter logos para WebP, renomear, criar `app/icon.png`, deletar PNGs originais (RNF01/RF06).
2. **Backend** — adicionar `storeName` ao `ReceiptDto` em `receipt-actions.ts` (RF05/RN02). Desbloqueia o recibo no frontend.
3. **Frontend** — trocas de texto (RF01), tema escuro + logo no auth (RF02/RNF02), logo no caixa (RF03), marca em texto (RF04), render do recibo (RF05), favicon herdado (RF06).
4. **Tests/Gates** — assets/grep + DTO + fallback; verificação manual das telas visuais.

## Quick Reference

| Padrão | Buscar no codebase |
|---|---|
| Server action de recibo | `app/(app)/caixa/receipt-actions.ts` (`getSaleReceiptAction`, `ReceiptDto`) |
| Tabela de tenant | `db/schema/tenants.ts` (coluna `name`) |
| RLS / tenant scope | `db/rls.ts` (`withUserRls`), `requireAuthContext` |
| Padrão de imagem | `<img loading="lazy">` em `components/products/ProductImageUpload.tsx:135` (NÃO next/image) |
| Pipeline de imagem (sharp) | feature 0016F (R2/WebP) |
| Card / tokens de tema | `components/ui/card.tsx` (`bg-card`, `text-foreground`) |
| Marca em texto atual | `components/layout/AppSidebar.tsx:239`, `app/(admin)/layout.tsx:57` |

---

## Test Specification

### Contract Tests (from RFs/RNs)

| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | No "PDV.multi" left in repo | asset | RF01 | grep -r "PDV.multi" (src, excl. docs/node_modules) | 0 matches | match count === 0 |
| T02 | Receipt DTO exposes storeName | backend | RF05/RN02 | getSaleReceiptAction(saleId), tenants.name mocked | ok:true, data.storeName === tenant name | data.storeName equals mocked name |
| T03 | storeName scoped to session tenant (RLS) | backend | RN02 | real action, Postgres up, sale of tenant A | storeName = tenant A name, not B | DB-touching; skip w/o DATABASE_URL |
| T04 | Receipt for foreign sale rejected | backend | RN02 | getSaleReceiptAction(saleId of other tenant) | ok:false "Venda não encontrada" | no storeName leaked |
| T05 | Empty store name falls back to brand | frontend | RN02 | PaymentDialog receipt.storeName = "" | header renders "PDV.ART.br" | rendered header text === "PDV.ART.br" |
| T06 | Receipt footer shows via-brand | frontend | RF05 | PaymentDialog print template | footer contains "via PDV.ART.br" | template string includes "via PDV.ART.br" |
| T07 | Login/signup logo asset < 100 KB | asset | RNF01 | stat public/logo-dark.webp | size < 102400 bytes | byte size < 100 KB |
| T08 | Caixa logo asset < 100 KB | asset | RNF01 | stat public/logo-light.webp | size < 102400 bytes | byte size < 100 KB |
| T09 | Logo assets are WebP | asset | RNF01 | read magic bytes of both logos | RIFF/WEBP header | first bytes === "RIFF"..."WEBP" |
| T10 | Old PNG logos removed | asset | RNF01/RF01 | ls public/ | no "logo (1).png"/"logo (2).png" | files absent |
| T11 | Favicon asset present | asset | RF06 | exists app/icon.png | file exists | path resolvable |
| MV1 | Login/signup dark theme + logo-dark above card | manual | RF02 | open /login, /signup | dark bg, logo above CardTitle | visual inspection |
| MV2 | Caixa header shows logo-light | manual | RF03 | open PDV/caixa | logo-light in CaixaShell header | visual inspection |
| MV3 | Brand text "PDV.ART.br" styled (3 spots) | manual | RF04/RN01 | sidebar, admin header, manual intro | ".ART" colored, ".br" base color | visual inspection |
| MV4 | Favicon shown in browser tab | manual | RF06 | load app in browser | tab shows brand icon | visual inspection |
| MV5 | Dark login meets WCAG AA contrast | manual | RNF02 | inputs, placeholders, errors on /login | ratio ≥ 4.5:1 | contrast checker |

### Test File Mapping

| Area | Test File | Test IDs |
|------|-----------|----------|
| asset/repo | tests/0018F-rebrand-assets.test.ts (node env) | T01, T07, T08, T09, T10, T11 |
| backend | app/(app)/caixa/receipt-actions.test.ts (node env, mocked auth/db) | T02, T04 |
| backend (RLS) | db/__tests__/receipt-store-name-rls.test.ts (real DB) | T03 |
| frontend | components/caixa/PaymentDialog.test.ts (jsdom) | T05, T06 |
| manual | this plan (MV table) | MV1–MV5 |

---

## Backend

### Server Actions (modified)
| Action | File | Change | Multi-tenancy |
|--------|------|--------|---------------|
| getSaleReceiptAction | app/(app)/caixa/receipt-actions.ts | Dentro do `withUserRls(ctx.userId, tx)` existente, somar um `select` de `tenants.name` filtrado por `eq(tenants.id, ctx.tenantId)`; incluir o nome no objeto retornado pela tx e mapear para o novo campo `storeName` do `ReceiptDto`. | Read de `tenants` escopado por `ctx.tenantId` (nunca do client) sob `withUserRls` → RLS aplica `app.current_user_id`. Mantém os filtros `tenantId` já presentes em sales/saleItems. |

### DTOs (modified)
| DTO | Added Field | Type | Source | Fallback |
|-----|-------------|------|--------|----------|
| ReceiptDto | storeName | string | tenants.name (notNull) p/ ctx.tenantId | "PDV.ART.br" aplicado na PRESENTATION (client `PaymentDialog`), não no server — RN02 |

### Notes
- Import a adicionar: `tenants` de `@/db/schema` (mesmo barrel de `sales`/`saleItems`).
- `tenants.name` é `text().notNull()` (`db/schema/tenants.ts:13`) — o server retorna `storeName` cru, sem fallback. A queda para "PDV.ART.br" (RN02, nome vazio) é de UI e mora no client.
- Não criar repositório/serviço novo — segue o padrão inline já usado nesta action (KISS/YAGNI). Sem novos endpoints, schemas zod, migrations ou eventos.

---

## Frontend

### Asset Changes
| Current file | New file | Action | Target size |
|---|---|---|---|
| public/logo (1).png (preto, 1.1MB) | public/logo-dark.webp | convert WebP + rename | < 100 KB |
| public/logo (2).png (branco, 1.5MB) | public/logo-light.webp | convert WebP + rename | < 100 KB |
| public/logo (1).png | app/icon.png (256×256 crop) | derive favicon | small |

Converter via `sharp` (já dependência do 0016F): resize ~512w, quality 80. Deletar os 2 PNGs originais.

### Text Replacements (RF01)
| File | Line | From | To |
|---|---|---|---|
| app/layout.tsx | 18 | `SAAS PDV.multi` | `PDV.ART.br` |
| app/(auth)/login/page.tsx | 3 | `Entrar — SAAS PDV.multi` | `Entrar — PDV.ART.br` |
| app/(auth)/signup/page.tsx | 4 | `Criar loja — SAAS PDV.multi` | `Criar loja — PDV.ART.br` |
| app/(app)/auditoria/page.tsx | 6 | `Auditoria — SAAS PDV.multi` | `Auditoria — PDV.ART.br` |
| app/(app)/manual/page.tsx | 5 | `Manual — SAAS PDV.multi` | `Manual — PDV.ART.br` |
| app/(app)/perfil/page.tsx | 6 | `Meu perfil — SAAS PDV.multi` | `Meu perfil — PDV.ART.br` |
| app/(app)/usuarios/page.tsx | 7 | `Usuários — SAAS PDV.multi` | `Usuários — PDV.ART.br` |
| components/manual/manual-data.ts | 29 | `O PDV.multi controla...` | `O PDV.ART.br controla...` |

Aceite: `grep -r "PDV.multi"` retorna 0. (Sidebar :239, admin :57, recibo :78 cobertos em RF04/RF05.)

### Pages / Layouts touched
| Route / File | Component | Change | Purpose |
|---|---|---|---|
| app/(auth)/layout.tsx | AuthLayout | trocar `bg-muted/30` por fundo escuro + classe `dark` no wrapper; logo `<img src="/logo-dark.webp">` acima do card | RF02 |
| app/layout.tsx | RootLayout | metadata title (RF01); favicon herda de app/icon.png | RF01/RF06 |

### Components touched
{"LoginForm":{"location":"components/auth/LoginForm.tsx","change":"logo-dark.webp acima do CardTitle"},"SignupForm":{"location":"components/auth/SignupForm.tsx","change":"mesmo logo acima do header; revisar banner bg-sky-50 no dark"},"CaixaShell":{"location":"components/caixa/CaixaShell.tsx","change":"img logo-light.webp no topo-esquerdo do header"},"AppSidebar":{"location":"components/layout/AppSidebar.tsx:239","change":"texto PDV.ART.br estilizado (RF04)"},"AdminLayout":{"location":"app/(admin)/layout.tsx:57","change":"texto PDV.ART.br estilizado + ' / Admin'"},"PaymentDialog":{"location":"components/caixa/PaymentDialog.tsx:78","change":"h1 = receipt.storeName||'PDV.ART.br'; footer 'via PDV.ART.br'"},"ManualData":{"location":"components/manual/manual-data.ts:29","change":"texto intro PDV.ART.br"}}

### Brand Text Treatment (RF04 / RN01)
Inline nos 3 locais (sem helper): `PDV<span style={{color}}>.ART</span>.br` — `.ART` recebe a cor existente (sidebar #4f46e5, admin #818cf8); `.br` na cor do texto base. Mantém o padrão de sufixo colorido (KISS).

### Favicon (RF06)
Adicionar `app/icon.png` (convenção Next App Router auto-detecta; sem mexer em metadata). Derivar do logo recortado quadrado, ~256px.

### Types (mirror from backend)
{"ReceiptDto":{"addedField":"storeName","type":"string","sourceDTO":"ReceiptDto (Backend) — tenants.name notNull","clientFallback":"'PDV.ART.br' em PaymentDialog (RN02)"}}

### WCAG AA — dark login (RNF02)
Card já usa tokens `bg-card`/`text-foreground` que invertem sob `.dark`. Placeholder ≥ 4.5:1 (evitar `muted-foreground` apagado — usar tom ~`zinc-400`). Erros via toast (sonner) já contrastam. Validar com checador de contraste antes do gate.

Reference: `components/auth/LoginForm.tsx`, `components/products/ProductImageUpload.tsx:135`, `components/ui/card.tsx`, pipeline sharp da 0016F.

---

## Requirements Coverage

| ID | Requirement | Covered? | Area | Tests |
|----|-------------|----------|------|-------|
| RF01 | 12 ocorrências "PDV.multi" → "PDV.ART.br" | YES | Frontend | T01, T10 |
| RF02 | Login/signup tema escuro + logo preto | YES | Frontend | MV1 |
| RF03 | Caixa exibe logo branco no header | YES | Frontend | MV2 |
| RF04 | Sidebar/admin/manual marca em texto | YES | Frontend | MV3 |
| RF05 | Recibo com nome da loja + rodapé | YES | Backend + Frontend | T02, T05, T06 |
| RF06 | Favicon próprio | YES | Frontend | T11, MV4 |
| RNF01 | Logos WebP < 100 KB cada | YES | Asset | T07, T08, T09, T10 |
| RNF02 | Login escuro WCAG AA | YES | Frontend | MV5 |
| RN01 | Sufixo colorido adaptado (.ART) | YES | Frontend | MV3 |
| RN02 | Cabeçalho recibo = nome do tenant, fallback marca | YES | Backend + Frontend | T02, T03, T04, T05 |
