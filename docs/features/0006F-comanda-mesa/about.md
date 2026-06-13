---
id: 0006F
type: feature-about
slug: comanda-mesa
status: specified
created: 2026-06-12
updated: 2026-06-13
related: [0001F, 0002F, 0003F, 0004F, 0005F, PRODUCT, OWNER]
---

## TL;DR

Fecha a **Fase 1 (Vender)** com o recurso #3: **Comanda/mesa** para o lado bar/lanchonete. O operador **abre** uma comanda com um rótulo livre (ex: "Mesa 3", "João"), **lança itens** ao longo do atendimento (baixando estoque na hora), vê o **total parcial ao vivo**, e no fim **fecha** escolhendo a forma de pagamento — momento em que a comanda vira uma **venda** ({{doc:0002F}} `sales`+`sale_items`), integra com o financeiro ({{doc:0004F}}: dinheiro→caixa, fiado→a receber) e alimenta o lucro ({{doc:0005F}}: snapshot de custo por item). Pode **remover item** ou **cancelar** a comanda (estornando estoque). Várias comandas abertas ao mesmo tempo; multi-tenant com RLS; dinheiro em centavos; comanda imutável após fechada/cancelada.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Requirements](#requirements)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

A venda de hoje ({{doc:0002F}}) é **atômica**: monta o carrinho e finaliza num clique. Isso serve o mercado (checkout rápido), mas **não atende mesa**: bar/lanchonete precisa de uma **conta aberta** que dura o atendimento, recebendo itens aos poucos, até o cliente pedir a conta.

- Quem é afetado: operador/garçom (precisa abrir conta por mesa e ir lançando) e dono (quer a venda da mesa entrando no caixa/estoque/lucro como qualquer outra).
- O que falta/quebra: não há estado "conta aberta"; só existe venda já fechada. Sem comanda, o atendimento por mesa fica no caderno/cabeça, fora do sistema.
- Sinal observável: hipótese — sem telemetria (greenfield). A observar com os primeiros tenants híbridos: quantas comandas abrem/fecham por dia e quanto tempo ficam abertas.
- Workaround atual: anotar a mesa no papel e lançar tudo no checkout só no fim (perde itens, erra conta).

## Users

| role | goal | pain |
|---|---|---|
| Operador/garçom | Abrir conta por mesa/cliente e lançar itens ao longo do atendimento | Sem comanda, controla mesa no papel e digita tudo no fim |
| Dono do estabelecimento | A venda da mesa entra no caixa/estoque/lucro como a venda de balcão | Atendimento de mesa fica fora do sistema |

## Requirements

Notação `RF` (funcional), `RN` (regra de negócio). Agrupados por frente.

### Comanda: abertura e itens
- **RF01:** Operador **abre** uma comanda informando um **rótulo livre** (texto — ex: "Mesa 3", "João"); passa a existir uma comanda **aberta**. Pode haver **várias** comandas abertas ao mesmo tempo no tenant.
- **RF02:** Operador **lança item** na comanda (produto + quantidade + **observação** opcional, ex: "sem cebola"); a baixa de **estoque** acontece **no lançamento** ({{doc:0003F}}). Reusa busca por código de barras / nome ({{doc:0002F}}).
- **RF03:** Operador **remove** um item de uma comanda aberta → o **estoque do item é estornado** (devolvido).
- **RF04:** Operador **cancela** uma comanda aberta → **estorna o estoque de todos os itens**; a comanda fica **cancelada** e **não** gera venda.
- **RF05:** A comanda aberta exibe seus itens (com observação) e o **total parcial ao vivo** = Σ (**preço atual** do produto × quantidade). Esse total é **informativo** (usa o preço corrente do produto); o valor cobrado é o **snapshot do fechamento** (RN05) — se o preço do produto mudar durante o atendimento, parcial e final podem divergir (a tela de fechamento exibe o valor final).

### Fechamento (vira venda)
- **RF06:** Operador **fecha** a comanda num passo de confirmação (dialog) que exibe o **valor final** (snapshot) e a **forma de pagamento** (dinheiro/pix/cartão/fiado; **fiado exige cliente** — {{doc:0004F}}). Ao **confirmar**, cria uma **venda** (`sales` + `sale_items`) com **snapshot de preço e custo** lidos **no fechamento** e a comanda fica **fechada**. **Abandonar** o fluxo antes de confirmar **não fecha** a comanda (segue aberta).
- **RF07:** No fechamento: **dinheiro** → entrada de **caixa** (origem venda); **fiado** → conta a **receber** ({{doc:0004F}}); o **snapshot de custo** por item alimenta o **lucro** ({{doc:0005F}}). O fechamento **não** baixa estoque de novo (já baixado no lançamento — RN08).
- **RF08:** Tela de **comandas**: lista as **abertas** (com total parcial) com acesso a lançar/remover/fechar/cancelar, e um **histórico** das fechadas/canceladas.

### Regras de negócio
- **RN01:** Comandas e itens são isolados por tenant (RLS), como nas demais features.
- **RN02:** Valores em **centavos** (inteiro); total ≥ 0.
- **RN03:** Estoque **baixa ao lançar** o item; **remover/cancelar estorna** (espelha o ledger de movimentações da {{doc:0003F}}: pode ficar negativo, não bloqueia a operação).
- **RN04:** **Várias** comandas abertas por tenant simultaneamente (diferente do turno único da {{doc:0005F}}).
- **RN05:** O **snapshot de preço/custo** do item é gravado **no fechamento** (lido do produto naquele momento) e vira `sale_items` **imutável** (RN03 da {{doc:0005F}}). A comanda aberta guarda só **produto + quantidade + observação** (sem preço congelado); por isso o total parcial (RF05) é informativo e o valor de cobrança é o do fechamento.
- **RN06:** Comanda **fechada** ou **cancelada** é **imutável** (auditoria); não reabre — abre-se uma **nova**.
- **RN07:** Fechar exige **≥ 1 item** (comanda vazia é rejeitada com erro, sem gravar venda). Fiado exige **cliente** selecionado — fechar em fiado **sem cliente** é **rejeitado com erro** (a venda não é criada), herdando {{doc:0002F}}/{{doc:0004F}}.
- **RN08:** O fechamento **não** baixa estoque (já foi baixado no lançamento — RN03), para **evitar baixa dupla**.
- **RN09:** Fechar **não** exige turno de caixa aberto (coerente com a {{doc:0005F}}, que de propósito não trava a venda por turno). O fechamento em **dinheiro** sempre gera a entrada de caixa; se houver turno aberto no momento, a entrada é **vinculada à sessão** e entra no **esperado da gaveta** ({{doc:0005F}}); se não houver, a entrada fica **sem sessão** — transparente para o operador (nenhum aviso ou bloqueio).
- **RN10:** Toda comanda (abertura/fechamento/cancelamento) é atribuída ao **usuário logado**; tenant do contexto (nunca do input).
- **RN11:** **Observação** por item é texto livre **opcional** (cozinha/bar); não afeta preço nem cálculo.

### Requisitos não-funcionais
- **RNF01:** Lista de comandas abertas e total parcial respondem rápido (índice por `tenant_id` + status).
- **RNF02:** O fechamento é **atômico** (venda + itens + caixa/fiado + snapshot de custo numa única transação); o estorno de estoque ao remover/cancelar também é atômico.

## Scope

### Includes
- **Abrir** comanda com rótulo livre; **várias** abertas por tenant.
- **Lançar** item (produto + qtd + observação) com **baixa de estoque no lançamento**; **remover** item e **cancelar** comanda com **estorno** de estoque.
- **Total parcial ao vivo** na comanda aberta.
- **Fechar** com forma de pagamento (dinheiro/pix/cartão/fiado; fiado exige cliente) → vira **venda** com snapshot de preço/custo, integrando caixa/fiado ({{doc:0004F}}) e lucro ({{doc:0005F}}).
- **Tela de comandas** (abertas + histórico de fechadas/canceladas).

### Does NOT Include
- **Dividir a conta / pagamento parcial / rateio entre pessoas** — adiado (Later); o MVP fecha a **conta inteira** numa forma de pagamento. Vira feature futura sobre esta base.
- **Cadastro de mesas numeradas** (estrutura de mesas) — o **rótulo livre** já cobre mesa e cliente; mesas estruturadas ficam para depois.
- **Impressão de comanda/cozinha** (KDS) — Fase 3 do roadmap.
- **Transferir item entre comandas / juntar ou dividir comandas** — fora do MVP (complexidade de movimentação entre contas).
- **Editar a quantidade de um item já lançado** — no MVP, corrige-se **removendo e relançando** (estorno + nova baixa). Razão: editar quantidade exigiria lógica nova de **diff de estoque** (calcular delta e ajustar a baixa); remover+relançar **reusa o caminho de estorno** que já existe (RN03), sem código novo — trade-off de simplicidade e integridade do ledger de estoque.
- **Travar a venda/fechamento quando não há turno de caixa aberto** — coerente com a {{doc:0005F}} (a sessão é conferência, não portão).
- **Reserva/abertura de mesa sem consumo** como entidade separada — comanda só existe a partir do atendimento.
- **Desfazer/estornar uma comanda já fechada** (pagamento ou comanda errada) — comanda fechada é imutável (RN06); estornar a venda exigiria um "cancelamento de venda" que ainda não existe. Workaround: abrir nova comanda; cancelamento de venda fica para feature futura.
- **Acesso concorrente de dois operadores à mesma comanda** (terminal compartilhado) — o MVP assume um terminal por loja (como o caixa único da {{doc:0005F}}); concorrência na mesma comanda só faz sentido com multi-terminal, fora do escopo atual.

## Success Metrics

| metric | target | source |
|---|---|---|
| Comandas fechadas que viraram `sale` com itens corretos (Σ do **preço snapshot** × qtd dos `sale_items` = total da venda) | 100% | query de auditoria por tenant/período (usa o preço gravado em `sale_items`, não o preço corrente do produto) |
| Itens **removidos** de comanda aberta com estoque estornado (movimento inverso registrado para o item) | 100% | query nos movimentos de estoque com origem comanda, por item removido |
| Comandas **canceladas** com estoque estornado de **todos** os itens (Σ estornos = Σ baixas da comanda) | 100% | query nos movimentos de estoque agregados por comanda cancelada |
| Snapshot de custo gravado no fechamento (itens de produto com custo) | 100% | query nos `sale_items` da venda de comanda |
| Tempo do fechamento (enviar pagamento → venda criada) | < 1s | unknown — sem telemetria ainda |

## References

- {{doc:0002F}} — Venda rápida (o fechamento da comanda reusa o pipeline `sales`/`sale_items`/pagamento; busca de produto/código de barras).
- {{doc:0001F}} — Produtos (fonte de preço/custo/unidade dos itens lançados).
- {{doc:0003F}} — Estoque (baixa no lançamento e estorno na remoção/cancelamento).
- {{doc:0004F}} — Financeiro (fechamento em dinheiro→caixa, fiado→a receber; cliente para fiado).
- {{doc:0005F}} — Lucro/fechamento (snapshot de custo no fechamento; vínculo opcional ao turno de caixa).
- {{doc:PRODUCT}} — blueprint (recurso #3 Comanda/mesa, fecha a Fase 1 — Vender).
- {{doc:OWNER}} — perfil do founder (nível beginner, decisões explicadas).
