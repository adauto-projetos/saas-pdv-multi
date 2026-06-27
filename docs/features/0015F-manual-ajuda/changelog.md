---
id: CHG0015
type: changelog
date: 2026-06-27
related: [0015F]
---

## TL;DR

Manual do app completo cobrindo todas as áreas, em duas frentes: página dedicada `/manual` (guia escrito com busca + índice clicável) e expansão do Modo Ajuda (dicas contextuais) para as áreas que ainda não tinham. Botão da barra lateral renomeado de "Manual / Ajuda" para "Modo Ajuda" e novo item de menu "Manual".

## Changes

- feat(manual): página `/manual` (`app/(app)/manual/page.tsx`, `force-dynamic`) com guia por seção — Primeiros passos, Caixa, Comandas, Produtos, Preços/margem, Estoque, Financeiro, Lucro, Vendas, Usuários e permissões, Auditoria, Configurações, Meu perfil e Impressão
- feat(manual): conteúdo data-driven em `components/manual/manual-data.ts` (blocos `p`/`steps`/`fields`/`tips`/`rules`) + renderizador `components/manual/ManualContent.tsx` com busca textual e índice lateral clicável
- feat(nav): item de menu "Manual" (sempre visível) em `AppSidebar.tsx`; toggle do Modo Ajuda renomeado de "Manual / Ajuda" para "Modo Ajuda"
- feat(ajuda): `InfoButton`/`HelpTip` em contas a pagar (`NewPayableForm`) — descrição, valor, categoria, vencimento e botão
- feat(ajuda): `InfoButton`/`HelpTip` em contas a receber (`NewReceivableForm`) — cliente, valor, descrição, vencimento e botão
- feat(ajuda): `InfoButton`/`HelpTip` em Meu perfil (`ChangePasswordForm`) — senha atual, nova senha e botão
- feat(ajuda): `InfoButton` em Vendas (`TodaySalesList`) — cabeçalho do histórico (colunas e ticket médio)
- feat(ajuda): `InfoButton` em Auditoria (`AuditoriaClient`) — filtros e leitura da tabela (A/F/C etc.)
- feat(ajuda): `InfoButton` em Usuários (`UsuariosClient`) — criar operador, limite de operadores e presets de permissão
- test: gates verdes — typecheck (0 erros), lint (só 2 warnings pré-existentes em `scripts/full-test.mjs`), 442 testes passando, build com rota `/manual` gerada

## Breaking

- Nenhuma. Mudanças são aditivas (nova página + dicas). O rename do botão é só cosmético (mesma ação de ligar/desligar o Modo Ajuda).

## Migration

- Não requer migração de banco nem de dados. Sem novas dependências.

## Quick Ref

```json
{"id":"0015F","domain":"manual & ajuda contextual","touched":["app/(app)/manual/","components/manual/","components/layout/AppSidebar.tsx","components/financeiro/NewPayableForm.tsx","components/financeiro/NewReceivableForm.tsx","components/profile/ChangePasswordForm.tsx","components/caixa/TodaySalesList.tsx","app/(app)/auditoria/AuditoriaClient.tsx","app/(app)/usuarios/UsuariosClient.tsx"],"patterns":["data-driven content (manual-data.ts)","contextual help via HelpTip/InfoButton gated by HelpProvider","client-side search + anchor TOC"],"keywords":["manual","ajuda","help","modo ajuda","InfoButton","HelpTip","onboarding"]}
```
