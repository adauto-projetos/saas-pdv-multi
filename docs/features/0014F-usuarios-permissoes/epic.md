---
id: 0014F
type: feature-about
slug: usuarios-permissoes-epic
status: draft
created: 2026-06-26
updated: 2026-06-26
related: [0011F, 0002F, 0005F, 0006F]
---

## TL;DR

Epic de operadores com permissões granulares. Decomposta em 4 subfeatures independentes e testáveis: núcleo (cadastro + permissões + login), override de ação sensível, limite por plano e auditoria de autoria. Spec de alto nível em [about.md](about.md).

## TOC

- [Subfeatures](#subfeatures)
- [Ordem de entrega](#ordem-de-entrega)
- [Decisões de escopo do epic](#decisões-de-escopo-do-epic)
- [References](#references)

## Subfeatures

| # | Slug | Objetivo | Depende de | Status |
|---|---|---|---|---|
| SF01 | [nucleo-usuarios-permissoes](subfeatures/SF01-nucleo-usuarios-permissoes/about.md) | Schema (`user_permissions`, `is_active`), CRUD de operadores, login, 8 permissões + presets, anti-escalonamento, invalidar sessão, gates nas actions + menu filtrado | — | done (0014F-SF01-done) |
| SF02 | [override-acao-sensivel](subfeatures/SF02-override-acao-sensivel/about.md) | Diálogo pede senha de Administrador → executa na hora + log de uso; ligado a cancelar comanda/item e fechar caixa | SF01 | done (0014F-SF02-done) |
| SF03 | [limite-operadores](subfeatures/SF03-limite-operadores/about.md) | Campo `max_operators` em `platform_settings` + campo no painel super admin + bloqueio no cadastro | SF01 | done (0014F-SF03-done) |
| SF04 | [auditoria-autoria](subfeatures/SF04-auditoria-autoria/about.md) | Tela por operador/turno usando as colunas de autoria que já existem (`sales.userId`, `cash_sessions`, etc.) | SF01 | done (0014F-SF04-done) |

## Ordem de entrega

1. **SF01** — base; cria a tabela de permissões, o papel `operator` e os gates. Destrava todo o resto.
2. **SF03** — pequeno e gancho de receita; só precisa do fluxo de cadastro de SF01.
3. **SF02** — override + log; precisa das permissões de SF01 para saber quando disparar.
4. **SF04** — relatório de auditoria; precisa dos operadores nomeados de SF01.

## Decisões de escopo do epic

| Decisão | Rationale | Alternativa rejeitada |
|---|---|---|
| Override só nas ações que já existem (cancelar comanda/item, fechar caixa) | Desconto e estorno não existem no código hoje; ligar no que existe entrega controle real sem inflar escopo | Construir desconto+estorno agora — vira 2-3 features em uma |
| Permissão por módulo, não por registro | Combina com balcão compartilhado (qualquer um fecha a comanda da mesa); muito mais simples | Por registro (só o que o operador abriu) — complexidade sem pedido |
| Papel `operator` em `tenant_members.role` | Reusa a coluna que já distingue `owner`; isolamento por tenant já garantido por RLS | Tabela `operators` separada — duplica vínculo usuário↔loja |
| Permissões em tabela `user_permissions` (1 linha por permissão concedida) | Granular, RLS por tenant, dono lê/escreve só da própria loja | Coluna JSON em `tenant_members` — sem RLS fina nem constraint de unicidade |
| Senha provisória definida pelo dono (sem email) | Não há serviço de email no projeto; resolve o MVP | Convite por email com auto-cadastro — exige infra inexistente |
| Limite global hoje, "por plano" depois | Existe um único plano; o campo em `platform_settings` já vira gancho sem mexer no código quando surgirem tiers | Número fixo em código — dívida técnica para amarrar no billing depois |

## References

- {{doc:0011F}} — `platform_settings` + painel super admin (base de SF03)
- {{doc:0002F}}, {{doc:0005F}}, {{doc:0006F}} — colunas de autoria reusadas em SF04 e alvos do override em SF02
- docs/brainstorm/2026-06-26-usuarios-operador-permissoes.md — brainstorm de origem
- [discovery.md](discovery.md) — confirmação em código das premissas
