---
id: 0018F-related
type: hotfix-related
created: 2026-07-01
updated: 2026-07-01
related: [0018F, 0023H]
---

## TL;DR

Referências cruzadas do rebrand {{doc:0018F}}. O hotfix {{doc:0023H}} ajustou o comportamento mobile do fundo do login introduzido aqui.

## Impacted Files

- [app/(auth)/layout.tsx](../../../app/(auth)/layout.tsx) — o fundo `background.webp` em `cover` na tela inteira, introduzido no rebrand, foi restringido a `lg+` por {{doc:0023H}} (recorte no mobile).

## Impacted Docs

- {{doc:0023H}} — hotfix que corrige o recorte do banner no login mobile.

## Follow-ups

- Nenhum pendente.
