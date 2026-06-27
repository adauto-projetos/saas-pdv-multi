---
id: 0014F
type: feature-about
slug: sf03-limite-operadores
status: draft
created: 2026-06-26
updated: 2026-06-26
related: [0011F]
---

## TL;DR

Cada loja pode cadastrar no máximo N operadores (3 hoje, o dono não conta), com o número guardado em `platform_settings` e editável pelo founder no painel super admin sem deploy. Ao tentar cadastrar acima do limite, o sistema bloqueia. Vira gancho de monetização. Depende de SF01 (fluxo de cadastro de operador).

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Requirements](#requirements)
- [Decisions](#decisions)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

Sem teto, qualquer loja cadastra operadores ilimitados, e a plataforma perde uma alavanca de receita óbvia (cobrar por mais funcionários). Hoje `platform_settings` guarda só o preço mensal — não há campo de limite de operadores nem onde ajustá-lo.

- `platform_settings` existe (`monthlyPriceCents`), mas não tem campo de máximo de operadores.
- O painel super admin (0011F SF02) edita o preço (padrão `updatePlanPriceAction`), mas não tem campo para o limite.
- O cadastro de operador (SF01) não consulta limite algum.
- **Sinal observável:** sem este campo, SF01 cadastra operadores sem teto.
- **Workaround atual:** nenhum — o número teria que ser fixado em código (dívida técnica para amarrar no plano depois).

## Users

| Role | Objetivo com esta feature | Dor atual |
|---|---|---|
| Founder | Definir/ajustar o teto de operadores por loja sem mexer no código | Não existe campo; teto seria hardcoded |
| Administrador (dono) | Saber claramente quantos operadores ainda pode cadastrar | Cadastro sem limite; sem aviso |

## Scope

### Includes

- Migração: campo `max_operators integer not null default 3` em `platform_settings`.
- Campo no painel super admin para editar `max_operators` (reusa o padrão de edição de preço, `updatePlanPriceAction`).
- Checagem no cadastro de operador (SF01): conta operadores ativos da loja (`role='operator'` e `is_active=true`) e bloqueia se já atingiu `max_operators`.
- Contagem exclui o `owner` (o dono não conta no limite).
- Mensagem clara ao atingir o teto, indicando o limite atual. A mensagem é informativa (não há botão de upgrade in-app); o upsell/cobrança é tratado manualmente pelo founder via WhatsApp — ver Does NOT Include. O "gancho de monetização" é o founder enxergar quais lojas bateram o teto, não um CTA no produto.
- Indicador de uso na tela "Usuários": "X de N operadores".

### Does NOT Include

- Tiers de plano (básico/pro com limites distintos) — há um único plano hoje; o campo é global até {{doc:0011F}} evoluir.
- Cobrança automática por operador extra — billing é manual (PIX/WhatsApp) no MVP.
- Fluxo dedicado de "transferir slot" — desnecessário: para trocar um operador no teto, o dono desativa um e cadastra outro (RN03 libera o slot). Não há fluxo extra porque o caminho manual já resolve.
- Desativação retroativa ao baixar o limite — reduzir `max_operators` abaixo da contagem atual de uma loja não desativa operadores existentes; só bloqueia novos cadastros (grandfather). Ver RN04.
- Limite por outros recursos (produtos, vendas) — só operadores nesta SF.

## Requirements

### Configuração

- **RF01:** Migração adiciona `platform_settings.max_operators integer not null default 3`.
- **RF02:** Painel super admin exibe e edita `max_operators` (server action protegida por `requireFounder()`), mesma UX da edição de preço.
- **RN01:** `max_operators` é global (uma linha em `platform_settings`) enquanto houver um único plano.

### Enforcement no cadastro

- **RF03:** Antes de criar operador, o sistema conta operadores ativos da loja (`tenant_members` onde `role='operator'` e `is_active=true`).
- **RF04:** Se a contagem ≥ `max_operators`, o cadastro é bloqueado com mensagem indicando o limite.
- **RN02:** O `owner` não entra na contagem.
- **RN03:** Operador desativado não conta — desativar libera um slot.
- **RN04:** Baixar `max_operators` abaixo da contagem atual de uma loja não desativa ninguém — operadores existentes são preservados (grandfather); o teto só vale para novos cadastros até a contagem voltar a caber.
- **RNF01:** A checagem de limite + a criação são atômicas o suficiente para não permitir ultrapassar por concorrência (contagem + insert na mesma transação, ou constraint/verificação no servidor).

### Feedback

- **RF05:** Tela "Usuários" mostra "X de N operadores" com base na contagem ativa e em `max_operators`.

## Decisions

| Decisão | Rationale | Alternativa rejeitada |
|---|---|---|
| Limite em `platform_settings` | Editável pelo founder sem deploy; vira gancho de receita | Número fixo em código — dívida para amarrar no plano depois |
| Global hoje, "por plano" depois | Existe um único plano; o campo já serve quando surgirem tiers | Modelar tiers agora — complexidade sem necessidade |
| Owner fora da contagem | O teto é sobre funcionários, não sobre o dono | Contar o owner — reduziria o valor percebido do plano |
| Desativar libera slot (por contagem) | Simples e previsível; reflete o estado real | Slot "reservado" pós-desativação — complexidade sem ganho |

## Success Metrics

| Métrica | Target | Fonte |
|---|---|---|
| Cadastros de operador acima do limite que passam | 0 | Testes de enforcement + auditoria de `tenant_members` |
| Ajuste de `max_operators` aplicado sem deploy (reflete na hora) | 100% | `platform_settings.updatedAt`/`updatedBy` após ação no painel |
| Lojas que atingem o teto (sinal para o founder agir no upsell manual) | leading indicator, sem target | Contagem de operadores ativos vs. `max_operators` por loja |

## References

- {{doc:0011F}} — `platform_settings` e painel super admin (base desta SF); padrão `updatePlanPriceAction`
- [SF01 about.md](../SF01-nucleo-usuarios-permissoes/about.md) — fluxo de cadastro de operador onde a checagem entra (prerequisite)
- db/schema/platform-settings.ts — recebe o campo `max_operators`
- db/schema/tenant-members.ts — `role` e `is_active` para a contagem
- app/(admin)/superadmin/actions.ts — `updatePlanPriceAction` como padrão para editar o campo
- [discovery.md](../../discovery.md) — confirmação de que `platform_settings` existe sem campo de limite
