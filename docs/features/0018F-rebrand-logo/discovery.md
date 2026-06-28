---
id: 0018F
type: feature-discovery
created: 2026-06-27
updated: 2026-06-27
related: [0018F]
---

## TL;DR

Mapeamento read-only das superfícies tocadas pelo rebrand 0018F: 12 ocorrências textuais de "PDV.multi", estrutura das telas de login/signup (layout compartilhado, fundo claro hoje), header do caixa, ausência de favicon e padrão de imagem do projeto (`<img>` puro). Nenhum arquivo foi modificado.

## Brand Occurrences ("PDV.multi")

| Arquivo | Linha | Contexto | Tipo |
|---|---|---|---|
| `app/layout.tsx` | 18 | `title: "SAAS PDV.multi"` | metadata raiz |
| `app/(auth)/login/page.tsx` | 3 | `title: "Entrar — SAAS PDV.multi"` | metadata |
| `app/(auth)/signup/page.tsx` | 4 | `title: "Criar loja — SAAS PDV.multi"` | metadata |
| `app/(app)/auditoria/page.tsx` | 6 | `title: "Auditoria — SAAS PDV.multi"` | metadata |
| `app/(app)/manual/page.tsx` | 5 | `title: "Manual — SAAS PDV.multi"` | metadata |
| `app/(app)/perfil/page.tsx` | 6 | `title: "Meu perfil — SAAS PDV.multi"` | metadata |
| `app/(app)/usuarios/page.tsx` | 7 | `title: "Usuários — SAAS PDV.multi"` | metadata |
| `components/layout/AppSidebar.tsx` | 239 | `PDV<span style={{color:"#4f46e5"}}>.multi</span>` | logo texto sidebar |
| `app/(admin)/layout.tsx` | 57 | `PDV<span style={{color:"#818cf8"}}>.multi</span> / Admin` | header admin |
| `components/caixa/PaymentDialog.tsx` | 78 | `<h1>PDV.multi</h1>` | recibo impresso |
| `components/manual/manual-data.ts` | 29 | `"O PDV.multi controla a sua loja..."` | texto do manual |

Padrão atual: `PDV` + sufixo `.multi` colorido (indigo #4f46e5 sidebar, #818cf8 admin). Alvo: `PDV` + `.ART` + `.br` com tratamento de cor equivalente.

## Auth Screens (login + signup)

- `app/(auth)/layout.tsx` — layout compartilhado, fundo `bg-muted/30` (claro), card centralizado.
- Card via `components/ui/card.tsx`: `bg-card`, `rounded-xl`, `ring-1 ring-foreground/10`.
- `components/auth/LoginForm.tsx` — Card → CardHeader (título "Entrar") → form → CardFooter. Logo entra acima do `CardTitle`.
- `components/auth/SignupForm.tsx` — mesma estrutura + banner de preço `bg-sky-50` no header; inputs tenantName/email/password.
- Mudança: layout/forms passam a tema escuro; logo de fundo preto encaixa sem moldura.

## PDV / Caixa

- `components/caixa/CaixaShell.tsx` — header é tab bar (`background:#fff`, `borderBottom:1px solid #edf0f4`, tabs "Caixa"/"Notas a Receber"). Logo branco entra no topo-esquerdo do header.
- `components/caixa/CashierScreen.tsx` — fundo branco, chips de categoria; sem header dedicado próprio.

## Receipt (recibo impresso)

- `components/caixa/PaymentDialog.tsx:64-88` — template HTML de impressão (monospace, 280px). `<h1>` na linha 78 = cabeçalho. Mudança: trocar pelo nome da loja (tenant) + rodapé "via PDV.ART.br". Requer o nome do tenant disponível no componente.

## Favicon & Metadata

- `app/layout.tsx` — `title`/`description` raiz; **sem** `icon`/`apple-icon`/`manifest`. Nenhum `favicon.ico` em `app/` ou `public/`. Next serve ícone padrão.
- Adicionar favicon: convenção Next App Router via `app/icon.png` (ou `favicon.ico`).

## Image Handling Pattern

- Projeto usa `<img>` puro com `loading="lazy"` — **não** usa `next/image` (ver `components/products/ProductImageUpload.tsx:135`, `components/products/ProductsTable.tsx:36`).
- Fotos de produto vão pro R2 (CDN externo); `public/` só tem SVGs + os 2 logos PNG.
- Assets de logo em `public/`: `logo (1).png` (1254×1254, fundo preto, 1,1 MB) e `logo (2).png` (1024×1024 RGBA, fundo branco, 1,5 MB). Nomes com espaço/parênteses inválidos para URL — renomear + converter WebP na implementação.

## Prerequisites

- Nome do tenant acessível no fluxo de impressão do recibo (`PaymentDialog`) — confirmar de onde vem (sessão/props).
- Decidir nomes finais dos assets (ex.: `logo.png`/`logo-dark.png` ou variantes WebP).
