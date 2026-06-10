---
id: 0002F
type: feature-about
slug: venda-rapida-mercado
status: specified
created: 2026-06-09
updated: 2026-06-09
related: [0001F, PRODUCT, OWNER]
---

## TL;DR

Tela de **caixa/checkout** do SAAS PDV.multi: o operador registra vendas rápido — bipa o código de barras (ou busca por nome), vende por unidade ou por peso (kg), monta um carrinho editável com total ao vivo e finaliza escolhendo a forma de pagamento. Existe porque a feature 0001F deixa cadastrar produto mas **não deixa vender** — é o coração do PDV (recurso #2 do roadmap, Fase 1). Headline: checkout veloz por teclado/leitor; ao finalizar, registra a venda e dá baixa simples no estoque. Pagamento integrado e balança ficam fora do MVP.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Requirements](#requirements)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

Comerciantes híbridos cadastram produtos (via {{doc:0001F}}) mas não têm como **registrar a venda** — o PDV não vende.

- Quem é afetado: operador/caixa (registra a venda) e dono (precisa do faturamento e da base pro lucro).
- O que falta/quebra: sem tela de caixa, a venda é feita na calculadora/caderno; total errado, sem base pra estoque nem lucro.
- Sinal observável: hipótese — sem telemetria (greenfield); validar com os primeiros tenants.
- Workaround atual: calculadora/caderno fora do sistema.

## Users

| role | goal | pain |
|---|---|---|
| Operador/caixa | Registrar a venda rápido, bipando ou digitando | Sem tela de caixa, soma na mão e erra o total |
| Dono do estabelecimento | Ver as vendas do dia e ter base pro lucro | Sem registro estruturado, não há faturamento nem lucro |

## Requirements

Notação `RF` (funcional), `RN` (regra de negócio).

- **RF01:** Operador adiciona produto ao carrinho informando o código de barras (entrada por teclado/leitor).
- **RF02:** Operador busca produto por nome e adiciona ao carrinho (itens de granel/sem código).
- **RF03:** Item por peso (`kg`): operador digita a quantidade (peso); subtotal = preço de venda × peso.
- **RF04:** Operador ajusta a quantidade de um item do carrinho e remove itens.
- **RF05:** Sistema calcula o subtotal de cada item e o total da venda em tempo real.
- **RF06:** Operador finaliza a venda escolhendo a forma de pagamento de uma **lista fixa** (`dinheiro` | `pix` | `cartao`) — rótulo, sem processamento e não editável pelo usuário no MVP.
- **RF07:** Ao finalizar, o sistema registra a venda (itens, quantidades, preços, total, forma, data, operador) e dá baixa da quantidade vendida no estoque dos produtos.
- **RF08:** Operador cancela/limpa a venda em andamento sem registrar nada.
- **RF09:** Operador visualiza a lista das vendas **do dia atual** (data/hora, total, forma de pagamento). Consulta de outros dias fica para o fechamento de caixa (#6).
- **RF10:** O campo de código mantém o foco; ao confirmar (Enter), o item é adicionado e o foco volta ao campo — para bipagem em sequência.
- **RN01:** Dados de venda são isolados por tenant (multi-tenancy / RLS), como em {{doc:0001F}}.
- **RN02:** O preço do item é capturado do produto no momento da venda (snapshot do `salePriceCents`); alteração futura de preço não muda vendas passadas.
- **RN03:** Não é possível finalizar uma venda com o carrinho vazio.
- **RN04:** Quantidade/peso de um item deve ser maior que zero.
- **RN05:** A venda **não** é bloqueada por estoque insuficiente no MVP. A baixa é persistida no momento da venda; se o estoque já estiver zerado/insuficiente, a venda procede e o estoque fica negativo, **sem aviso bloqueante**. O controle e o alerta de estoque baixo pertencem à feature de Estoque (#4).
- **RN06:** Valores monetários em centavos (inteiro); total = soma dos subtotais.
- **RN07:** A forma de pagamento é apenas um rótulo registrado, de uma lista fixa (`dinheiro` | `pix` | `cartao`) — sem integração de maquininha/Pix/cartão.
- **RN08:** A venda é atribuída ao **usuário autenticado** (dono ou operador); não há troca de operador dentro da tela no MVP — quem está logado é quem vende.

### Requisitos não-funcionais

- **RNF01:** Adicionar item (bipar/buscar) e atualizar o total devem ser percebidos como instantâneos (alvo ~100ms), sustentando a métrica de venda < 20s. A busca por código de barras usa o índice por `tenant_id` + código.

## Scope

### Includes
- Tela de caixa (checkout): adicionar item por código de barras e por busca de nome.
- Venda por unidade (`un`) e por peso (`kg`, peso digitado).
- Carrinho editável: ajustar quantidade, remover item; subtotal e total ao vivo.
- Finalizar a venda com forma de pagamento (rótulo) e baixa simples no estoque.
- Cancelar/limpar a venda em andamento.
- Lista das vendas do dia (registro que alimenta o fechamento de caixa, feature #6).
- Foco automático no campo de código + adicionar com Enter (fluxo de bipagem).

### Does NOT Include
- Pagamento integrado (maquininha, Pix, cartão real) — exige gateway/adquirência e conciliação financeira; complexidade e custo altos demais para validar a venda agora (Fase 3 em {{doc:PRODUCT}}).
- Integração com balança (hardware) — exige driver/protocolo específico por modelo de balança; o peso digitado já permite vender por `kg` no MVP.
- Desconto por item ou na venda — não bloqueia vender e mantém o checkout simples; esforço médio, entra depois se houver demanda.
- Alerta de estoque baixo, entradas e relatórios de estoque — é o objetivo dedicado da feature de Estoque (#4); construir aqui duplicaria escopo e geraria retrabalho.
- Histórico de vendas de outros dias (além do dia atual) — consulta/relatório histórico pertence ao fechamento de caixa (#6); aqui basta o registro do dia para o operador conferir.
- Persistência do carrinho entre sessões — o carrinho representa a venda em andamento; recuperar venda interrompida (aba fechada/queda) adiciona estado e complexidade sem ganho no MVP, então o carrinho é perdido se a sessão cair.
- Comanda/mesa (abrir, lançar itens, fechar conta) — é outro modo de venda (hospitalidade) com escopo próprio, na feature #3.
- Impressão de cupom/fiscal/cozinha — exige integração fiscal e de impressora; fora do MVP (Fase 3).
- Lucro e fechamento de caixa detalhado — é a feature #6; aqui a venda só **gera o dado** (total e custo via produto), sem relatório de lucro.

## Success Metrics

| metric | target | source |
|---|---|---|
| Tempo para registrar uma venda de 5 itens | < 20s | unknown — sem telemetria ainda |
| Vendas com divergência de total (soma errada) | 0 | validação + testes |
| Itens adicionados por código de barras | ≥ 70% dos itens vendidos | dados do tenant (query nas vendas) |

## References

- {{doc:0001F}} — Cadastro de produtos com markup (fornece preço, unidade, estoque e código consumidos aqui).
- {{doc:PRODUCT}} — blueprint do produto (roadmap; recurso #2 Venda rápida, Fase 1).
- {{doc:OWNER}} — perfil do founder (nível beginner, decisões explicadas).
- Features dependentes (ainda não documentadas): Estoque (#4) e Lucro/fechamento (#6) — consomem a baixa de estoque e o total/custo definidos aqui.
