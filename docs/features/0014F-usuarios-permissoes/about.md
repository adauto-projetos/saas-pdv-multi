---
id: 0014F
type: feature-about
slug: usuarios-permissoes
status: draft
created: 2026-06-26
updated: 2026-06-26
related: [0011F, 0013F, 0002F, 0005F, 0006F]
---

## TL;DR

Epic que introduz operadores (funcionários) com permissões granulares por usuário no PDV. Hoje toda loja tem um único usuário "dono" que pode tudo — não há como dar acesso a um caixa sem entregar preço de custo, faturamento e configurações. Decomposta em 4 subfeatures independentes (núcleo, override, limite por plano, auditoria). Detalhamento e ordem em [epic.md](epic.md).

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

Cada loja tem um único login (o dono), que enxerga e faz tudo. Não existe forma de o lojista colocar um funcionário no caixa sem entregar o controle total do negócio.

- Não há conceito de "operador": quem opera o balcão usa o login do dono ou não usa o sistema.
- O dono não tem como esconder custo, markup, faturamento (Financeiro/lucro) nem configurações da loja de um caixa.
- Não há checagem de permissão em nenhuma action hoje — toda action só valida autenticação (`requireAuthContext`), nunca autorização.
- **Sinal observável:** o papel `tenant_members.role` só assume `owner`; nenhum registro de operador existe no banco.
- **Workaround atual:** dono compartilha a própria senha com o funcionário — sem rastro de quem fez o quê e expondo todos os dados sensíveis.

## Users

| Role | Objetivo com esta feature | Dor atual |
|---|---|---|
| Administrador (dono) | Cadastrar funcionários com acesso limitado, função por função | Só existe o login dele; ou entrega tudo ou não delega |
| Operador (funcionário) | Operar venda/comanda/caixa sem ver dados sigilosos da loja | Usa o login do dono; vê preço de custo, faturamento, configs |
| Gerente de turno (operador com "Gerenciar usuários") | Criar operadores e autorizar ações sensíveis na ausência do dono | Não existe delegação; só o dono resolve |

> "Gerente de turno" não é um papel separado no banco — é qualquer Operador com a permissão "Gerenciar usuários" marcada. Os valores de `tenant_members.role` são apenas `owner` e `operator`.

## Scope

### Includes

- Cadastro, edição e desativação (soft) de operadores pelo Administrador — [SF01](subfeatures/SF01-nucleo-usuarios-permissoes/about.md).
- 8 permissões granulares por usuário: Vendas, Comanda, Caixa, Produtos, Estoque, Financeiro, Loja, Gerenciar usuários — [SF01](subfeatures/SF01-nucleo-usuarios-permissoes/about.md).
- Login do operador (email + senha provisória, reusa a auth existente) e troca de senha — [SF01](subfeatures/SF01-nucleo-usuarios-permissoes/about.md).
- Hierarquia dono-supremo + anti-escalonamento + invalidação de sessão ao desativar — [SF01](subfeatures/SF01-nucleo-usuarios-permissoes/about.md).
- Override de ação sensível com senha de Administrador + log de uso, ligado a cancelar comanda/item e fechar caixa — [SF02](subfeatures/SF02-override-acao-sensivel/about.md).
- Limite de operadores por plano (campo em `platform_settings`, editável no painel super admin) — [SF03](subfeatures/SF03-limite-operadores/about.md).
- Tela de auditoria "quem fez o quê" por operador/turno usando colunas de autoria existentes — [SF04](subfeatures/SF04-auditoria-autoria/about.md).

### Does NOT Include

- Login por PIN/apelido curto — descartado no brainstorm por custo de um fluxo novo; email+senha reusa o que existe.
- Construir as ações de **desconto** e **estorno** — não existem no PDV hoje; são features próprias que depois plugam no framework de override (SF02).
- Permissão por registro (operador só vê o que ele abriu) — escolhido por módulo (3.4); por registro é mais complexo e não pedido.
- Convite por email com auto-cadastro de senha — não há serviço de email no projeto; senha provisória resolve o MVP.
- Recuperação de senha self-service ("esqueci a senha") — sem serviço de email; quem reseta é o Administrador (define nova senha provisória).
- Mesmo operador em mais de uma loja — fora do MVP; cada operador pertence a uma única loja.
- Transferência de propriedade da loja (passar o papel `owner` para outro usuário) — o dono-criador é fixo no MVP; sucessão não está no escopo desta entrega.
- Tiers de plano diferentes (básico/pro) — hoje há um único plano; o limite é global até {{doc:0011F}} evoluir para múltiplos planos.

## Success Metrics

| Métrica | Target | Fonte |
|---|---|---|
| Lojas ativas com ≥1 operador que logou ao menos uma vez (delegação real, não só cadastro) | ≥ 30% em 60 dias pós-release | `tenant_members` (role=operator, ativo) cruzado com eventos de login |
| Vazamento de dado sensível (Financeiro/lucro) a operador sem a permissão | 0 incidentes | Testes de gate/RLS + ausência de relato |
| Ações sensíveis liberadas por override sem troca de usuário | ≥ 95% das tentativas legítimas resolvidas no balcão | Log de override (SF02) |

## References

- {{doc:0011F}} — super-admin-billing: `platform_settings` e painel super admin (limite vive aqui)
- {{doc:0002F}} — venda-rápida: `sales.userId` (autoria de venda)
- {{doc:0005F}} — lucro-fechamento: `cash_sessions.openedBy/closedBy`
- {{doc:0006F}} — comanda-mesa: `comandas.openedBy/closedBy` + cancelamento (alvo do override)
- docs/brainstorm/2026-06-26-usuarios-operador-permissoes.md — brainstorm de origem
- [epic.md](epic.md) — decomposição, ordem e decisões de escopo do epic
- [discovery.md](discovery.md) — análise de código (auth, RLS, colunas de autoria, platform_settings)
