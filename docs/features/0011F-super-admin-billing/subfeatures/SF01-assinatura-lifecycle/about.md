---
id: 0011F
type: feature-about
slug: sf01-assinatura-lifecycle
status: draft
created: 2026-06-22
updated: 2026-06-22
related: [BRN-super-admin-e-planos]
---

## TL;DR

Introduz o ciclo de vida de assinatura do tenant (testando → ativa → travada) com trial de 7 dias, modo somente-leitura (`travada`), aviso antecipado de vencimento, carência de 2 dias e seed do founder. É a base que SF02 (painel admin) consome.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Requirements](#requirements)
- [Decisions](#decisions)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

Toda loja criada hoje vive para sempre sem pagar. Não há mecanismo de trial, cobrança ou bloqueio de acesso quando o período pago vence. O founder não tem como controlar quais lojas devem faturar nem como reagir ao não-pagamento.

- `tenants` não tem `valid_until`, `status` de assinatura nem data de trial.
- `users` não tem marca de founder — impossível distinguir o dono da plataforma dos donos de loja.
- Nenhuma das 5 features de operação (venda, comanda, estoque, financeiro, caixa) verifica estado de assinatura antes de persistir.
- Sem estado de assinatura, o painel admin (SF02) não tem o que exibir ou controlar.
- **Workaround atual:** não existe controle formal; todas as lojas são perpétuas por ausência de mecanismo, não por decisão.

## Users

| Role | Objetivo com esta feature | Dor atual |
|---|---|---|
| Dono de loja (tenant owner) | Entender claramente quando precisa pagar e o que deixa de funcionar se não pagar | Nenhum aviso — a loja poderia ser travada sem qualquer comunicação prévia |
| Founder (super admin) | Ter controle do estado de cada loja para liberar após recebimento do PIX | Não existe nenhum controle; toda loja é gratuita para sempre |

## Scope

### Includes

- Coluna `valid_until` (timestamp com timezone) em `tenants` — data até quando a loja está paga/em trial.
- Coluna `suspended_at` (timestamp, nullable) em `tenants` — quando preenchida, força status `travada` independente de `valid_until` (suspensão manual).
- Coluna `is_founder` (boolean) em `users` — marca o founder; semeada via script de migração/seed.
- Tabela `subscription_log` — registra cada liberação/suspensão: tenant_id, action (`trial_started`/`renewed`/`suspended`/`released`), valid_until_before, valid_until_after, by_user_id, at.
- Status derivado por função utilitária `getTenantStatus(tenant)` → `testando | ativa | travada`; não gravado em coluna (derivado de `valid_until`, `suspended_at`, e carência de 2 dias).
- Trial: toda loja nasce com `valid_until = created_at + 7 dias` (definido no onboarding, `lib/services/tenants/onboarding.ts`).
- Carência: status `travada` só ativado quando `valid_until + 2 dias < agora` — cliente tem 2 dias de folga após o vencimento.
- Seed do founder: script de migração que marca `is_founder = true` no usuário do founder (por e-mail configurado em variável de ambiente `FOUNDER_EMAIL`).
- Tenant-guard: função `requireActiveTenant(tenantId)` em `lib/auth/tenant-guard.ts` que lança erro padronizado quando loja está `travada`; chamada nas actions de escrita.
- Actions de escrita bloqueadas em `travada`: `finalizeSaleAction` (caixa), mutations de estoque (estoque/actions.ts), mutations financeiras (financeiro/caixa, pagar, receber/actions.ts), mutations de comanda (comandas/actions.ts).
- Banner de aviso antecipado: exibido quando `valid_until - 3 dias < agora` e status ≠ `travada`, mostrando dias restantes e link/WhatsApp para pagar. Dispara tanto em `testando` quanto em `ativa` — a urgência de pagar é a mesma nos dois estados.
- Banner de loja travada: exibido quando status = `travada`; mostra motivo e WhatsApp do founder (`13 99130-6911`); não falha silenciosamente.
- Leitura/relatórios sempre permitidos, mesmo em `travada` (produtos, configurações, perfil, histórico de vendas).

### Does NOT Include

- Cron job ou rotina agendada para varrer lojas — status é derivado on-the-fly; sem infra adicional.
- Integração com gateway de pagamento (Asaas/Stripe/PIX automático) — cobrança é 100% manual no MVP.
- Impersonação do founder na loja do cliente — adiada para subfeature posterior.
- Painel admin para liberar/suspender lojas — isso é SF02.
- Múltiplos founders ou delegação de acesso admin — apenas o founder único no MVP.
- Apagamento ou arquivamento de dados ao travar — dados preservados para sempre.
- Notificação por e-mail ou push ao vencer/travar — comunicação com o cliente é somente via banner in-app; canais externos ficam fora do MVP.
- Isenção do founder do bloqueio de escrita — o usuário founder pode ter sua própria loja; se `valid_until` desta loja vencer, o guard aplica normalmente. O founder não tem bypass automático de tenant-guard na própria loja.

## Requirements

### Banco

- **RN01:** Todo tenant nasce com `valid_until = created_at + 7 dias` e um registro `trial_started` em `subscription_log`.
- **RN02:** Status derivado por `getTenantStatus(tenant, hasRenewed)` — três estados mutuamente exclusivos e coletivamente exaustivos:
  - `travada`: `suspended_at IS NOT NULL` OU `valid_until + INTERVAL '2 days' < NOW()` (avaliado primeiro).
  - `testando`: nenhum registro `action='renewed'` em `subscription_log` para este tenant E não está `travada`.
  - `ativa`: há ao menos um registro `action='renewed'` em `subscription_log` E não está `travada`.
  - A flag `hasRenewed` é resolvida com uma query por `tenant_id` + `action='renewed'`; resultado pode ser cacheado por request.
- **RN03:** `suspended_at` preenchido manualmente (pelo founder via SF02) força `travada` independente de `valid_until`.
- **RN04:** Histórico de assinatura preservado em `subscription_log`; nunca apagar registros antigos.

### Onboarding

- **RF01:** `createUserWithTenant` define `valid_until = NOW() + INTERVAL '7 days'` e insere `subscription_log(action='trial_started')` atomicamente no mesmo `db.transaction`.

### Tenant-guard

- **RF02:** `requireActiveTenant(tenantId)` lê o tenant pelo `db` (owner connection, sem RLS) e lança `TenantLockedError` se status = `travada`.
- **RF03:** Cada action de escrita chama `requireActiveTenant(ctx.tenantId)` antes de qualquer mutação. A chamada ocorre depois de `requireAuthContext()` e antes de `withUserRls`.
- **RNF01:** `requireActiveTenant` retorna em menos de 50ms (query por PK com índice).

### Banners de UI

- **RF04:** Quando `valid_until - 3 dias < agora` e status ≠ `travada`, todas as páginas da loja exibem banner amarelo fixo com contagem regressiva e mensagem "Pague via PIX — WhatsApp 13 99130-6911".
- **RF05:** Quando status = `travada`, todas as páginas da loja exibem banner vermelho fixo com "Loja travada — entre em contato para reativar: WhatsApp 13 99130-6911". O banner não é dispensável.
- **RF06:** Ações de escrita bloqueadas retornam mensagem de erro visível na UI (toast ou inline) — nunca falha silenciosa.

### Founder seed

- **RF07:** Script de migração (`db/seeds/founder.ts` ou SQL inline) lê `FOUNDER_EMAIL` do ambiente e seta `is_founder = true` no usuário correspondente. Erros se o e-mail não existir na tabela.

## Decisions

| Decisão | Rationale | Alternativa rejeitada |
|---|---|---|
| Status derivado (não coluna) | Nunca desincroniza; zero cron | Coluna `status` gravada por job: pode ficar defasada se job falhar |
| `suspended_at` como coluna separada | Suspensão manual precisa persistir além de `valid_until` | Flag booleana: perderia o timestamp |
| Carência de 2 dias | Evita travar cliente que paga na manhã do vencimento | Zero carência: atrito desnecessário |
| `requireActiveTenant` na action, não no service | Actions já agregam validações pré-serviço; serviços permanecem agnósticos a assinatura | Guard no service: polui serviços com lógica transversal |
| `is_founder` em `users`, não em variável de ambiente | Audível, transacional, expansível | Email em env: frágil e não rastreável |
| Trial fixo de 7 dias no signup | Simples, previsível, sem config extra | Trial configurável por plano: complexidade desnecessária no MVP |

## Success Metrics

| Métrica | Target | Fonte |
|---|---|---|
| Lojas em trial que convertem para ativa (primeiros 30 dias) | ≥ 30% | `subscription_log` count(action='renewed') / count(action='trial_started') |
| Lojas travadas que reativam em até 7 dias | ≥ 60% | `subscription_log` days_between(travada → renewed) |
| Ações de escrita bloqueadas retornam erro visível (não falha silenciosa) | 100% | Teste manual + cobertura de teste unitário no guard |

## References

- {{doc:BRN-super-admin-e-planos}} — brainstorm origem (decisões de modelo de assinatura, trial, modo travada, preservação de dados)
- [db/schema/tenants.ts](../../../../../db/schema/tenants.ts) — schema atual a estender
- [db/schema/users.ts](../../../../../db/schema/users.ts) — schema atual a estender
- [lib/services/tenants/onboarding.ts](../../../../../lib/services/tenants/onboarding.ts) — ponto de injeção do trial
- [lib/auth.ts](../../../../../lib/auth.ts) — `requireAuthContext` a ser combinado com o novo guard
- [db/rls.ts](../../../../../db/rls.ts) — `withUserRls`; tenant-guard roda ANTES desta chamada
