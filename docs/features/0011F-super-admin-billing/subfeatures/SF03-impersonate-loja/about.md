---
id: 0011F
type: feature-about
slug: sf03-impersonate-loja
status: draft
created: 2026-06-23
updated: 2026-06-23
related: [BRN-super-admin-e-planos]
---

## TL;DR

Impersonação: o super admin (founder) "entra" em qualquer loja a partir do painel `/superadmin` e passa a operar o app **com acesso total (leitura e escrita)** como se fosse o dono daquela loja — para dar suporte, corrigir cadastros e diagnosticar problemas. Reverte a decisão "Impersonação adiada" do epic. Depende de SF01 (`is_founder`) e SF02 (painel `/superadmin`).

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Requirements](#requirements)
- [Decisions](#decisions)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

O super admin enxerga o estado de todas as lojas no painel (SF02), mas não consegue **agir dentro** de uma loja para investigar ou corrigir um problema. Hoje o isolamento RLS impede qualquer acesso a dados de uma loja da qual o usuário não é membro — inclusive para o founder. Para dar suporte ("seu produto está com preço errado", "a venda não fechou"), o founder teria de pedir credenciais do cliente ou mexer direto no banco via SSH/psql.

- A RLS (`tenant_isolation`) filtra todo dado por `tenant_members.user_id = current_app_user()`; o founder não é membro de nenhuma loja (conta dedicada, sem tenant próprio).
- Sem impersonação, suporte = acesso direto ao banco (alto risco, sem auditoria) ou pedir a senha do cliente (inaceitável).
- **Sinal observável:** todo diagnóstico de problema de loja exige hoje query manual no Postgres de produção.

## Users

| Role | Objetivo com esta feature | Dor atual |
|---|---|---|
| Founder / super admin | Entrar numa loja específica e operar o app com os dados dela para dar suporte/corrigir | Não tem como ver/editar dados de uma loja pelo app; só via banco direto |

## Scope

### Includes

- Botão "Entrar na loja" em cada linha do painel `/superadmin` (na tabela de lojas).
- `enterStoreAction(tenantId)`: valida `requireFounder()`, confirma que o tenant existe, grava cookie de impersonação assinado/httpOnly e redireciona para o app (`/caixa`).
- `exitStoreAction()`: limpa o cookie de impersonação e volta para `/superadmin`.
- Cookie de impersonação (`pdv_impersonate`): httpOnly, guarda o `tenant_id` da loja "vestida". Só tem efeito para usuários `is_founder`.
- Barra fixa de impersonação no topo do app (todas as rotas `(app)`): "Você está dentro da loja **X** como super admin" + botão "Sair da loja". Cor de destaque (âmbar) para deixar claro que não é a operação normal.
- Camada RLS: função SQL `current_app_tenants()` centraliza os tenants acessíveis pela sessão — memberships normais **+** (se founder e impersonando) o tenant impersonado. Todas as políticas `tenant_isolation` (16 tabelas) e as políticas de `tenants` passam a usar essa função.
- Função SQL `current_app_is_founder()`: lê `users.is_founder` do usuário da sessão; gate de segurança no banco (defesa em profundidade — mesmo que o cookie fosse forjado, um não-founder nunca ganha acesso).
- `withUserRls` injeta a GUC `app.impersonate_tenant_id` na transação quando há cookie de impersonação válido (founder).
- `requireAuthContext` resolve o `tenantId` impersonado para founders sem loja própria — assim todas as actions de escrita existentes funcionam dentro da loja impersonada **sem alteração nos call sites**.
- Acesso **total** (RF: leitura e escrita) — o founder age como dono: criar/editar produtos, registrar/estornar vendas, ajustar estoque, etc.

### Does NOT Include

- Trilha de auditoria por ação dentro da impersonação (log de cada mutação feita pelo founder) — fora do MVP; o cookie identifica a sessão, mas não registramos cada escrita. (Anotado como risco — ver Decisions.)
- Impersonação somente-leitura (modo "view") — escolhido acesso total; um toggle leitura/escrita fica para depois.
- Impersonar **usuário específico** dentro da loja — impersona-se a **loja** (tenant), agindo como o papel owner.
- Limite de tempo/expiração curta do cookie de impersonação — segue o tempo de sessão; sair é manual.
- Banner/registro visível ao dono da loja de que o founder entrou — transparência ao cliente fica para depois.

## Requirements

### Sessão / cookie

- **RF01:** Cookie `pdv_impersonate` httpOnly + `sameSite=lax`, guarda o `tenant_id` impersonado. Lido server-side; nunca exposto ao cliente JS.
- **RF02:** `getImpersonatedTenantId()` retorna o `tenant_id` do cookie ou `null`; é seguro fora de contexto de request (try/catch → `null`) para não quebrar testes/uso fora de request.
- **RN01:** O cookie só produz efeito se o usuário da sessão for `is_founder`. Um não-founder com o cookie setado é ignorado tanto na app (resolução) quanto no banco (gate SQL).

### Entrar / sair

- **RF03:** `enterStoreAction(tenantId)`: chama `requireFounder()`; valida que o tenant existe (owner db); grava o cookie; redireciona para `/caixa`.
- **RF04:** `exitStoreAction()`: remove o cookie; redireciona para `/superadmin`. Não exige ser founder (sair é sempre permitido).
- **RF05:** Botão "Entrar na loja" em cada linha da tabela do painel `/superadmin`.

### RLS / acesso a dados

- **RF06:** Função `current_app_is_founder()` retorna `true` se `users.is_founder` do `current_app_user()` for verdadeiro; senão `false`.
- **RF07:** Função `current_app_tenants()` retorna o conjunto de `tenant_id`: (a) memberships do usuário via `tenant_members`; **UNION** (b) o valor da GUC `app.impersonate_tenant_id` **somente** se `current_app_is_founder()` for `true`.
- **RF08:** Todas as políticas `tenant_isolation` (products, sales, sale_items, stock_movements, customers, cash_movements, receivables, receivable_payments, payables, payable_payments, cash_sessions, comandas, comanda_items, print_logs, kitchen_order_seqs, subscription_log) passam a usar `tenant_id IN (SELECT current_app_tenants())`.
- **RF09:** As políticas de `tenants` (`tenant_self_read`, `tenant_self_update`) passam a usar `id IN (SELECT current_app_tenants())`.
- **RF10:** `withUserRls` seta `app.impersonate_tenant_id` (via `set_config(..., true)` — escopo de transação) quando há cookie válido de founder.
- **RN02:** A GUC é sempre local à transação (`SET LOCAL`) — nunca vaza entre conexões do pool.
- **RN03:** Gate em profundidade: mesmo que a GUC seja setada para um não-founder, `current_app_tenants()` não inclui o tenant impersonado porque `current_app_is_founder()` é `false`.

### Contexto de auth

- **RF11:** `requireAuthContext()` retorna o `tenantId` impersonado quando o usuário é founder sem loja própria e há cookie de impersonação. Assim as actions de escrita já existentes operam dentro da loja.

### UI dentro da loja

- **RF12:** Barra de impersonação fixa no topo de todas as rotas `(app)` quando há impersonação ativa: nome da loja + "Sair da loja".
- **RF13:** O layout usa o `tenantId` efetivo (impersonado) para resolver estado de assinatura e não redireciona o founder impersonando para `/superadmin`.

## Decisions

| Decisão | Rationale | Alternativa rejeitada |
|---|---|---|
| Centralizar acesso em `current_app_tenants()` | Uma função muda o comportamento de 16+ políticas; futura manutenção num só lugar | Editar cláusula de impersonação inline em cada política: 16 pontos de erro |
| Gate de founder no SQL (`current_app_is_founder()`) | Defesa em profundidade: cookie forjado não basta; o banco recusa | Confiar só na verificação da aplicação |
| `withUserRls` lê o cookie sozinho | Evita tocar 66 call sites de `withUserRls`; impersonação fica transparente | Propagar `impersonatedTenantId` pelo `AuthContext` até cada call site |
| Cookie httpOnly de tenant impersonado | Simples, server-side, sem estado no banco | Coluna `impersonating_tenant_id` em `users`: estado global por usuário, race entre abas |
| Acesso total (leitura + escrita) | Suporte precisa corrigir, não só ver | Somente-leitura: insuficiente para o objetivo declarado |
| Sem log por-mutação no MVP | Custo alto; cookie já identifica a sessão founder | Auditar cada escrita: escopo grande, adiado (risco anotado) |

## Success Metrics

| Métrica | Target | Fonte |
|---|---|---|
| Founder consegue ver/editar dados da loja impersonada | 100% das tabelas de negócio | Testes RLS de integração |
| Não-founder nunca acessa loja via cookie forjado | 0 acessos | Teste RLS negativo (gate SQL) |
| Isolamento preservado: impersonando loja A não vê loja B | 0 vazamentos | Teste RLS de isolamento |

## References

- {{doc:BRN-super-admin-e-planos}} — brainstorm origem
- [SF02 about.md](../SF02-painel-super-admin/about.md) — painel onde mora o botão "Entrar"
- [db/rls.ts](../../../../../../db/rls.ts) — `withUserRls`; ponto de injeção da GUC de impersonação
- [db/migrations/0001_rls.sql](../../../../../../db/migrations/0001_rls.sql) — políticas `tenant_isolation` originais que serão repontadas
- [lib/auth.ts](../../../../../../lib/auth.ts) — `requireAuthContext`; resolução do tenant impersonado
- [lib/auth/admin.ts](../../../../../../lib/auth/admin.ts) — `requireFounder` usado pelas actions de entrar
