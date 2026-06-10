---
id: 0003F
type: feature-about
slug: estoque
status: specified
created: 2026-06-10
updated: 2026-06-10
related: [0001F, 0002F, PRODUCT, OWNER]
---

## TL;DR

Controle de **estoque** do SAAS PDV.multi: registrar **entradas** (compra/reposição), corrigir por **ajuste de inventário** (contagem), e ter **histórico** de todas as movimentações por produto. A venda (feature 0002F) já baixa o estoque — agora cada baixa também vira um registro de movimentação (`saída`), fechando a auditoria. Cada produto pode ter um **nível mínimo**; produtos no/abaixo do mínimo aparecem numa tela de **estoque baixo**. `products.stock_quantity` continua a fonte da verdade; cada movimentação ajusta o campo e grava o log na mesma transação isolada por loja (RLS). Recurso #4 do roadmap (Fase 2 — Controlar).

## TOC

- [Problem](#problem)
- [Users](#users)
- [Requirements](#requirements)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

A venda (via {{doc:0002F}}) baixa o estoque, mas não há como dar **entrada**, **corrigir** ou **auditar** — o número fica cego.

- Quem é afetado: dono (repõe e confere o estoque) e operador (precisa saber o que tem).
- O que falta/quebra: sem entrada, o estoque só cai e fica negativo; sem histórico, não dá pra saber por que o número está errado; sem alerta, o produto acaba sem aviso.
- Sinal observável: hipótese — sem telemetria (greenfield); validar com os primeiros tenants.
- Workaround atual: contagem manual/caderno; "achismo" de reposição.

## Users

| role | goal | pain |
|---|---|---|
| Dono do estabelecimento | Repor, corrigir e enxergar o estoque; ser avisado quando acaba | Estoque só cai (venda), sem entrada nem histórico; descobre que acabou na hora da venda |
| Operador/caixa | Conferir o estoque e registrar entrada/ajuste quando necessário | Número do estoque não é confiável (sem ajuste nem auditoria) |

## Requirements

Notação `RF` (funcional), `RN` (regra de negócio).

- **RF01:** Usuário registra **entrada** de estoque de um produto (quantidade + motivo); o `stock_quantity` sobe.
- **RF02:** Usuário faz **ajuste de inventário** informando a **contagem real**; o sistema calcula a diferença, registra um `ajuste` e acerta o `stock_quantity`.
- **RF03:** Toda venda finalizada (via {{doc:0002F}}) registra automaticamente uma movimentação de **`saída`** (retrofit da baixa existente).
- **RF04:** Cada movimentação grava: tipo (`entrada`|`saida`|`ajuste`), quantidade, motivo, data/hora e o usuário que a fez.
- **RF05:** Usuário visualiza o **histórico** de movimentações de um produto (tipo, quantidade, motivo, data, quem fez), com filtro por tipo e período.
- **RF06:** Usuário define um **nível mínimo** de estoque por produto (opcional).
- **RF07:** Sistema lista os produtos com **estoque baixo** (`stock_quantity` ≤ `min_stock`) numa **tela dedicada** ("Estoque baixo").
- **RF08:** A **lista de produtos existente** (`/products`, de {{doc:0001F}}) **destaca** os itens com estoque negativo (não é uma tela nova — é um realce na listagem que já existe).
- **RN01:** Movimentações são isoladas por tenant (multi-tenancy / RLS), como em {{doc:0001F}}.
- **RN02:** `products.stock_quantity` é a fonte do estoque; cada movimentação **ajusta o campo e grava o log na MESMA transação** (consistência).
- **RN03:** Quantidade de `entrada`/`saida` deve ser maior que zero; a contagem do `ajuste` deve ser ≥ 0 (a diferença resultante pode ser positiva ou negativa).
- **RN04:** Toda movimentação é atribuída ao **usuário logado**; tipo e motivo são registrados.
- **RN05:** O estoque **pode ficar negativo** (a venda não bloqueia — herdado de {{doc:0002F}}); o ajuste serve para corrigir.
- **RN06:** `min_stock` é **opcional**; produto sem nível mínimo definido não dispara alerta de estoque baixo.
- **RN07:** Quantidades respeitam a unidade do produto (`un` inteiro, `kg` fracionário), em `numeric(10,3)` — padrão de {{doc:0001F}}.
- **RN08:** A movimentação de `saída` gerada por uma venda referencia a venda de origem (`sale_id`) para rastreio.

## Scope

### Includes
- Tabela de **movimentações** de estoque (`entrada`/`saida`/`ajuste`) com quantidade, motivo, data, usuário e referência à venda.
- **Entrada** manual e **ajuste** de inventário (por contagem real).
- **Retrofit** da venda (0002F): a baixa passa a registrar uma movimentação de `saída`.
- **Nível mínimo** por produto + tela de **estoque baixo**.
- **Histórico** de movimentações por produto, filtrável (tipo e período).
- **Destaque** de estoque negativo na lista de produtos existente (`/products`).

### Does NOT Include
- Custo na entrada, custo médio e valorização de estoque (R$) — pertence à feature de Lucro (#6); aqui o estoque é só **quantidade**, sem dinheiro, para não acoplar o cálculo de lucro a esta feature.
- Gestão de compras / pedido a fornecedor (cotação, pedido, recebimento) — fora do MVP; a entrada é um registro manual simples.
- Transferência de estoque entre lojas/depósitos — multi-loja/depósito está fora do MVP (um tenant = um estoque).
- Estoque por lote, validade ou número de série — fora do MVP; controla-se a quantidade total por produto.
- Reserva de estoque (separar para um pedido) — não há pedido/separação no MVP.
- Dar entrada bipando código de barras — no MVP o produto é selecionado por busca; bipar na entrada entra depois se necessário.
- **Alerta proativo** (push/e-mail/notificação) de estoque baixo — no MVP o aviso é **passivo** (tela "Estoque baixo" + realce); notificar ativamente exige infra de notificação, fora do escopo.
- **Permissões por papel** (restringir entrada/ajuste só ao dono) — no MVP qualquer usuário autenticado do tenant pode movimentar; RBAC fica para quando houver mais de um papel real.
- **Estorno/cancelamento de venda** e a reversão automática da movimentação de `saída` — a venda (0002F) não tem cancelamento no MVP; quando existir, tratará a reversão (compensação por `entrada`).
- Relatórios avançados / gráficos de giro e curva ABC — Fase 3 do roadmap em {{doc:PRODUCT}}.

## Success Metrics

| metric | target | source |
|---|---|---|
| Vendas finalizadas que geram movimentação de `saída` (retrofit RF03) | 100% | validação + testes (toda venda = 1+ saída) |
| Divergência entre `stock_quantity` e a soma das movimentações | 0 | validação + testes de consistência |
| Produtos com `min_stock` configurado (hipótese de adoção, a calibrar) | ≥ 50% dos itens do tenant | dados do tenant (query nos produtos) |
| Tempo para registrar uma entrada de produto | < 20s | unknown — sem telemetria ainda |

## References

- {{doc:0001F}} — Produtos (fornece `stock_quantity`, unidade `un`/`kg`; ganha o campo `min_stock`).
- {{doc:0002F}} — Venda rápida (já baixa o estoque; passa a registrar movimentação de `saída`).
- {{doc:PRODUCT}} — blueprint do produto (recurso #4 Estoque, Fase 2 — Controlar).
- {{doc:OWNER}} — perfil do founder (nível beginner, decisões explicadas).
- Feature dependente: Lucro/fechamento (#6) — consumirá as movimentações e o custo para o lucro real.
