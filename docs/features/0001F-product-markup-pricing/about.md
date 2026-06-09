---
id: 0001F
type: feature-about
slug: product-markup-pricing
status: specified
created: 2026-06-08
updated: 2026-06-08
related: [PRODUCT, OWNER]
---

## TL;DR

Cadastro de produtos do SAAS PDV.multi com **markup automático**: o usuário informa custo e % de ganho, e o sistema calcula o preço de venda (custo + %). Existe porque calcular preço na mão erra e não dá base para estoque nem lucro. Headline: é a primeira feature da Fase 1 — sem produto cadastrado nada vende; a calculadora de markup é um auxílio: pode-se cadastrar sem informar custo/% (preço digitado direto) e o preço calculado é sempre editável.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Requirements](#requirements)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

Comerciantes híbridos (mercado + bar + lanchonete) precisam cadastrar produtos antes de vender, mas não há sistema — o projeto é greenfield.

- Quem é afetado: dono do estabelecimento e operador/caixa que cadastram e vendem.
- O que falta/quebra: cálculo de preço feito na mão (calculadora, caderno) gera erro e perda de margem; sem cadastro estruturado, não há venda, estoque nem cálculo de lucro.
- Sinal observável: hipótese — não há dado coletado (greenfield); a validar com os primeiros tenants.
- Workaround atual: calculadora/planilha/caderno fora do sistema.

## Users

| role | goal | pain |
|---|---|---|
| Dono do estabelecimento | Cadastrar produtos com preço e margem corretos, rápido | Calcula preço na mão, erra a margem, perde controle de lucro |
| Operador/caixa | Ter o produto pronto e com preço para vender | Sem produto cadastrado não consegue registrar a venda |

## Requirements

Notação `RF` (funcional), `RN` (regra de negócio).

- **RF01:** Usuário cadastra produto com nome, código de barras, unidade (`un`|`kg`) e estoque inicial.
- **RF02:** Usuário informa custo e % de margem; sistema calcula preço de venda = custo + (custo × %).
- **RF03:** Preço de venda calculado é editável — usuário pode sobrescrever manualmente.
- **RF04:** Usuário pode cadastrar produto sem custo, informando o preço de venda direto.
- **RF05:** Sistema oferece % de margem padrão configurável, pré-preenchida em cada novo cadastro.
- **RF06:** Ao alterar o custo de um produto existente, o sistema sugere novo preço = custo + (custo × % armazenada) e só aplica após confirmação. Se o preço atual foi definido manualmente (RF03), a sugestão é exibida com aviso e o preço não muda sem confirmação. Cancelar a sugestão mantém o novo custo salvo e o preço inalterado.
- **RF07:** Usuário lista e edita produtos já cadastrados.
- **RF08:** Usuário visualiza a quantidade em estoque (somente leitura) na lista de produtos; a movimentação de estoque é tratada na feature de Estoque.
- **RN01:** Código de barras é único por tenant (estabelecimento).
- **RN02:** Custo e preço de venda não podem ser negativos.
- **RN03:** Sem custo informado, a margem e o lucro do produto ficam indefinidos (aceito).
- **RN04:** O cálculo de markup é auxiliar — não é obrigatório para salvar o produto.
- **RN05:** Dados de produto são isolados por tenant (multi-tenancy).

## Scope

### Includes
- Cadastro de produto: criar, listar e editar.
- Cálculo de markup sobre o custo (custo + %), em tempo real ao digitar.
- Preço de venda editável e cadastro sem custo (preço manual).
- % de margem padrão configurável por tenant.
- Recalcular preço ao alterar o custo, com confirmação do usuário.
- Unidade de venda por unidade (`un`) ou peso (`kg`).
- Estoque inicial informado no cadastro e exibido (somente leitura) na lista de produtos.

### Does NOT Include
- Arredondamento automático de preço (ex: R$13,00 → R$12,99) — decidido fora do MVP; entra depois se necessário.
- Código de barras interno para granel/peso — fora do MVP; produtos sem código tratados manualmente por ora.
- Categoria, descrição, foto, fornecedor — não bloqueiam vender; ficam para evolução do cadastro.
- Margem sobre o preço de venda (custo ÷ (1−%)) — opção não escolhida; o campo do cadastro é rotulado "margem %" e representa markup sobre o custo. A margem real sobre a venda (conceito distinto, sempre menor) será calculada e exibida no relatório de lucro, não aqui.
- Movimentação de estoque além da inicial (entradas/baixas) — pertence à feature de Estoque (Fase 2 do roadmap em {{doc:PRODUCT}}).
- Cálculo de lucro real — pertence à feature de Lucro/fechamento (Fase 2 do roadmap em {{doc:PRODUCT}}).

## Success Metrics

| metric | target | source |
|---|---|---|
| Produtos cadastrados com custo + margem preenchidos | ≥ 80% dos itens do tenant | dados do tenant (query na tabela de produtos) |
| Tempo médio para cadastrar um produto | < 30s | unknown — sem telemetria ainda |
| Produtos salvos com preço inválido (0/negativo) | 0 | validação + logs |

## References

- {{doc:PRODUCT}} — blueprint do produto (roadmap, modos mercado/bar/lanchonete, multi-tenancy).
- {{doc:OWNER}} — perfil do founder (nível beginner, decisões explicadas).
- Features dependentes (ainda não documentadas): Estoque e Lucro/fechamento — consomem custo e margem definidos aqui.
