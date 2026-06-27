---
id: 0014F
type: feature-about
slug: sf04-auditoria-autoria
status: draft
created: 2026-06-26
updated: 2026-06-26
related: [0002F, 0005F, 0006F]
---

## TL;DR

Tela de auditoria que mostra "quem fez o quê" por operador e por turno, usando as colunas de autoria que já existem no banco (`sales.userId`, `cash_sessions.openedBy/closedBy`, `comandas.openedBy/closedBy`, `stock_movements.userId`, `cash_movements.userId`). É o motivo real de ter operadores: prestar contas por pessoa. Depende de SF01 (operadores nomeados); consome também o `override_log` de SF02 se presente.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Requirements](#requirements)
- [Decisions](#decisions)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

As colunas de autoria já existem em todas as tabelas, mas nada na interface mostra essa informação. Depois de ter operadores (SF01), o dono ainda não consegue ver quanto cada um vendeu, quais caixas fechou ou o que cancelou — o dado existe e fica invisível.

- `sales.userId`, `cash_sessions.openedBy/closedBy`, `comandas.openedBy/closedBy`, `stock_movements.userId`, `cash_movements.userId` já gravam o autor, mas não há tela que leia.
- Sem visão por operador, "prestar contas por turno e por pessoa" — a justificativa de ter operadores — não se concretiza.
- Operadores desativados (SF01) continuam referenciados no histórico; o nome precisa aparecer mesmo após a desativação.
- **Sinal observável:** as colunas existem (confirmado em discovery), mas nenhuma página as exibe.
- **Workaround atual:** consultar o banco direto (psql) para saber quem fez o quê — inviável para o dono.

## Users

| Role | Objetivo com esta feature | Dor atual |
|---|---|---|
| Administrador (dono) | Ver por operador/turno o que cada funcionário fez (vendas, caixas, cancelamentos) | Dado existe no banco mas é invisível |
| Gerente de turno (operador com "Gerenciar usuários") | Conferir a atividade da equipe da loja | Não há relatório |

> "Gerente de turno" é um Operador com a permissão `gerenciar_usuarios` (não é papel no banco). No MVP, quem tem acesso à auditoria vê todos os operadores da loja — não há recorte por turno/equipe (ver Does NOT Include).

## Scope

### Includes

- Tela de auditoria (acesso por `owner` ou `gerenciar_usuarios`): atividade por operador num período/turno.
- Por operador: total de vendas (qtd e valor), caixas abertos/fechados, comandas abertas/fechadas/canceladas, movimentações de estoque e de caixa.
- Filtros: por operador e por período (dia/turno/intervalo).
- Exibição do nome do operador mesmo quando desativado (LEFT JOIN/snapshot — o registro de `tenant_members` é preservado em SF01).
- Inclusão dos overrides do `override_log` (SF02): quem autorizou qual exceção. Degradação graciosa = se a tabela `override_log` não existir (SF02 não entregue), a seção de overrides é omitida sem erro; se existir mas sem linhas no período, a seção aparece vazia.

### Does NOT Include

- Exportação CSV/PDF — operação não justificada com poucas lojas.
- Métricas em tempo real (WebSocket/polling) — dados carregados no request, atualização por refresh.
- Alertas/notificações automáticas (ex.: avisar quando um caixa fecha com diferença) — a tela é consultiva no MVP; não dispara aviso.
- Drill-down para a transação individual a partir do agregado — o MVP mostra totais por operador; abrir cada venda/caixa fica fora do escopo.
- Recorte de visibilidade por equipe/turno (gerente vê só a própria equipe) — no MVP, quem acessa vê todos os operadores da loja.
- Trilha de auditoria de edições campo a campo (quem mudou qual preço) — só ações já com autoria gravada; auditoria fina de mudanças é outro escopo.
- Comissão/cálculo financeiro por operador — só contagem/atribuição, sem regra de comissionamento.

## Requirements

### Consulta e exibição

- **RF01:** Tela lista atividade agregada por operador no período selecionado: vendas (qtd, soma `total_cents`), caixas abertos/fechados, comandas abertas/fechadas/canceladas, movimentações de estoque e de caixa.
- **RF02:** Filtro por operador e por período (data início/fim; atalho "hoje"/"turno atual").
- **RF03:** Acesso restrito a `owner` ou `gerenciar_usuarios` (via `requirePermission`).
- **RF04:** Nome do operador exibido mesmo se `is_active=false` (registro preservado).
- **RF05:** Se `override_log` (SF02) existir, a tela mostra os overrides do período (operador, autorizador, ação, alvo); se não existir, a seção é omitida sem erro.
- **RNF01:** Consultas filtram por tenant (RLS) e usam os índices de `tenant_id`/`created_at`; carregam em até 2s para o volume de um período típico.

### Atribuição

- **RN01:** A atribuição usa exclusivamente as colunas de autoria existentes; esta SF não adiciona colunas de autor (já presentes).
- **RN02:** Vendas/ações feitas pelo `owner` aparecem atribuídas ao owner, distintas dos operadores.

## Decisions

| Decisão | Rationale | Alternativa rejeitada |
|---|---|---|
| Reusar colunas de autoria existentes | Já gravadas em todas as tabelas (confirmado em discovery); zero retrofit | Criar tabela de eventos de auditoria — duplicação do que já existe |
| LEFT JOIN para nome de operador desativado | Histórico não pode ficar órfão; SF01 preserva o registro | Hard-delete do operador — quebraria o relatório |
| Consumo opcional do `override_log` (SF02) | SF04 é independente; degrada graciosamente se SF02 não entregou | Acoplar SF04 a SF02 — quebraria a independência das subfeatures |
| Sem export no MVP | Poucas lojas; tela basta | Export CSV/PDF — esforço sem demanda |

## Success Metrics

| Métrica | Target | Fonte |
|---|---|---|
| Donos com ≥1 operador que abrem a auditoria ao menos 1x/semana | ≥ 50% | Eventos de acesso à rota de auditoria |
| Divergência de fechamento de caixa (sobra/falta registrada no fechamento, {{doc:0005F}}) atribuível ao operador que fechou | 100% | `cash_sessions.closedBy` + campo de divergência do fechamento |
| Tempo de carga da tela no período típico | < 2s (P95) | Logs de request Next.js |

## References

- {{doc:0002F}} — `sales.userId` (autoria de venda)
- {{doc:0005F}} — `cash_sessions.openedBy/closedBy` (autoria de caixa)
- {{doc:0006F}} — `comandas.openedBy/closedBy` (autoria de comanda)
- [SF01 about.md](../SF01-nucleo-usuarios-permissoes/about.md) — operadores nomeados + `is_active` (prerequisite)
- [SF02 about.md](../SF02-override-acao-sensivel/about.md) — `override_log` (consumo opcional)
- db/schema/stock-movements.ts, db/schema/cash-movements.ts — `userId` (autoria)
- [discovery.md](../../discovery.md) — confirmação de que todas as colunas de autoria já existem
