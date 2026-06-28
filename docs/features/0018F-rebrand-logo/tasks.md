---
id: 0018F
type: feature-tasks
slug: rebrand-logo
created: 2026-06-27
updated: 2026-06-27
related: [0018F]
---

# Tasks: 0018F — rebrand-logo (PDV.multi → PDV.ART.br)

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 10 |
| Services | asset, backend, frontend, test |

## Requirements Coverage

- [x] RF01 — 12 ocorrências "PDV.multi" → "PDV.ART.br"
- [x] RF02 — Login/signup tema escuro + logo preto
- [x] RF03 — Caixa exibe logo branco no header
- [x] RF04 — Sidebar/admin/manual marca em texto estilizado
- [x] RF05 — Recibo com nome da loja + rodapé "via PDV.ART.br"
- [x] RF06 — Favicon próprio na aba do navegador
- [x] RNF01 — Logos WebP < 100 KB cada
- [x] RNF02 — Login escuro atende WCAG AA
- [x] RN01 — Sufixo colorido adaptado (.ART)
- [x] RN02 — Cabeçalho recibo = nome do tenant, fallback marca

## TDD

Escrever PRIMEIRO (red), antes da implementação. Ordem de serviço: test → backend → frontend.

- [x] T-TEST-01 (T01) Nenhum "PDV.multi" no repo — `tests/0018F-rebrand-assets.test.ts`
- [x] T-TEST-02 (T02) ReceiptDto expõe storeName — `app/(app)/caixa/receipt-actions.test.ts`
- [x] T-TEST-03 (T03) storeName escopado ao tenant da sessão (RLS) — `db/__tests__/receipt-store-name-rls.test.ts`
- [x] T-TEST-04 (T04) Recibo de venda de outro tenant rejeitado — `app/(app)/caixa/receipt-actions.test.ts`
- [x] T-TEST-05 (T05) storeName vazio cai para a marca — `components/caixa/PaymentDialog.test.ts`
- [x] T-TEST-06 (T06) Rodapé do recibo mostra "via PDV.ART.br" — `components/caixa/PaymentDialog.test.ts`
- [x] T-TEST-07 (T07) Logo dark < 100 KB — `tests/0018F-rebrand-assets.test.ts`
- [x] T-TEST-08 (T08) Logo light < 100 KB — `tests/0018F-rebrand-assets.test.ts`
- [x] T-TEST-09 (T09) Ambos os logos são WebP (RIFF/WEBP) — `tests/0018F-rebrand-assets.test.ts`
- [x] T-TEST-10 (T10) PNGs antigos removidos — `tests/0018F-rebrand-assets.test.ts`
- [x] T-TEST-11 (T11) Favicon `app/icon.png` presente — `tests/0018F-rebrand-assets.test.ts`

## Execution

- [x] T01 Converter logos para WebP e renomear
  - Service: asset
  - Files: `public/logo-dark.webp`, `public/logo-light.webp`
  - Deps: -
  - Verify: `node -e "const s=require('fs').statSync('public/logo-dark.webp').size; if(s>=102400)process.exit(1)"`
- [x] T02 Criar favicon e deletar PNGs originais
  - Service: asset
  - Files: `app/icon.png`
  - Deps: T01
  - Verify: `ls "public/logo (1).png" "public/logo (2).png" 2>/dev/null; test $? -ne 0`
- [x] T03 Adicionar storeName ao ReceiptDto na action
  - Service: backend
  - Files: `app/(app)/caixa/receipt-actions.ts`
  - Deps: -
  - Verify: `npm test -- receipt-actions.test.ts`
- [x] T04 Trocar texto "PDV.multi" → "PDV.ART.br" (8 arquivos de metadata/manual)
  - Service: frontend
  - Files: `app/layout.tsx`, `components/manual/manual-data.ts`
  - Deps: -
  - Verify: `grep -r "PDV.multi" app components --include=*.ts --include=*.tsx | grep -v node_modules; test $? -ne 0`
- [x] T05 Auth tema escuro + logo-dark acima do card
  - Service: frontend
  - Files: `app/(auth)/layout.tsx`, `components/auth/LoginForm.tsx`, `components/auth/SignupForm.tsx`
  - Deps: T01
  - Verify: browser — abrir `/login` e `/signup`, fundo escuro com logo acima do card
- [x] T06 Logo-light no header da CaixaShell
  - Service: frontend
  - Files: `components/caixa/CaixaShell.tsx`
  - Deps: T01
  - Verify: browser — abrir `/caixa`, logo branco no topo do header
- [x] T07 Marca em texto estilizado (sidebar, admin)
  - Service: frontend
  - Files: `components/layout/AppSidebar.tsx`, `app/(admin)/layout.tsx`
  - Deps: -
  - Verify: browser — sidebar e header admin mostram "PDV.ART.br" com ".ART" colorido
- [x] T08 Recibo: cabeçalho storeName||marca + rodapé via-brand
  - Service: frontend
  - Files: `components/caixa/PaymentDialog.tsx`
  - Deps: T03
  - Verify: `npm test -- PaymentDialog.test.ts`
- [x] T09 Metadata title root usa favicon herdado de app/icon.png
  - Service: frontend
  - Files: `app/layout.tsx`
  - Deps: T02
  - Verify: browser — aba do navegador exibe o ícone da marca
- [x] T10 Garantir contraste WCAG AA no login escuro
  - Service: frontend
  - Files: `app/(auth)/layout.tsx`, `components/auth/LoginForm.tsx`
  - Deps: T05
  - Verify: contrast checker — inputs/placeholders/erros em `/login` ≥ 4.5:1

## Acceptance Checklist

- [x] `grep -r "PDV.multi"` em app/components retorna 0 ocorrências (RF01)
- [x] Metadata title root e das 6 páginas exibe "PDV.ART.br" (RF01)
- [x] Texto intro do manual diz "PDV.ART.br" (RF01)
- [x] `app/(auth)/layout.tsx` aplica fundo escuro/classe `dark` no wrapper (RF02)
- [x] LoginForm e SignupForm renderizam `<img src="/logo-dark.webp">` acima do CardTitle (RF02)
- [x] CaixaShell header renderiza `<img src="/logo-light.webp">` (RF03)
- [x] AppSidebar exibe "PDV.ART.br" estilizado (RF04, RN01)
- [x] Header admin (`app/(admin)/layout.tsx`) exibe "PDV.ART.br / Admin" estilizado (RF04, RN01)
- [x] Intro do manual (`manual-data.ts`) exibe marca em texto "PDV.ART.br" (RF04, RN01)
- [x] Action `getSaleReceiptAction` retorna `ReceiptDto.storeName` = `tenants.name` do tenant da sessão (RF05, RN02)
- [x] PaymentDialog cabeçalho do recibo = `receipt.storeName || "PDV.ART.br"` (RF05, RN02)
- [x] PaymentDialog rodapé do recibo contém "via PDV.ART.br" (RF05)
- [x] `app/icon.png` presente; aba do navegador exibe favicon próprio (RF06)
- [x] `public/logo-dark.webp` e `public/logo-light.webp` são WebP, cada < 100 KB (RNF01)
- [x] PNGs originais `logo (1).png` / `logo (2).png` removidos (RNF01)
- [x] `getSaleReceiptAction` rejeita venda de outro tenant sem vazar storeName (RN02)
- [x] Manual MV1 — login/signup tema escuro + logo-dark acima do card (RF02)
- [x] Manual MV2 — header do caixa mostra logo-light (RF03)
- [x] Manual MV3 — marca em texto estilizado nos 3 locais, ".ART" colorido (RF04, RN01)
- [x] Manual MV4 — favicon visível na aba do navegador (RF06)
- [x] Manual MV5 — login escuro atende WCAG AA (≥ 4.5:1) em inputs/placeholders/erros (RNF02)

## Quality Gates

- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures

### Notes

- T03 (RLS, `db/__tests__/receipt-store-name-rls.test.ts`) toca o banco: subir Postgres via `docker compose up -d` e ter `DATABASE_URL` no `.env.local`; sem isso o teste é pulado.
- Esta feature NÃO adiciona schema (sem `db:push`), portanto NÃO é necessário rerodar `npm run db:rls`. Caso algum `db:push` avulso ocorra no ambiente, rode `npm run db:rls` em seguida (RLS policies são derrubadas pelo push).
