---
id: 0001F
type: feature-discovery
slug: product-markup-pricing
created: 2026-06-08
updated: 2026-06-08
related: [0001F]
---

## TL;DR

Análise de codebase para {{doc:0001F}}. Resultado: **projeto greenfield** — não há código, stack ou padrões. Esta feature estabelece a entidade Produto e o padrão de multi-tenancy. Bloqueio para planejamento: a stack (backend/frontend/banco) ainda não foi escolhida.

## Estado do Codebase

- Nenhum código de aplicação (`src/`, `apps/`, `libs/` inexistentes).
- Só documentação ADD (`docs/product/`, `docs/features/`) e config do framework.
- Sem `CLAUDE.md` (Technical Spec não gerado) — stack indefinida.

## Reaproveitamento

- Nada a reaproveitar. Primeira feature do projeto.
- Esta feature cria os padrões-base que as próximas seguirão: entidade Produto, isolamento por tenant, validação de formulário.

## Pré-requisitos (bloqueiam /add.plan)

| Pré-requisito | Por quê |
|---|---|
| Decidir a stack (backend, frontend, banco) | Sem ela não há onde criar entidade, rota ou tela; multi-tenancy depende do banco escolhido |
| Definir estratégia de multi-tenancy | RN05 exige isolamento por tenant; modelo (schema por tenant, coluna tenant_id, banco por tenant) afeta toda a modelagem |
| Gerar `CLAUDE.md` (Technical Spec) | Padrões de arquitetura que o /add.plan e os agentes vão seguir |

## Padrões a Estabelecer

- Entidade `Produto`: campos nome, código de barras, unidade (`un`|`kg`), custo, margem %, preço de venda, estoque inicial, tenant.
- Cálculo de markup (custo + custo×%) — decidir camada (domínio/serviço) no /add.plan.
- Unicidade de código de barras por tenant (RN01) — índice composto.

## Related Features

| Feature | Relação | Nota |
|---|---|---|
| Estoque (Fase 2) | Consome | Usa estoque inicial e produto criados aqui |
| Lucro/fechamento (Fase 2) | Consome | Usa custo + margem para lucro real |

Refs: {{doc:0001F}}, {{doc:PRODUCT}}.
