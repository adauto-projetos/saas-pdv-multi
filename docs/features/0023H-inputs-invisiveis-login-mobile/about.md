---
id: 0023H
type: hotfix-about
severity: high
created: 2026-07-01
updated: 2026-07-01
related: [0018F, 0001F]
---

## TL;DR

Dois bugs visuais independentes: (1) os campos de digitação do formulário "Novo produto" (e demais formulários do app) ficavam invisíveis — sem preenchimento, com borda quase da cor do fundo cinza da página; (2) no login mobile, o banner largo de desktop era recortado pelo `background-size: cover` numa tela estreita. Correção: inputs passam a ter preenchimento branco (`bg-background`) e o banner do login some no mobile, dando lugar a um fundo sólido escuro (imagem só em `lg+`).

## Symptom

- **when** — sempre que um formulário do app é renderizado (bug 1) e sempre que a tela de login é aberta em viewport estreito/mobile (bug 2).
- **where** — bug 1: [components/ui/input.tsx](../../../components/ui/input.tsx) (primitivo usado em todo o app) e os dois `<select>` de [components/products/ProductForm.tsx](../../../components/products/ProductForm.tsx); bug 2: [app/(auth)/layout.tsx](../../../app/(auth)/layout.tsx).
- **impact** — bug 1: campos praticamente imperceptíveis sobre o fundo cinza `--pdv-bg` (#e9edf2); o usuário não distingue onde digitar. Bug 2: a marca "PDV ART" aparece cortada e sobra uma faixa branca no login mobile.
- **detection** — reporte visual do owner com screenshots (form "Novo produto" e login mobile).

## Root Cause

Dois mecanismos distintos, ambos de estilo, sem relação de dependência entre si.

- **Bug 1 — inputs invisíveis.** Trigger: renderizar qualquer input na área do app. Caminho faltoso: o primitivo `Input` usava `bg-transparent` + `border border-input`, e o token `--input` é `oklch(0.922 0 0)` (≈#e5e5e5), quase igual ao fundo cinza da página (`--pdv-bg` #e9edf2). Sem preenchimento e com borda da cor do fundo, o campo desaparece. Os dois `<select>` do form repetiam o mesmo `bg-transparent`. Por que os safeguards não pegaram: é regressão puramente visual (contraste), fora do alcance de typecheck/testes unitários (nenhum teste valida contraste de cor); a feature de restyle 0009F, que deveria endereçar o visual dos forms, ficou em `discovery` e nunca foi implementada.
- **Bug 2 — banner cortado no mobile.** Trigger: abrir `/login` em viewport estreito. Caminho faltoso: o layout de auth ({{doc:0018F}}) aplicava `background.webp` (imagem larga de desktop, 1717×916) com `background-size: cover` na tela inteira; num viewport alto e estreito o `cover` recorta a imagem na horizontal. Por que os safeguards não pegaram: os testes manuais do rebrand (0018F) focaram aceitação visual em desktop; não havia validação de layout responsivo mobile para as rotas de auth (0010F, a feature mobile, exclui explicitamente `/login` e `/signup` do escopo).

## Fix

- [components/ui/input.tsx:12](../../../components/ui/input.tsx#L12) — `bg-transparent` → `bg-background` — dá preenchimento branco aos inputs em modo claro, tornando-os visíveis sobre o fundo cinza. `dark:bg-input/30` continua sobrescrevendo no card escuro do login.
- [components/products/ProductForm.tsx:168](../../../components/products/ProductForm.tsx#L168) e [:210](../../../components/products/ProductForm.tsx#L210) — `<select>` Categoria/Unidade: `bg-transparent` → `bg-background` — mesma correção de contraste para os selects nativos.
- [app/(auth)/layout.tsx:14](../../../app/(auth)/layout.tsx#L14) — remove o `style` inline com a imagem de fundo; no mobile usa fundo CLARO (`from-[#eef3f9] to-[#dbe4f0]`) + `logo-full.webp` acima do card escuro (mesma composição da metade branca do desktop, com o texto escuro do logo legível), e `lg:bg-[url('/background.webp')]` restaura o banner só em telas largas. Evita o recorte do banner e o "retângulo azul liso" no mobile.
- [components/products/EmojiPicker.tsx](../../../components/products/EmojiPicker.tsx) — pedido paralelo do owner: ampliada a lista curada de emojis de mercado/bar/lanchonete (bebidas, lanches, doces, frutas, verduras, mercearia). Sem duplicatas.

## Verification

- [x] `npm run typecheck` — exit 0
- [x] `npm test` — 525 testes passam (90 arquivos)
- [x] `npm run build` — build de produção OK (`/products/new`, `/login`, `/signup` compilam)
- [x] `npm run lint` — 0 erros (só warnings pré-existentes de `<img>`)
- [ ] Verificação visual do owner: inputs do "Novo produto" visíveis (iguais aos de "Nova movimentação") e login mobile sem recorte da foto.
