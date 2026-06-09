---
id: PRODUCT
type: product
created: 2026-06-08
updated: 2026-06-08
related: [OWNER]
---

## TL;DR

**SAAS PDV.multi** é um PDV (point-of-sale) SaaS multi-tenant para estabelecimentos híbridos que operam como mercado + bar + lanchonete ao mesmo tempo. Existe porque PDVs comuns forçam escolher um único tipo de negócio. Headline: um único caixa que junta venda de varejo (código de barras + balança) e atendimento por comanda/mesa, com precificação e lucro automáticos.

## TOC

- [Vision](#vision)
- [ICP](#icp)
- [Core Value](#core-value)
- [Differentiators](#differentiators)
- [Business Model](#business-model)
- [MVP Scope](#mvp-scope)
- [Out of Scope (MVP)](#out-of-scope-mvp)
- [Users & Integrations](#users--integrations)
- [Roadmap](#roadmap)

## Vision

Tornar-se o PDV padrão de pequenos comércios híbridos no Brasil — lugares que vendem produto de prateleira e também servem mesa — eliminando a necessidade de operar dois sistemas (ou caderno) para varejo e atendimento.

## ICP

Pequenos estabelecimentos híbridos atendidos via assinatura SaaS. Cada estabelecimento é um tenant com dados isolados.

| segment | pain | JTBD | channel |
|---|---|---|---|
| Mercearia/conveniência com bar | Vende por código de barras mas também abre comanda; nenhum PDV cobre os dois | Operar prateleira e mesa no mesmo caixa | unknown — não definido |
| Lanchonete com mercadinho | Pedido de cozinha convive com venda de produtos embalados | Lançar comanda e vender item de prateleira sem trocar de sistema | unknown — não definido |
| Bar com venda de mercado | Comanda de mesa + venda de bebida/produto por unidade ou peso | Fechar conta de mesa e registrar venda avulsa juntas | unknown — não definido |

## Core Value

O único PDV que opera varejo (código de barras + balança, checkout rápido) e hospitalidade (comanda/mesa) no mesmo tenant, com precificação automática (custo + % de margem → preço de venda) que alimenta o cálculo de lucro real. Hipótese: comércios híbridos hoje usam dois sistemas, planilhas ou caderno — não há evidência coletada ainda; a validar com os primeiros tenants.

## Differentiators

- Operação dupla no mesmo caixa: venda por código de barras/peso e comanda de mesa, sem trocar de modo ou de sistema.
- Precificação automática: no cadastro do produto entra custo + % de ganho (ex: 30%) e o preço de venda sai calculado; a mesma margem alimenta o lucro real, não só o faturamento.
- Financeiro acoplado ao PDV: fiado (a receber), contas a pagar e movimentação de caixa no mesmo lugar onde a venda acontece.

## Business Model

`{"pricing":"assinatura mensal por estabelecimento (tenant); faixa de preço unknown — não definida","billing":"Asaas (aceita CPF/pessoa física; Pix, boleto, cartão, cobrança recorrente) — integração adiada para fase pós-MVP","channels":"unknown — não definido","unit_economics":"unknown — não definido"}`

Restrição de cobrança: founder sem CNPJ e sem intenção de abrir — Stripe inviável no Brasil (exige CNPJ). Asaas escolhido por aceitar pessoa física. Cobrança não integrada no MVP.

## MVP Scope

Seis recursos. Multi-tenancy (isolamento de dados por estabelecimento) é base de infraestrutura, não tela.

| # | Recurso | Modo | Nota |
|---|---|---|---|
| 1 | Cadastro de produtos com markup automático | base | custo + % de ganho → preço de venda automático |
| 2 | Venda rápida: código de barras + balança | mercado | checkout por leitura e por peso |
| 3 | Comanda/mesa: abrir, lançar itens, fechar conta | bar/lanchonete | atendimento por mesa/cliente |
| 4 | Estoque com baixa automática na venda | base | alerta de estoque baixo |
| 5 | Financeiro: fiado + contas a pagar + caixa | base | dívidas a receber, a pagar e movimentação (entrada/saída) |
| 6 | Lucro e fechamento de caixa | base | usa custo+margem para lucro real do dia |

## Out of Scope (MVP)

Cortado para validar rápido: impressão fiscal e de cozinha, pagamento integrado de venda (maquininha/Pix/cartão), múltiplas filiais por tenant, delivery, programa de fidelidade, relatórios avançados/gráficos.

Risco aberto registrado: impressão de cozinha fora do MVP pode limitar o uso real em lanchonete; reavaliar na Fase 3.

## Users & Integrations

- Usuários (3): admin da plataforma (founder), dono do estabelecimento (tenant owner), operador/caixa (funcionário do tenant).
- Integrações: Asaas (cobrança da assinatura; aceita CPF — adiada para pós-MVP). Hardware: leitor de código de barras (entrada via teclado) e balança. Pagamento de venda não integrado no MVP.

## Roadmap

- Fase 1 — Vender: recursos 1–3 (cadastro+markup, venda mercado, comanda).
- Fase 2 — Controlar: recursos 4–6 (estoque, financeiro, lucro/fechamento).
- Fase 3 — Expandir: impressão (cozinha/fiscal) e pagamento integrado de venda.
