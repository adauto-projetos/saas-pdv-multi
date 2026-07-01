---
id: CHG0024
type: changelog
date: 2026-07-01
related: [0023H]
---

# CHG0024 — Hotfix 0023H: Inputs invisíveis & login mobile

## TL;DR

Corrige dois bugs visuais reportados pelo owner ({{doc:0023H}}): campos de digitação invisíveis em todos os formulários do app e a foto do login recortada no mobile. Inclui, a pedido, a ampliação da lista de emojis do produto. Sem breaking changes.

## Changes

- fix(ui): inputs com preenchimento branco (`bg-background`) — campos visíveis sobre o fundo cinza do app, antes imperceptíveis com `bg-transparent` — {{doc:0023H}}
- fix(products): selects Categoria/Unidade do form de produto com o mesmo fill branco — {{doc:0023H}}
- fix(auth): login mobile com fundo claro + `logo-full.webp` acima do card escuro; banner de desktop restrito a `lg+`, evitando o recorte da imagem larga em telas estreitas — {{doc:0023H}}
- feat(products): +19 emojis de mercado/bar/lanchonete na lista curada do EmojiPicker (bebidas, lanches, doces, frutas, verduras, mercearia), sem duplicatas — {{doc:0023H}}

## Breaking

none

## Migration

none

## Quick Ref

```json
{"id":"0023H","domain":"UI / auth / produtos","touched":["components/ui/","components/products/","app/(auth)/"],"patterns":["shadcn-base-ui","tailwind-v4-tokens","responsive-breakpoints"],"keywords":["input","contraste","bg-background","login","mobile","responsivo","emoji","produto"]}
```
