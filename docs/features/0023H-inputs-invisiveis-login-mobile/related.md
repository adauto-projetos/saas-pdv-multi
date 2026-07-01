---
id: 0023H-related
type: hotfix-related
created: 2026-07-01
updated: 2026-07-01
related: [0023H]
---

## TL;DR

Ativos impactados pelo hotfix {{doc:0023H}}: o primitivo `Input` (usado em todo o app), os selects e o EmojiPicker do formulário de produto, e o layout de auth. Docs com info potencialmente defasada: a about do rebrand {{doc:0018F}}.

## Impacted Files

- [components/ui/input.tsx:12](../../../components/ui/input.tsx#L12) — fill do primitivo `Input` alterado (`bg-transparent` → `bg-background`); afeta todos os inputs do app.
- [components/products/ProductForm.tsx:168](../../../components/products/ProductForm.tsx#L168) — `<select>` Categoria: fill `bg-background`.
- [components/products/ProductForm.tsx:210](../../../components/products/ProductForm.tsx#L210) — `<select>` Unidade: fill `bg-background`.
- [app/(auth)/layout.tsx:11](../../../app/(auth)/layout.tsx#L11) — background do login: sólido no mobile, imagem só em `lg+`.
- [components/products/EmojiPicker.tsx](../../../components/products/EmojiPicker.tsx) — lista de emojis ampliada (mercado/bar/lanchonete).

## Impacted Docs

- {{doc:0018F}} — a about do rebrand descreve o fundo do login via `background.webp` em `cover` na tela inteira; agora esse comportamento vale só a partir de `lg`. Info do layout mobile passou a ser responsabilidade deste hotfix.

## Follow-ups

- 0009F (restyle dos forms, ainda em `discovery`): ao ser implementada, alinhar o visual dos inputs a este fill branco para não reintroduzir o problema de contraste.
- Considerar teste/validação visual (ex.: snapshot ou checagem de contraste) para inputs e para o layout de auth em breakpoint mobile, já que nenhum safeguard atual cobre regressão de cor/responsividade.
