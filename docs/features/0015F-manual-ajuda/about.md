---
id: 0015F
type: feature-about
slug: manual-ajuda
status: done
created: 2026-06-27
updated: 2026-06-27
related: [0008F, 0014F]
---

## TL;DR

Manual do app completo e cobrindo todas as áreas, em duas frentes: (1) uma página dedicada `/manual` com guia escrito por seção (busca + índice clicável), e (2) expansão do "Modo Ajuda" (dicas contextuais via `HelpTip`/`InfoButton`) para as áreas que ainda não tinham — contas a pagar/receber, perfil, vendas, auditoria e usuários. O botão da barra lateral foi renomeado de "Manual / Ajuda" para "Modo Ajuda", e um novo item de menu "Manual" leva à página.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Requirements](#requirements)
- [Decisions](#decisions)
- [References](#references)

## Problem

O app já tinha um "Modo Ajuda" (dicas em cima dos elementos), mas a cobertura era parcial: só produtos, caixa, comandas, estoque, financeiro (parte), lucro e configurações tinham dicas. Faltavam várias áreas, e não havia um manual escrito para o dono/operador ler do começo ao fim. O público é iniciante (ver OWNER), então a ajuda precisa explicar o porquê, não só o quê.

## Users

- **Dono da loja** — quer entender todas as áreas e treinar a equipe.
- **Operador** — consulta rápida no dia a dia (o que cada campo/botão faz).

## Scope

**Inclui**
- Página `/manual` (route group `(app)`, `force-dynamic`) com guia por seção: Primeiros passos, Caixa, Comandas, Produtos, Preços/margem, Estoque, Financeiro, Lucro, Vendas, Usuários e permissões, Auditoria, Configurações, Meu perfil, Impressão.
- Busca textual e índice lateral clicável (rola até a seção).
- Conteúdo em arquivo de dados estruturado, separado do renderizador.
- Dicas contextuais (`InfoButton`/`HelpTip`) nas áreas que faltavam.
- Item de menu "Manual" (sempre visível) + rename do toggle para "Modo Ajuda".

**Não inclui**
- Vídeos, tour guiado (onboarding passo a passo interativo), ou busca global.
- Internacionalização (conteúdo só em pt-BR).
- Versionamento/changelog do conteúdo do manual dentro do app.

## Requirements

- RF01 — Página `/manual` acessível pelo menu, visível a qualquer usuário logado (`perm: undefined`).
- RF02 — Manual cobre todas as áreas do app, em linguagem de iniciante (o quê, passo a passo, campos, regras, dicas).
- RF03 — Busca filtra seções por título e conteúdo; índice navega até a seção.
- RF04 — Modo Ajuda passa a ter dicas em: contas a pagar, contas a receber, perfil, vendas, auditoria e usuários.
- RF05 — Distinção clara entre a página "Manual" (guia escrito) e o "Modo Ajuda" (dicas contextuais).
- RNF01 — Conteúdo do manual em dados estruturados (`manual-data.ts`) para edição/expansão fácil, sem mexer no renderizador.
- RNF02 — Sem dependências novas; reusa `PageCard`, `HelpTip`/`InfoButton` e o `HelpProvider` existentes.

## Decisions

- **Página + dicas (as duas)** em vez de só uma — o guia escrito serve para ler/treinar; as dicas servem para consulta no contexto.
- **Conteúdo data-driven** (`manual-data.ts` com blocos `p`/`steps`/`fields`/`tips`/`rules`) — fácil acrescentar seções depois.
- **Rename do toggle para "Modo Ajuda"** — evita confusão com o novo item de menu "Manual".
- **`InfoButton` reaproveitado** — só aparece com o Modo Ajuda ligado; mantém a UI limpa quando desligado.
- **Conteúdo validado contra o código real** — mapeado a partir de `docs/features/` + componentes, para não descrever comportamento inexistente.

## References

- Sistema de ajuda: `lib/help/help-context.tsx`, `components/ui/help-tip.tsx`
- Sidebar/menu: `components/layout/AppSidebar.tsx` (0008F)
- Permissões que afetam visibilidade de áreas: 0014F
