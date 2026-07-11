---
id: 0025F
type: feature-about
slug: categorias-produto
status: draft
created: 2026-07-10
updated: 2026-07-11
related: [0001F, 0002F, 0004F, 0014F, 0016F, 0020F, 0023H, 0024H]
---

## TL;DR

Categorias de produto criadas e gerenciadas pelo próprio tenant (CRUD completo: criar, renomear, excluir, cor e ordem manual), substituindo a lista fixa de 7 categorias hardcoded que hoje é igual para todas as lojas. Decisões validadas com o owner em 2026-07-10: cada tenant (existente e novo) nasce com as 7 categorias atuais e os produtos existentes são migrados; excluir categoria em uso move os produtos para "Sem categoria" após aviso com contagem; criação inline no formulário de produto + gestão completa acessível da tela de produtos.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

A lista de categorias de produto é uma constante de código, igual para todos os tenants, e o lojista não consegue adaptá-la ao mix do seu negócio.

- **Quem é afetado:** dono do estabelecimento (cadastro de produtos) e operador de caixa (filtro por chips na tela do caixa).
- **O que falta:** a lista fixa oferece 7 categorias (Bebidas, Hortifruti, Mercearia, Lanches, Doces, Limpeza, Outros) mais o estado "Sem categoria" (produto sem categoria atribuída — já hoje é ausência de valor, não uma categoria); tudo vive em `lib/validation/product.ts:7-15` e não há como criar, renomear ou remover categorias.
- **Sinal observável:** pedido direto do owner em 2026-07-10, a partir do select "Categoria" do formulário de produto ("quero opção de poder criar categorias").
- **Workaround atual:** classificar produtos que não se encaixam como "Outros" ou deixar "Sem categoria" — os chips de filtro do caixa perdem utilidade conforme o catálogo cresce.
- **Evidência de dívida prevista:** {{doc:0001F}} listou categoria em "Does NOT Include" como "evolução do cadastro" — esta feature é essa evolução.

## Users

| role | goal | pain |
|---|---|---|
| Dono do estabelecimento | Criar/organizar categorias que refletem o mix da loja (mercado + bar + lanchonete) | Lista fixa não cobre o negócio; typo ou categoria inútil não pode ser corrigida |
| Operador de caixa | Filtrar a grade de produtos por chips fiéis ao catálogo | Produtos amontoados em "Outros"/"Sem categoria" tornam o filtro inútil |

Acesso: gestão de categorias fica sob a permissão `produtos` já existente ({{doc:0014F}}) — quem cadastra produto gerencia categoria.

## Scope

### Includes

- **RF01:** Usuário com permissão `produtos` cria categoria informando nome e, opcionalmente, cor escolhida de uma paleta pré-definida (8–10 opções).
- **RF02:** Usuário renomeia categoria existente; produtos vinculados, select do formulário e chips do caixa refletem o novo nome imediatamente.
- **RF03:** Usuário exclui categoria; se houver produtos vinculados, o sistema exibe a contagem ("N produtos serão movidos para Sem categoria") e, após confirmação, move-os para "Sem categoria".
- **RF04:** Usuário cria categoria inline no formulário de produto (opção "+ Nova categoria" no seletor) sem sair do fluxo de cadastro; a categoria recém-criada sai selecionada no produto e entra no fim da ordem manual (RF06) até ser reordenada.
- **RF05:** Usuário lista, renomeia, exclui, recolore e reordena categorias em superfície de gestão própria, acessível a partir da tela de produtos.
- **RF06:** Usuário define ordem manual das categorias; select do formulário e chips do caixa seguem essa ordem.
- **RF07:** Select do formulário de produto, chips de filtro do caixa e qualquer exibição do nome de categoria (ex.: listagem de produtos) passam a ser gerados a partir das categorias do tenant (fim da lista hardcoded).
- **RF08:** O caixa exibe um chip "Sem categoria" ao final dos chips sempre que existir ao menos um produto sem categoria no tenant, mantendo esses produtos filtráveis.
- **RN01:** Nome de categoria é único por tenant (comparação sem diferenciar maiúsculas/acentos); criação/renomeio com nome duplicado é rejeitado com mensagem clara. Unicidade é por tenant, não global — mesmo precedente do código de barras ({{doc:0001F}}, RN01).
- **RN02:** Toda categoria pertence a um tenant; isolamento garantido por RLS na tabela nova, seguindo o padrão de acesso via sessão do usuário ({{doc:0020F}}).
- **RN03:** Todo tenant existente e todo tenant novo nasce com as 7 categorias padrão atuais (Bebidas, Hortifruti, Mercearia, Lanches, Doces, Limpeza, Outros), já com as cores equivalentes às dos chips atuais do caixa; produtos existentes que usam essas strings são migrados para as categorias correspondentes — nenhum produto perde a categoria que tem hoje. Após o seed, as 7 padrão são categorias comuns: podem ser renomeadas, recoloridas e excluídas como qualquer outra (RF02/RF03).
- **RN04:** "Sem categoria" não é categoria cadastrada — é a ausência de categoria no produto. Não aparece na gestão, não pode ser renomeada, excluída nem recebe cor/ordem.
- **RN05:** Categoria criada sem escolha de cor recebe automaticamente uma cor da paleta; quando o tenant tem mais categorias que cores disponíveis, as cores se repetem (a paleta cicla) — cor não é única por categoria.
- **RN06:** "Sem categoria" é nome reservado (comparação sem diferenciar maiúsculas/acentos): criar ou renomear categoria para esse nome é rejeitado, evitando conflito com o estado de RN04.
- **RN07:** Excluir ou renomear categoria não altera vendas em andamento (itens já lançados permanecem); telas de caixa abertas refletem a mudança na próxima atualização da grade.
- **RNF01:** A tabela nova entra na cobertura automática do teste de isolamento entre tenants ({{doc:0020F}}) — nenhum dado de categoria de uma loja pode ser lido/alterado por outra.

### Does NOT Include

- Subcategorias/hierarquia — nenhum sinal de necessidade no ICP; adiciona complexidade de navegação no caixa sem dor mapeada.
- Ícone/emoji por categoria — o produto já tem emoji/foto próprios ({{doc:0016F}}); a cor do chip cobre a distinção visual.
- Categorias para outras entidades (ex.: contas a pagar do financeiro têm campo `category` texto próprio, {{doc:0004F}}) — escopo aqui é exclusivamente categoria de produto.
- Reatribuição em lote de produtos entre categorias (mover N produtos de uma vez para outra categoria) — a troca é produto a produto no formulário; ação em massa só entra se a dor aparecer após a adoção.
- Permissão separada para excluir categoria — o aviso com contagem (RF03) é a salvaguarda; granularidade de permissão por ação segue o modelo atual de {{doc:0014F}} (permissão `produtos` cobre o módulo inteiro).
- Relatórios/análise de vendas por categoria — nenhuma tela de relatório muda nesta feature; fica para evolução de relatórios.
- Limite de quantidade de categorias (teto técnico ou por plano de assinatura) — sem limite nesta feature; gating por plano é pós-MVP (billing Asaas não integrado).

## Success Metrics

| metric | target | source |
|---|---|---|
| Adoção: tenants ativos com ≥1 categoria própria (além das 7 padrão) | Tenant solicitante em ≤30 dias; ≥50% dos tenants ativos em 90 dias | Contagem na tabela de categorias por tenant |
| Migração sem perda | 100% dos produtos existentes mantêm a categoria atual após o deploy | Comparação contagem por categoria antes/depois da migração |
| Regressão zero no caixa | 0 hotfix aberto sobre filtro por chips ou formulário de produto nos 30 dias pós-deploy | `docs/features/` (novos IDs H) |

## References

- {{doc:0001F}} — cadastro de produto com markup: feature-mãe; previa categoria como evolução; precedente RN01 de unicidade por tenant.
- {{doc:0002F}} — venda rápida: dona da tela do caixa onde os chips de categoria filtram a grade.
- {{doc:0004F}} — financeiro: CRUD tenant-scoped de `customers` é o padrão canônico a imitar (tabela + RLS + service + picker).
- {{doc:0014F}} — usuários & permissões: permissão `produtos` que gate a gestão.
- {{doc:0016F}} — fotos de produto: última extensão end-to-end do cadastro de produto (trilha schema → service → form → caixa).
- {{doc:0020F}} — camada de dados & services: contrato data/service e suite de isolamento RLS que cobre tabelas novas.
- {{doc:0023H}} / {{doc:0024H}} — estado atual do formulário de produto (contraste do select, layout mobile, barra Salvar) que não pode regredir.
- Discovery técnica: `docs/features/0025F-categorias-produto/discovery.md` · histórico: `docs/features/0025F-categorias-produto/past-features.md`.

---

## Addendum: Additional Deliveries

| Delivery | Description | Justification |
|----------|-------------|---------------|
| Toggle "Categorias" no caixa | Chips recolhidos por padrão; "Todos" fixo + botão expande/oculta; chip do filtro ativo visível recolhido; expandido usa wrap sem scroll horizontal | Pedido do owner em 2026-07-11, após ver os chips em produção local (scroll horizontal ruim no mobile) — improvement |
| `scripts/deploy.sh` — chave SSH em `$HOME/.ssh/pdv_deploy` | Troca o path hardcoded `/tmp/pdv_deploy` pelo home do usuário | Mudança pré-existente no working tree, sem relação com 0025F; incluída no merge por decisão do owner — discovery |

**Impact:** nenhum nos RF/RN da feature — o toggle adiciona controle de visibilidade sobre RF06/RF07/RF08 sem alterar seus contratos; o ajuste de deploy é infra local.
