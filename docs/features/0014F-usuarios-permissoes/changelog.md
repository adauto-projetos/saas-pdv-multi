---
id: CHG0015
type: changelog
date: 2026-06-27
related: [0014F]
---

## TL;DR

Changelog da feature 0014F — operadores com permissões granulares. Introduz o conceito de "operador" (funcionário) no PDV multi-tenant: cadastro/edição/desativação pelo dono, 8 permissões por usuário, login próprio, override de ação sensível com senha de Administrador, limite de operadores por plano e tela de auditoria por operador. Entregue em 4 subfeatures (SF01 núcleo · SF02 override · SF03 limite · SF04 auditoria), revisão PASSED (score 8.75/10, 442 testes verdes). Sem breaking changes para consumidores externos; aplica migrations RLS 0010 e 0011.

## TOC

- [Changes](#changes)
- [Breaking](#breaking)
- [Migration](#migration)
- [Quick Ref](#quick-ref)

## Changes

### SF01 — núcleo (usuários + permissões)

- feat(db): tabela `user_permissions` (1 linha por permissão concedida, RLS por tenant), `users.name`, `tenant_members` papel `operator`, `users.is_active` — {{doc:0014F}}
- feat(db): migration `0010_usuarios_rls.sql` — policies de `user_permissions` por `current_app_tenants()`
- feat(auth): `requirePermission`/`hasPermission`/`requireAnyPermission` em `lib/auth/permissions.ts` — owner implícito, autorização por código de módulo
- feat(users): `operator-service` — criar/editar/desativar operador, definir permissões, presets, reset de senha provisória (bcrypt)
- feat(ui): tela **Usuários** (`/usuarios`) — CRUD de operadores, presets, editar dados (nome/email), editar permissões, reset de senha; **Meu perfil** (`/perfil`) + troca de senha
- feat(ui): menu lateral e `BottomNav` filtrados por permissão; mapa permissão→menu (Caixa→PDV, Financeiro/lucro agrupado, anti-vazamento)
- feat(auth): anti-escalonamento — owner intocável, sem auto-desativar/auto-editar; sessão de operador desativado barrada em `getUserTenantId`
- feat(caixa): operador com permissão Caixa abre/fecha turno no PDV; venda bloqueada sem turno aberto; fechamento às cegas (dinheiro/cartão/pix); nova movimentação (suprimento/sangria); operador pode listar/receber notas a receber (fiado) no balcão
- fix(perms): mapa permissão→menu corrigido para não vazar Lucro/Financeiro a operador sem a permissão

### SF02 — override de ação sensível

- feat(db): tabela `override_log` + migration `0011_override_rls.sql` (RLS por tenant)
- feat(perms): `runWithOverride` — autorizador validado na conexão owner (ativo, mesmo tenant, owner|`gerenciar_usuarios`, ≠ operador solicitante, bcrypt antes de mutar); log gravado só no sucesso
- feat(ui): `OverrideDialog` ligado a cancelar comanda, remover item e fechar caixa

### SF03 — limite de operadores por plano

- feat(db): `platform_settings.max_operators` (gancho de limite por plano, global hoje)
- feat(admin): `max-operators-settings` no painel super admin
- feat(users): gate de contagem + insert na mesma transação com `pg_advisory_xact_lock` por tenant (sem corrida); owner e desativados não contam; grandfather de lojas acima do teto

### SF04 — auditoria de autoria

- feat(audit): `audit-service`/`audit-data` — agregação por operador (vendas, caixas, comandas, movimentações) na conexão owner com filtro `tenant_id` explícito; operador desativado nomeado via LEFT JOIN; owner distinto
- feat(ui): tela **Auditoria** (`/auditoria`) + seção de overrides com degradação graciosa (`to_regclass`); item adicionado à sidebar e ao `BottomNav`

### Correções de revisão (/add.review)

- fix(users): guarda de corrida — unique violation em `users.email` → `ConflictError` legível (createOperator/updateOperator)
- perf(auth): `requireAnyPermission` otimizado para 2 queries (sem N round-trips)
- fix(audit): cast robusto de `created_at` (`instanceof Date`)
- fix(caixa): `session = undefined` (não `null`) quando a action falha — respeita o contrato do `CaixaShell`
- fix(ui): lacuna T16 fechada — formulários inline de editar dados e resetar senha (substitui `window.prompt`)

## Breaking

`none` — feature aditiva. Não altera contratos de API públicos nem assinaturas de actions existentes. Operadores e permissões são novos; lojas existentes seguem com o owner enxergando tudo (owner tem permissão implícita).

## Migration

Aplicada automaticamente no startup (migração automática — ver deploy Hetzner). Para ambiente local:

1. `docker compose up -d` (Postgres no ar).
2. `npm run db:setup` (= `db:push` + `db:rls`) — aplica o schema novo e **reaplica as RLS policies**, incluindo as migrations `0010_usuarios_rls.sql` e `0011_override_rls.sql`.
3. ⚠️ Se rodar `db:push` avulso, rode `npm run db:rls` em seguida (push derruba as policies).
4. Sem dados a backfill: lojas existentes continuam só com o owner; `user_permissions` começa vazia. `platform_settings.max_operators` assume o default do schema (operadores acima do teto são grandfathered).
5. Rollback: reverter as migrations 0010/0011 e o `db:push`; nenhuma coluna de dados de negócio é destruída (`is_active`/`name` são aditivas).

## Quick Ref

```json
{
  "id": "F0014",
  "domain": "usuarios-permissoes",
  "touched": [
    "db/schema/",
    "db/migrations/",
    "lib/auth/",
    "lib/services/users/",
    "lib/services/permissions/",
    "lib/services/audit/",
    "app/(app)/usuarios/",
    "app/(app)/auditoria/",
    "app/(app)/perfil/",
    "components/comandas/",
    "components/admin/"
  ],
  "patterns": [
    "rls-multi-tenant",
    "permission-gate",
    "owner-bypass-connection",
    "advisory-lock-atomic-limit",
    "synchronous-override-with-log"
  ],
  "keywords": [
    "operador",
    "permissoes",
    "override",
    "auditoria",
    "max_operators",
    "anti-escalonamento",
    "RLS"
  ]
}
```
