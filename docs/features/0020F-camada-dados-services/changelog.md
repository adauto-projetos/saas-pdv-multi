---
id: CHG0021
type: changelog
date: 2026-06-29
related: [0020F, 0011F, 0014F, 0019H]
---

# CHG0021 — Feature 0020F: Camada de Dados & Services (Unidade 2)

## TL;DR

Fecha a Unidade 2 da remediação da auditoria ({{doc:0020F}}): 5 achados P2/P3 na camada de dados/services, sem mudança visível ao lojista. A persistência do super-admin sai da action e vai para uma camada `*-data.ts`/`*-service.ts` formal (RF01); o N+1 de `listOperators` cai para ≤2 queries via busca de permissões em lote (RF02); `override_log` ganha índice composto `(tenant_id, created_at, action_code)` para a query de auditoria (RNF01); a estratégia push-only é oficializada (migration `0000` stale removida, `db:migrate` aposentado, documentada no CLAUDE.md — RN01/RN02); e nasce uma suite única de regressão de isolamento `tenant_id` parametrizada sobre as 19 tabelas com a coluna (RF03/RN03). Sem breaking changes.

## Changes

- refactor(admin): persistência do super-admin extraída para `lib/services/admin/admin-data.ts` + `tenant-admin-service.ts`; `app/(admin)/superadmin/actions.ts` não importa mais Drizzle/schema (UI → service → data restaurado) — {{doc:0020F}}
- fix(admin): read+write atômicos nas 3 tx do super-admin (`releaseSubscription`/`suspendTenant`/`releaseFromSuspension`) — `selectTenantById` movido para dentro de `db.transaction` e passa a aceitar `exec`/`tx`, fechando a janela TOCTOU no snapshot `validUntilBefore` do log de auditoria — {{doc:0020F}}
- perf(users): `listOperators` carrega permissões em lote via nova `selectPermissionsByUserIds(tenantId, userIds[])` em `permission-data.ts` (retorna `Map<userId, PermissionCode[]>`) — ≤2 queries independente do nº de operadores, eliminando o 1+N — {{doc:0020F}}
- perf(audit): índice composto `(tenant_id, created_at, action_code)` em `override_log` (`db/schema/override-log.ts`) — query da tela de auditoria passa a usar Index Scan (sem Seq Scan) — {{doc:0020F}}
- chore(db): estratégia push-only oficializada — migration stale `0000_perfect_mikhail_rasputin.sql` removida, script `db:migrate` aposentado do `package.json`, `db:setup` (push + rls) documentado como canônico no CLAUDE.md; `*_rls.sql` preservados — {{doc:0020F}}
- test(db): nova suite `db/__tests__/tenant-isolation-regression.test.ts` parametrizada sobre as 19 tabelas com `tenant_id` — valida leitura e escrita cross-tenant bloqueadas sob `app_user`; guard `iso-RN03-allpresent` (schema-derived) trava qualquer tabela futura sem RLS — {{doc:0020F}}
- test(db): `override-log-index.test.ts` (EXPLAIN confirma Index Scan) e `migration-strategy.test.ts` (push-only); `actions-no-drizzle.test.ts` (0 imports db/schema/drizzle nas actions) — {{doc:0020F}}

## Breaking

none — refatoração estrutural interna. O painel super-admin tem comportamento e UI idênticos (padrão owner-bypass-connection de {{doc:0011F}} preservado, coberto por RNF02); `OperatorDto[]` inalterado. A migration `0000` jamais rodou em prod (deploy sempre usou push-only via `db:setup`), então sua remoção não afeta nenhum banco existente.

## Migration

Nenhuma migração de dados ou de API. O índice de `override_log` entra pelo fluxo normal de schema:

1. Deploy aplica o schema via `db:setup` (`drizzle-kit push --force` + `db:rls`) — o índice composto é criado pelo push.
2. Não rodar `db:migrate` (script removido); push-only é a fonte da verdade.
3. Rollback: reverter o commit da feature restaura `actions.ts`, o índice e os scripts anteriores; nenhum estado de dados é alterado.

## Quick Ref

```json
{
  "id": "F0020",
  "domain": "data-layer-services",
  "touched": [
    "app/(admin)/superadmin/",
    "lib/services/admin/",
    "lib/services/users/",
    "lib/services/permissions/",
    "lib/services/audit/",
    "lib/services/subscriptions/",
    "db/schema/",
    "db/__tests__/"
  ],
  "patterns": [
    "service-data-split",
    "batch-query-anti-n+1",
    "transaction-atomicity-toctou-fix",
    "composite-index",
    "push-only-schema-strategy",
    "parameterized-rls-regression-contract"
  ],
  "keywords": [
    "super-admin",
    "RLS",
    "tenant-isolation",
    "override_log-index",
    "N+1",
    "push-only",
    "multi-tenant"
  ]
}
```
