---
id: 0014F
type: feature-about
slug: sf02-override-acao-sensivel
status: draft
created: 2026-06-26
updated: 2026-06-26
related: [0006F, 0005F]
---

## TL;DR

Quando um operador tenta uma ação sensível que não tem permissão (cancelar comanda/item, fechar caixa), o sistema pede a senha de um Administrador na hora; digitou a senha válida → a ação acontece e fica registrada quem autorizou. Sem estado "pendente": ou libera agora ou não. Depende de SF01 (permissões e papéis).

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Requirements](#requirements)
- [Decisions](#decisions)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

Com SF01, sem permissão o botão some — e isso trava o atendimento quando o caso é legítimo (cliente desiste, item errado lançado, caixa precisa fechar e o operador não tem "Caixa"). O dono não quer dar a permissão permanente, mas precisa liberar a exceção pontual sem trocar de usuário no balcão.

- Hoje (com SF01) a única saída para uma ação bloqueada é o operador sair e o dono logar — interrompe a fila.
- As ações sensíveis que já existem no código são: cancelar comanda, remover item de comanda e fechar caixa (sessão).
- Não há registro de exceções: se a permissão fosse dada e tirada, não sobraria rastro de quem autorizou o quê.
- **Sinal observável:** funções `cancelComanda`/`removeComandaItem` (comanda-service) e `closeCashSession` (cash-session-service) existem e seriam bloqueadas por SF01 sem alternativa.
- **Workaround atual (sem esta SF):** conceder permissão permanente ao operador (perde o controle) ou trocar de usuário (trava o balcão).

## Users

| Role | Objetivo com esta feature | Dor atual |
|---|---|---|
| Operador sem a permissão | Concluir uma ação sensível legítima sem virar admin | Botão some (SF01); precisa chamar o dono e trocar de login |
| Administrador (autorizador) | Autorizar a exceção na hora, com a própria senha, e deixar rastro | Não há mecanismo de exceção pontual |

> Neste doc, "Administrador" = autorizador = o `owner` da loja OU um Operador com a permissão `gerenciar_usuarios`. Não é um papel novo no banco.

## Scope

### Includes

- Diálogo de override disparado quando `requirePermission` falha em uma ação sensível: pede email/identificação + senha de um autorizador.
- Autorizador válido = `owner` OU operador com `gerenciar_usuarios` da mesma loja; senha verificada por bcrypt.
- Execução imediata: senha válida → a ação roda na mesma requisição; senha inválida → erro, nada acontece.
- Sem estado "pendente": não há fila de aprovação; desativar um Administrador durante o turno não deixa override órfão.
- Tabela `override_log(tenant_id, actor_user_id, authorizer_user_id, action_code, target_ref, created_at)` com RLS por tenant.
- Ligação nas ações sensíveis que já existem: cancelar comanda, remover item de comanda, fechar caixa.
- Autorização remota: o dono pode ditar a senha por telefone (risco aceito no brainstorm) — o fluxo é o mesmo, não há tratamento especial.

### Does NOT Include

- Construir desconto e estorno — não existem no PDV. O override é desenhado como gate reutilizável (decisão, não promessa): quando essas ações forem criadas como features próprias, elas chamam o mesmo gate de override.
- Aprovação assíncrona / fila de pendências — descartado: override é na hora ou não é.
- Override por biometria/PIN/2FA — só senha do autorizador no MVP.
- Limitar quantas vezes um override pode ser usado por turno — sem teto no MVP; o log serve de auditoria.

## Requirements

### Disparo e diálogo

- **RF01:** Ao falhar `requirePermission` numa ação marcada como sensível, a action retorna um sinal de "override necessário" e a UI abre o diálogo de override.
- **RF02:** Diálogo coleta identificação do autorizador + senha; submete junto com o contexto da ação original.
- **RF03:** Ações sensíveis cobertas no MVP: `cancelar_comanda`, `remover_item_comanda`, `fechar_caixa`.

### Validação e execução

- **RF04:** Autorizador é validado: pertence à mesma loja, está ativo, e é `owner` ou tem `gerenciar_usuarios`.
- **RF05:** Senha do autorizador conferida por bcrypt; inválida → erro, ação não executa.
- **RF06:** Senha válida → a ação original executa na mesma requisição, atribuída ao operador (autoria da ação continua sendo do operador; o autorizador fica no log).
- **RN01:** Não há persistência de estado intermediário; se a senha não vier, nada muda no banco.
- **RN02:** O autorizador não pode ser o próprio operador bloqueado (precisa de um Administrador distinto, salvo se o operador já tivesse a permissão — caso em que não há bloqueio).

### Log de uso

- **RF07:** Todo override bem-sucedido grava `override_log` com operador, autorizador, código da ação e referência do alvo (id da comanda/sessão).
- **RF08:** Tentativa de override com senha inválida não grava log de sucesso (opcional: contador de falhas fora do MVP).
- **RNF01:** `override_log` tem RLS por tenant; só `owner`/`gerenciar_usuarios` leem o log na auditoria (SF04).

## Decisions

| Decisão | Rationale | Alternativa rejeitada |
|---|---|---|
| Override síncrono (sem pendência) | Resolve no balcão; desativar admin no turno não deixa órfão | Fila de aprovação — estado órfão e mais complexidade |
| Autoria da ação fica com o operador; autorizador vai no log | Quem executou foi o operador; o admin só liberou a exceção | Atribuir a ação ao admin — distorce o rastreio de quem operou |
| Cobre só ações sensíveis existentes | Desconto/estorno não existem; ligar no que existe entrega valor real | Esperar desconto/estorno para lançar — adia o controle |
| Senha do autorizador (não PIN/2FA) | Reusa bcrypt existente; zero infra nova | PIN/2FA — fluxo e infra novos sem necessidade no MVP |

## Success Metrics

| Métrica | Target | Fonte |
|---|---|---|
| Ações sensíveis por operador sem a permissão concluídas via override (sem trocar de usuário) | ≥ 95% | `override_log` (overrides bem-sucedidos) ÷ ações sensíveis executadas por operador sem a permissão |
| Overrides com autorizador inválido que executam a ação | 0 | Testes de autorização + auditoria do log |
| Cobertura de log: overrides bem-sucedidos registrados | 100% | Comparação ação sensível executada por operador sem permissão vs. `override_log` |

## References

- {{doc:0006F}} — comanda-service: `cancelComanda`, `removeComandaItem` (alvos do override)
- {{doc:0005F}} — cash-session-service: `closeCashSession` (alvo do override)
- [SF01 about.md](../SF01-nucleo-usuarios-permissoes/about.md) — `requirePermission`, papéis e `gerenciar_usuarios` (prerequisite)
- lib/auth/session.ts — verificação de senha (bcrypt) reusada para o autorizador
- db/rls.ts — modelo de RLS para `override_log`
- [discovery.md](../../discovery.md) — confirmação de que cancelar/remover/fechar existem e desconto/estorno não
