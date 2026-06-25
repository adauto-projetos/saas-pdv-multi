---
id: 0011F
type: feature-about
slug: sf02-painel-super-admin
status: draft
created: 2026-06-22
updated: 2026-06-22
related: [BRN-super-admin-e-planos]
---

## TL;DR

Painel exclusivo do founder (`/superadmin`) para visualizar todas as lojas, métricas de saúde do negócio e executar ações de assinatura (liberar +30 dias ou suspender). Depende de SF01 (colunas `valid_until`, `is_founder`, `subscription_log`).

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Requirements](#requirements)
- [Decisions](#decisions)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

O founder não tem visibilidade de quais lojas estão em trial, quais pagaram, quais venceram nem quem precisa ser cobrado. Todas as ações de liberação são cegas — não existe UI para liberar ou suspender uma loja. Sem o painel, o controle do negócio é feito fora do sistema (planilha, memória).

- Nenhuma rota admin existe hoje; o founder acessa o sistema igual a qualquer dono de loja.
- `is_founder` não existe (criado em SF01) — sem distinção de papel.
- Sem painel, liberar uma loja requer acesso direto ao banco via psql/DBeaver no servidor Hetzner: alto risco, requer SSH, sem rastro de quem fez o quê e quando.
- Sem histórico de liberações (`subscription_log`, criado em SF01), o founder não sabe quem pagou quando.
- **Sinal observável:** toda liberação de loja desde o primeiro deploy exigiu intervenção manual no banco — o custo e risco crescem linearmente com o número de lojas.
- **Workaround atual:** acesso direto ao banco via SSH + psql; workaround de alto risco operacional sem auditoria.

## Users

| Role | Objetivo com esta feature | Dor atual |
|---|---|---|
| Founder (único) | Enxergar o estado de todas as lojas num só lugar e liberar/suspender em 1 clique | Zero visibilidade; qualquer ação requer acesso direto ao banco |

## Scope

### Includes

- Rota `/superadmin` protegida: só acessível quando `user.is_founder = true`; redireciona para `/` se não for founder.
- Guard `requireFounder()` em `lib/auth/admin.ts`: lê usuário da sessão pelo `db` (owner, bypassa RLS), verifica `is_founder`, lança `UnauthorizedError` se falso.
- Link condicional "Admin" no `AppSidebar` (`components/layout/AppSidebar.tsx`): exibido só quando o usuário logado tem `is_founder = true`; invisível para donos de loja comuns.
- Dashboard inicial de `/superadmin` com painel de métricas:
  - Total de lojas por estado: testando / ativa / travada (contagem).
  - Lista de lojas que vencem nos próximos 3 dias (nome, `valid_until`, estado).
  - Faturamento por loja: somatório de `sales.total_cents` groupado por `tenant_id` (período: mês corrente).
  - Último acesso por loja: `MAX(created_at)` das tabelas `sales` ou `stock_movements` por tenant.
- Lista completa de lojas: nome, estado derivado, `valid_until`, faturamento do mês, último acesso, botões de ação.
- Ação "Liberar +30 dias": calcula `new_valid_until = MAX(valid_until, NOW()) + INTERVAL '30 days'` (acumula dias), seta `valid_until`, zera `suspended_at` se estava suspenso, insere `subscription_log(action='renewed')`. Requer confirmação via dialog antes de executar (alinha com "Suspender").
- Ação "Suspender": seta `suspended_at = NOW()`, insere `subscription_log(action='suspended')`. Efeito imediato (loja trava em próxima checagem do tenant-guard). Confirmação de 1 clique.
- Ação "Liberar suspensão": zera `suspended_at`, insere `subscription_log(action='released')`. Reativa loja sem alterar `valid_until`.
- Histórico de assinatura por loja: modal/expansão com entradas do `subscription_log` (action, valid_until_before, valid_until_after, at).
- Queries do painel rodam via `db` (owner connection, bypassa RLS) — único ponto de acesso cross-tenant, protegido por `requireFounder()`.

### Does NOT Include

- Impersonação (entrar como dono de loja para dar suporte) — adiada para feature posterior.
- Métricas em tempo real (WebSocket/polling) — dados carregados no request; atualização via refresh.
- Edição de dados de cadastro da loja (nome, e-mail, etc.) — fora do escopo de billing.
- Múltiplos usuários com papel admin — apenas o founder único no MVP; `is_founder` é boolean, sem unique constraint no banco em MVP, mas o seed garante que apenas um usuário é marcado. A coluna admite um segundo founder futuramente sem migração.
- Exportação de relatórios (CSV, PDF) — operação não justificada com poucas lojas.
- Notificação automática ao cliente quando travado — comunicação é manual via WhatsApp no MVP.

## Requirements

### Auth / guard

- **RF01:** `requireFounder()` (`lib/auth/admin.ts`): resolve userId da sessão via `getAuthUser()`, lê `users.is_founder` pela conexão owner (`db`), lança `UnauthorizedError` se `false` ou se não autenticado.
- **RF02:** Todo server component e server action de `/superadmin` chama `requireFounder()` antes de qualquer query.
- **RF03:** Tentativa de acesso a `/superadmin` sem `is_founder` redireciona para `/` com mensagem de erro (não expõe que a rota existe).

### Sidebar

- **RF04:** `AppSidebar` recebe prop ou contexto com `isFounder: boolean`; o link "Admin" para `/superadmin` é renderizado condicionalmente apenas quando `isFounder = true`.
- **RF05:** O link "Admin" é posicionado na seção secundária do sidebar (abaixo dos links operacionais), com ícone distinto.

### Dashboard de métricas

- **RF06:** Painel de contagem de lojas por estado (testando / ativa / travada) derivado de `valid_until` e `suspended_at` — consulta cross-tenant via owner connection.
- **RF07:** Lista "vence em 3 dias": tenants onde `valid_until BETWEEN NOW() AND NOW() + INTERVAL '3 days'` e `suspended_at IS NULL`. Ordena por `valid_until` ASC.
- **RF08:** Faturamento do mês: `SUM(sales.total_cents)` por `tenant_id` onde `sales.created_at >= início do mês corrente`. Retorna 0 para lojas sem vendas no mês.
- **RF09:** Último acesso: `MAX(created_at)` das tabelas `sales` e `stock_movements` por tenant (UNION, maior entre os dois). Nulo se loja nunca operou.
- **RNF01:** Dashboard carrega em até 2s para até 200 lojas (queries com índices em `tenant_id` e `created_at`).

### Lista de lojas

- **RF10:** Tabela com colunas: nome, estado (badge colorido), `valid_until` (formatado), faturamento/mês (R$ formatado), último acesso (data ou "nunca"), ações.
- **RF11:** Estados exibidos com cores distintas: testando = azul, ativa = verde, travada = vermelho.
- **RF12:** Ordena por padrão: lojas travadas primeiro, depois por `valid_until` ASC.

### Ação liberar (+30 dias)

- **RF13:** Calcula `new_valid_until = GREATEST(valid_until, NOW()) + INTERVAL '30 days'`.
- **RF14:** Seta `tenants.valid_until = new_valid_until`, zera `tenants.suspended_at = NULL`.
- **RF15:** Insere `subscription_log(tenant_id, action='renewed', valid_until_before=<anterior>, valid_until_after=new_valid_until, by_user_id=<founder_id>, at=NOW())`.
- **RF16:** UI reflete novo estado imediatamente após a ação (revalidação da rota).
- **RF16a:** Dialog de confirmação antes de executar: exibe novo `valid_until` calculado e nome da loja. Alinha com RF19 (Suspender).
- **RN01:** Dias acumulam: se `valid_until` ainda é futuro, os +30 partem desse futuro (não de hoje).

### Ação suspender

- **RF17:** Seta `tenants.suspended_at = NOW()`.
- **RF18:** Insere `subscription_log(action='suspended', by_user_id=<founder_id>, at=NOW())`.
- **RF19:** Confirmação explícita antes de executar (modal ou dialog de confirmação).
- **RN02:** Suspensão manual força `travada` imediatamente — qualquer loja, independente de `valid_until` e independente do estado atual (vale para `testando`, `ativa` ou `travada`). Uso esperado: abuso de trial, inadimplência, solicitação do cliente.

### Ação liberar suspensão

- **RF20:** Zera `tenants.suspended_at = NULL`.
- **RF21:** Insere `subscription_log(action='released', by_user_id=<founder_id>, at=NOW())`.
- **RN03:** Liberar suspensão não altera `valid_until` — se este já venceu, loja volta a ser `travada` por vencimento.

### Histórico por loja

- **RF22:** Modal/expansão exibe entradas do `subscription_log` para o tenant selecionado: ação (badge), valid_until_before, valid_until_after, data/hora. Ordena por `at` DESC.

## Decisions

| Decisão | Rationale | Alternativa rejeitada |
|---|---|---|
| Queries via `db` (owner connection) | Único ponto que vê todos os tenants sem filtro RLS; protegido por `requireFounder()` | Criar role `app_admin` no Postgres com policies: mais peças pra manter, sem ganho de segurança real |
| `requireFounder()` em `lib/auth/admin.ts` | Separação clara de responsabilidade: admin guard ≠ auth de loja | Adicionar param ao `requireAuthContext()`: mistura os dois contextos |
| Faturamento = SUM(sales) do mês corrente | Dado já existente em 0002F; sem nova infra | Tabela de revenue pré-computada: complexidade sem necessidade no MVP |
| Último acesso = MAX(created_at) de sales/stock | Sinal de uso real (operação) sem precisar de tabela de eventos | Coluna `last_seen_at` em tenants: mantida manualmente, risco de dessincronia |
| Acumulação de dias (+30 sobre valid_until) | Justo com quem paga adiantado; evita "roubar" dias | +30 a partir de hoje: penaliza pontualidade |

## Success Metrics

| Métrica | Target | Fonte |
|---|---|---|
| Tempo de resposta do dashboard (P95) | < 2s | Logs de request Next.js |
| Ações de liberar/suspender executadas sem erro | ≥ 99% | `subscription_log` count vs. tentativas |
| Lojas travadas que recebem liberação (`action='renewed'`) em até 48h após a data em que ficaram travadas | ≥ 80% | `subscription_log`: diff entre `at` de `suspended/expired` e `at` de `renewed` seguinte |

## References

- {{doc:BRN-super-admin-e-planos}} — brainstorm origem (visão do painel, métricas, fluxo de liberação)
- [SF01 about.md](../SF01-assinatura-lifecycle/about.md) — prerequisite; colunas e tabelas consumidas aqui
- [components/layout/AppSidebar.tsx](../../../../../../components/layout/AppSidebar.tsx) — ponto de inserção do link "Admin"
- [lib/auth.ts](../../../../../../lib/auth.ts) — `requireAuthContext` como referência de padrão para `requireFounder()`
- [db/rls.ts](../../../../../../db/rls.ts) — `withUserRls`; o painel usa `db` direto (sem RLS) em vez desta função
- [lib/services/tenants/onboarding.ts](../../../../../../lib/services/tenants/onboarding.ts) — exemplo de uso de `db` direct (owner connection)
