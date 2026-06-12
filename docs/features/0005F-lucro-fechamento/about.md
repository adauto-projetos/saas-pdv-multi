---
id: 0005F
type: feature-about
slug: lucro-fechamento
status: specified
created: 2026-06-11
updated: 2026-06-12
related: [0001F, 0002F, 0004F, PRODUCT, OWNER]
---

## TL;DR

Fecha a Fase 2 do roadmap (recurso #6) com 2 frentes: **Lucro do dia** (faturamento − custo dos produtos vendidos = margem real, com % e tratamento de item sem custo) e **Fechamento de caixa por turno** (abrir com fundo de troco, operar, e no fim conferir a gaveta: saldo **esperado** em dinheiro vs **contado** vs **divergência**). O custo de cada item é gravado como **snapshot** na venda (retrofit de {{doc:0002F}} `finalizeSale`) para que o lucro histórico nunca mude. O caixa contínuo de {{doc:0004F}} ganha o conceito de **sessão/turno**. Dinheiro em centavos (lucro pode ser negativo = prejuízo), multi-tenant com RLS, registros imutáveis.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Requirements](#requirements)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

A venda ({{doc:0002F}}) mostra **faturamento**, e o financeiro ({{doc:0004F}}) mostra o **saldo** do caixa — mas ninguém mostra o **lucro real** nem confere a **gaveta** no fim do dia.

- Quem é afetado: dono (quer saber se ganhou dinheiro, não só quanto girou) e operador (precisa fechar o caixa e justificar sobra/falta).
- O que falta/quebra: o "lucro" hoje é faturamento (ignora o custo da mercadoria); o caixa é um livro contínuo sem abrir/fechar turno, então não há "esperado vs contado".
- Sinal observável: hipótese — sem telemetria (greenfield). A observar com os primeiros tenants: com que frequência o lucro do dia é consultado, e quantos fechamentos batem (divergência zero).
- Workaround atual: calcular margem na cabeça/planilha; conferir a gaveta no olho, sem referência de saldo esperado.

## Users

| role | goal | pain |
|---|---|---|
| Dono do estabelecimento | Saber o lucro real do dia (margem), não só o faturamento | Confunde girar dinheiro com ganhar dinheiro |
| Operador/caixa | Abrir e fechar o caixa do turno conferindo a gaveta | Sem saldo esperado, sobra/falta é achismo |

## Requirements

Notação `RF` (funcional), `RN` (regra de negócio). Agrupados por frente.

### Lucro do dia
- **RF01:** A venda ({{doc:0002F}}) já congela o **preço** por item (`unit_price_cents`); passa a gravar também o **custo (snapshot)** de cada item na finalização (retrofit de `finalizeSale`). Preço e custo do passado ficam imutáveis.
- **RF02:** Tela de **lucro do dia** exibe, para um período (padrão: hoje): **faturamento**, **custo total**, **lucro** (faturamento − custo) e **margem %** (lucro ÷ faturamento).
- **RF03:** Itens de produto **sem custo** cadastrado entram no cálculo com custo 0 e são **sinalizados** (aviso de lucro superestimado), nunca omitidos.

### Fechamento de caixa (turno)
- **RF04:** Operador **abre** o caixa informando o **saldo inicial** (fundo de troco); passa a existir uma sessão aberta.
- **RF05:** Movimentações de caixa ({{doc:0004F}}) feitas com a sessão aberta ficam **vinculadas à sessão** (por `session_id`).
- **RF06:** Operador **fecha** o caixa informando a **contagem** real da gaveta; o sistema exibe **saldo esperado** (saldo inicial + Σ de **todas** as movimentações em dinheiro do turno — venda em dinheiro e suprimento entram (+); sangria e pagamento em dinheiro saem (−); recebimento de fiado em dinheiro entra (+)), **contado** e **divergência** (contado − esperado; sobra/falta).
- **RF07:** Histórico de **sessões** (turnos): abertura, fechamento, esperado, contado, divergência, operador.

### Transversal
- **RF08:** A tela de caixa ({{doc:0004F}}) passa a indicar se há um **turno aberto** e dá acesso a abrir/fechar.

### Regras de negócio
- **RN01:** Todos os dados (sessões, snapshot de custo) são isolados por tenant (RLS), como em {{doc:0004F}}.
- **RN02:** Valores em **centavos** (inteiro). O **lucro pode ser negativo** (prejuízo) — diferente das contas/caixa, que não são negativos.
- **RN03:** O custo do item é um **snapshot imutável** gravado na venda; editar depois o `cost_cents` do produto **não** altera o lucro de vendas passadas.
- **RN04:** Produto sem custo (`cost_cents` nulo) → custo 0 no cálculo + item **marcado**; a venda nunca some do relatório.
- **RN05:** Lucro do dia = Σ(preço de venda − custo) dos itens vendidos no período. **Não** desconta sangrias nem contas a pagar (isso é controle de caixa, não margem de venda).
- **RN06:** Saldo **esperado** da gaveta = saldo inicial + Σ de **todas** as movimentações em dinheiro do turno (vendas em dinheiro, suprimentos, sangrias, recebimentos e pagamentos em dinheiro — cada uma com o sinal definido em {{doc:0004F}}). Pix/cartão/fiado **não** entram (não tocam a gaveta física — RN08 de {{doc:0004F}}). É independente do lucro (RN05): a gaveta conta **dinheiro físico**, o lucro conta **margem de venda**.
- **RN07:** Divergência = contado − esperado (positivo = sobra, negativo = falta). É **registrada**, não bloqueia o fechamento.
- **RN08:** Sessão de caixa (incluindo contagem e divergência) é **imutável** após fechada (auditoria); reabrir não existe — abre-se uma **nova** sessão.
- **RN09:** No máximo **uma sessão aberta por tenant** ao mesmo tempo (o MVP assume **um caixa por loja**; múltiplos terminais simultâneos ficam fora — ver Scope); abrir com uma já aberta é rejeitado; fechar exige uma sessão aberta.
- **RN10:** Toda sessão/abertura/fechamento é atribuída ao **usuário logado**; tenant da sessão (nunca do input).

### Requisitos não-funcionais
- **RNF01:** Lucro do dia e saldo esperado do turno respondem rápido (~100ms), apoiados em índices por `tenant_id` + data e em agregação direta (sem coluna de cache).
- **RNF02:** O snapshot de custo é gravado na **mesma transação** da venda (retrofit em `finalizeSale`) — nunca um item sem custo registrado por falha parcial.

## Scope

### Includes
- **Snapshot de custo** por item na venda (retrofit de {{doc:0002F}}).
- **Lucro do dia**: faturamento, custo, lucro e **margem %**, por período; tratamento de item sem custo.
- **Sessão de caixa (turno)**: abrir (saldo inicial), vincular movimentações, fechar com contagem; **esperado vs contado vs divergência**; histórico de sessões.
- **Esperado só de dinheiro** no fechamento (pix/cartão/fiado não entram na conferência da gaveta).
- Indicação de **turno aberto** na tela de caixa de {{doc:0004F}}.

### Does NOT Include
- **Ranking de produtos mais lucrativos** — adiado (Later); o snapshot já deixa os dados prontos para uma feature futura.
- **Comanda/mesa** (recurso #3 do roadmap) — o lucro é calculado **só sobre as vendas já existentes** ({{doc:0002F}}); não depende de atendimento por mesa, então comanda não entra aqui nem é pré-requisito.
- **Múltiplos caixas/terminais simultâneos por loja** — o MVP assume um caixa por tenant (RN09); suportar vários turnos abertos ao mesmo tempo exige vincular sessão a terminal/dispositivo, complexidade fora do nível atual.
- **Migração retroativa das movimentações antigas para sessões** — o caixa de {{doc:0004F}} já rodou sem turno; esse histórico aparece como "sem sessão". Reprocessar o passado em turnos não agrega e arrisca a trilha de auditoria.
- **Fechamento cego** (contar sem ver o esperado antes) — o MVP mostra o esperado; modo cego (anti-fraude) fica para depois para não atrasar o caminho feliz.
- **Relatórios avançados** (DRE, fluxo de caixa projetado, gráficos, comparativo entre dias) — Fase 3; o MVP entrega o número do dia, não análise histórica.
- **Descontar despesas do lucro** (contas a pagar, impostos) — misturar margem com despesa vira "resultado contábil", instável e difícil de explicar; lucro aqui é só margem de venda (RN05).
- **Conciliação bancária / saldo de pix-cartão** — a gaveta é só dinheiro físico (herdado de {{doc:0004F}}); valores em banco não são controlados no MVP.
- **Bloquear a venda quando não há turno aberto** — vender não exige caixa aberto; a sessão é uma camada de conferência, não um portão, para não travar a operação.

## Success Metrics

| metric | target | source |
|---|---|---|
| Divergência entre lucro exibido e Σ(preço − custo) das vendas do período | 0 | query de auditoria por tenant/período |
| Divergência entre esperado da sessão e (saldo inicial + Σ dinheiro do turno) | 0 | query de auditoria por sessão |
| Itens de venda (de produto com custo) com snapshot de custo gravado | 100% | query nos `sale_items` (custo snapshot não-nulo p/ produto com custo) |
| Tempo de resposta do fechamento (do envio da contagem até exibir a divergência) | < 1s | unknown — sem telemetria ainda |

## References

- {{doc:0002F}} — Venda rápida (ganha o snapshot de custo por item em `finalizeSale`).
- {{doc:0004F}} — Financeiro (o caixa contínuo ganha o conceito de turno/sessão; reusa RN08 dinheiro-only).
- {{doc:0001F}} — Produtos (fonte do `cost_cents` e da margem que viram o lucro real).
- {{doc:PRODUCT}} — blueprint (recurso #6 Lucro/fechamento, fecha a Fase 2 — Controlar).
- {{doc:OWNER}} — perfil do founder (nível beginner, decisões explicadas).
