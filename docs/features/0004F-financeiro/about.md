---
id: 0004F
type: feature-about
slug: financeiro
status: specified
created: 2026-06-11
updated: 2026-06-11
related: [0002F, PRODUCT, OWNER]
---

## TL;DR

Controle financeiro do SAAS PDV.multi em 3 frentes integradas: **Caixa** (dinheiro físico entrando/saindo, com saldo corrente e extrato), **Contas a Receber / Fiado** (cadastro de cliente, dívidas vindas de venda `fiado` ou avulsas, com pagamentos parciais e status) e **Contas a Pagar** (despesas da loja com categoria, vencimento e pagamentos parciais). Integra a venda (0002F): venda `fiado` gera uma conta a receber para um cliente; venda em **dinheiro** entra no caixa. Recebimentos e pagamentos em dinheiro também movimentam o caixa. Dinheiro em centavos, multi-tenant com RLS. Recurso #5 do roadmap (Fase 2 — Controlar). Abertura/fechamento de caixa por turno fica para a feature #6.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Requirements](#requirements)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

A venda (via {{doc:0002F}}) registra o faturamento, mas não há controle do **dinheiro** nem das **dívidas** (de clientes e da loja).

- Quem é afetado: dono (precisa saber quem deve, o que pagar e quanto tem em caixa) e operador (lança fiado, sangria, recebe).
- O que falta/quebra: fiado some no caderno; contas a pagar são esquecidas e vencem; o saldo do caixa é "achismo".
- Sinal observável: hipótese — sem telemetria (greenfield). Sinais a observar com os primeiros tenants: taxa de uso de `fiado` na 1ª semana, nº de contas a pagar que chegam ao vencimento ainda em aberto, e com que frequência o saldo do caixa é consultado.
- Workaround atual: caderno de fiado, post-its de contas, conferência manual da gaveta.

## Users

| role | goal | pain |
|---|---|---|
| Dono do estabelecimento | Saber quem deve, o que tem a pagar e o saldo do caixa | Fiado no caderno, contas esquecidas, caixa sem controle |
| Operador/caixa | Lançar venda fiado, registrar sangria/suprimento, receber fiado | Sem sistema, anota à parte e erra a conta |

## Requirements

Notação `RF` (funcional), `RN` (regra de negócio). Agrupados por frente.

### Caixa
- **RF01:** Operador registra **entrada** manual no caixa (suprimento/recebimento avulso) com valor e descrição.
- **RF02:** Operador registra **saída** manual do caixa (sangria) com valor e descrição.
- **RF03:** Sistema exibe o **saldo corrente** do caixa.
- **RF04:** Operador vê o **extrato** de movimentações do caixa (data, tipo, valor, descrição, origem), filtrável por período.
- **RF05:** Venda finalizada em **dinheiro** (via {{doc:0002F}}) gera automaticamente uma **entrada** no caixa (retrofit).

### Contas a Receber / Fiado
- **RF06:** Operador cadastra **cliente** (nome obrigatório, telefone opcional).
- **RF07:** Venda com forma de pagamento **`fiado`** exige escolher um cliente e gera uma **conta a receber** no valor da venda.
- **RF08:** Operador registra uma conta a receber **avulsa** (cliente, valor, descrição, vencimento) sem venda.
- **RF09:** Operador registra um **recebimento (parcial ou total)** de uma conta a receber, escolhendo a forma (`dinheiro` | `pix` | `cartao`); o saldo devedor diminui e o status atualiza. Recebimento em **dinheiro** gera entrada no caixa; pix/cartão atualizam a conta mas não tocam o caixa.
- **RF10:** Operador visualiza o **total em aberto por cliente** (soma de TODAS as contas a receber do cliente em aberto/parciais — um cliente pode ter várias ao mesmo tempo) e a lista de contas a receber (filtro por status/cliente).

### Contas a Pagar
- **RF11:** Operador registra uma **conta a pagar** (descrição, valor, vencimento, **categoria**).
- **RF12:** Operador registra um **pagamento (parcial ou total)** de uma conta a pagar, escolhendo a forma (`dinheiro` | `pix` | `cartao`); o saldo diminui e o status atualiza. Pagamento em **dinheiro** gera saída do caixa; pix/cartão atualizam a conta mas não tocam o caixa.
- **RF13:** Operador visualiza as contas a pagar (filtro por status/categoria).

### Transversal
- **RF14:** Contas a receber e a pagar têm **vencimento**; as **vencidas** (em aberto após o vencimento) são destacadas.

### Regras de negócio
- **RN01:** Todos os dados financeiros são isolados por tenant (multi-tenancy / RLS), como em {{doc:0002F}}.
- **RN02:** Valores em **centavos** (inteiro); não negativos.
- **RN03:** Um pagamento não pode exceder o **saldo devedor** da conta (parcial ≤ saldo restante).
- **RN04:** O **status** da conta é derivado do saldo: `aberto` (nada pago), `parcial` (pago < total), `quitado` (saldo zero).
- **RN05:** O **saldo do caixa** = soma das entradas − soma das saídas (movimentações).
- **RN06:** Toda movimentação/conta/pagamento é atribuída ao **usuário logado**; tenant da sessão (nunca do input).
- **RN07:** Venda `fiado` exige um **cliente** selecionado; sem cliente, não finaliza.
- **RN08:** Só movimenta o caixa o que é em **dinheiro**: entram a venda em dinheiro e o **recebimento** (de conta a receber) em dinheiro; saem a **sangria** e o **pagamento** (de conta a pagar) em dinheiro. Pix/cartão atualizam a conta, mas **não** tocam o caixa físico.
- **RN09:** O **cliente** pertence ao tenant; nome é obrigatório.
- **RN10:** Contas, movimentações e pagamentos são **imutáveis** após criados (registro de auditoria); correção é feita por um novo lançamento compensatório, não por edição/exclusão.

### Requisitos não-funcionais
- **RNF01:** Extrato do caixa e listas (contas a receber/pagar, total por cliente) respondem rápido (alvo ~100ms), apoiados em índices por `tenant_id` + data/status.
- **RNF02:** Atomicidade financeira: o pagamento, a atualização do saldo/status da conta e a movimentação de caixa ocorrem numa **única transação** — nunca um sem o outro (sem dinheiro "perdido"); a imutabilidade (RN10) preserva a trilha de auditoria.

## Scope

### Includes
- Cadastro de **clientes** (nome + telefone).
- **Contas a receber**: de venda `fiado` e avulsas; pagamentos parciais; saldo e status; total em aberto por cliente.
- **Contas a pagar**: com categoria e vencimento; pagamentos parciais; saldo e status.
- **Caixa**: movimentações manuais (sangria/suprimento) + automáticas (venda em dinheiro, recebimento/pagamento em dinheiro); saldo corrente + extrato.
- **Vencimento** e destaque de contas **vencidas** (a receber e a pagar).
- **Retrofit da venda (0002F)**: forma de pagamento `fiado` (gera conta a receber + exige cliente) e venda em dinheiro (entra no caixa).

### Does NOT Include
- Pagamento integrado (gateway/maquininha/Pix automático) — exige adquirência/integração financeira; fora do MVP (Fase 3 em {{doc:PRODUCT}}).
- **Abertura/fechamento de caixa por turno** (saldo inicial, conferência da gaveta, cego) — é o coração da feature de Fechamento (#6); aqui o caixa é livro contínuo + saldo, para não duplicar.
- Conciliação bancária / saldo de banco (pix/cartão) — o caixa é só dinheiro físico no MVP; valores em banco não são controlados aqui.
- Edição ou estorno de conta/movimentação já lançada — registros são imutáveis (RN10); correção é por lançamento compensatório. Inclui o caso de uma venda `fiado` lançada errada: a venda (0002F) não tem cancelamento no MVP, então a correção é manual (novo lançamento), não estorno automático.
- Contas a pagar **recorrentes** (geração automática mensal) — fora do MVP; cada conta é lançada manualmente.
- Juros/multa por atraso no fiado — fora do MVP; a conta vencida é só destacada, sem cálculo de encargo.
- Relatórios financeiros avançados (DRE, fluxo de caixa projetado, gráficos) — Fase 3.
- Cálculo de **lucro real** — pertence à feature #6; aqui controla-se dinheiro e dívidas, não a margem.

## Success Metrics

| metric | target | source |
|---|---|---|
| Divergência entre saldo do caixa e a soma das `cash_movements` | 0 | query de auditoria por tenant (saldo corrente vs Σ movimentações), rodável a qualquer momento |
| Divergência entre saldo devedor da conta e (total − Σ pagamentos) | 0 | query de auditoria por conta |
| Vendas `fiado` vinculadas a um cliente | 100% | query nas vendas (`payment_method='fiado'` com `customer_id` não-nulo) |
| Tempo para lançar uma sangria/suprimento | < 15s | unknown — sem telemetria ainda |

## References

- {{doc:0002F}} — Venda rápida (ganha a forma `fiado` + entrada no caixa em vendas à vista).
- {{doc:PRODUCT}} — blueprint do produto (recurso #5 Financeiro: fiado + contas a pagar + caixa, Fase 2).
- {{doc:OWNER}} — perfil do founder (nível beginner, decisões explicadas).
- Feature dependente: Lucro/fechamento (#6) — usa o caixa, as contas e a margem para o fechamento do dia.
