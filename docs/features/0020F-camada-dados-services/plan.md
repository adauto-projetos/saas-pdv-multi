---
id: 0020F
type: feature-plan
slug: camada-dados-services
status: planned
created: 2026-06-28
updated: 2026-06-28
related: [0020F, 0011F, 0014F, 0019H, BRN-remediacao-auditoria]
---

# Plan: 0020F — Camada de Dados & Services (Unidade 2 da remediação)

## TL;DR

Plano técnico de {{doc:0020F}} — limpeza estrutural da camada de dados/services, **sem mudança visível ao lojista**. Cinco frentes: (1) mover a persistência do super-admin de `app/(admin)/superadmin/actions.ts` para `lib/services/admin/` (novo `admin-data.ts` + funções transacionais em `tenant-admin-service.ts`), zerando queries Drizzle na action (RF01); (2) oficializar **push-only** — apagar a migration `0000` stale, remover `db:migrate`, documentar no CLAUDE.md (RN01/RN02); (3) índice composto `(tenant_id, created_at, action_code)` em `override_log` via Drizzle schema (RNF01); (4) matar o N+1 de `listOperators` com `selectPermissionsByUserIds` batch → ≤2 queries (RF02); (5) suite única parametrizada `tenant-isolation-regression.test.ts` cobrindo as 18 tabelas com `tenant_id` (RF03/RN03). Refactor: comportamento observável idêntico (RNF02). Owner-bypass-connection de {{doc:0011F}} preservado.

## TOC

- [Overview](#overview)
- [Architecture Decisions](#architecture-decisions)
- [Test Specification](#test-specification)
- [Database](#database)
- [Backend](#backend)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Requirements Coverage](#requirements-coverage)
- [Risks](#risks)
- [Quick Reference](#quick-reference)

## Overview

A Unidade 1 ({{doc:0019H}}) já está na `master`: `verify-prod.ts` valida RLS no boot (runtime). A Unidade 2 ataca os 5 achados P2/P3 da auditoria na camada de dados/services e adiciona a rede de CI/test que falta — a suite de regressão que trava, antes do deploy, qualquer tabela com `tenant_id` sem RLS. Nada novo para o usuário final; tudo é refactor, performance ou qualidade. Reaproveita os padrões `*-data.ts`/`*-service.ts` de {{doc:0014F}}, o owner-bypass-connection de {{doc:0011F}}, e os helpers de `subscriptions/repository.ts`.

## Architecture Decisions

| Decision | Rationale | Alternatives rejected | Triggering constraint |
|---|---|---|---|
| **RN01:** push-only oficial (`db:setup` = `db:push` + `db:rls`) | É o fluxo que já roda em prod desde o dia 1; o snapshot Drizzle é a fonte da verdade | `db:generate` + `db:migrate` versionado — muda o deploy e arrisca baseline conflitar com o banco de prod existente | Estágio do produto (founder solo, beginner) não justifica overhead de migrations coordenadas |
| **RN02:** remover `0000` stale + script `db:migrate` | `0000` nunca foi aplicada (`apply-rls.ts` só lê `*_rls.sql`); manter ambos confunde a fonte da verdade | Arquivar `0000` num diretório morto — ainda gera ambiguidade | Push-only oficial torna ambos código morto |
| **RF01:** camada repository formal p/ super-admin (`admin-data.ts` + service transacional) | O resto do projeto já separa `*-data.ts` de `*-service.ts`; meia-refatoração criaria inconsistência | Mover só a query violadora (linha 143) — deixaria a lógica de tx ainda na action | Architecture Contract: UI → service → data, inviolável |
| **RF01:** reusar helpers de `subscriptions/repository.ts` dentro de `db.transaction` no service | `selectTenantById`/`insertSubscriptionLog`/`updateTenant*` já existem e são owner-bypass; duplicar em `admin-data.ts` viola KISS | Recriar helpers de escrita em `admin-data.ts` | Atomicidade (update + log juntos) sem redundância |
| **RNF01:** índice cobre `action_code` além de `tenant_id`+`created_at` | A auditoria filtra por tipo de ação além de tenant+período; um índice cobre caso principal e secundário | Índice só `(tenant_id, created_at)` — não cobre filtro por ação | Query real em `audit-data.ts:214` |
| **RF02:** `selectPermissionsByUserIds` genérica em `permission-data.ts` | Reutilizável por outros pontos que carregam permissões em lote | Função ad-hoc local em `operator-service.ts` — resolve o N+1 mas não reaproveita | N+1: 1+N queries cresce linear com nº de operadores |
| **RF03/RN03:** suite única parametrizada sobre todas as tabelas com `tenant_id` | Vira contrato de isolamento: tabela nova sem RLS quebra o teste; complementa `verify-prod.ts` (runtime) no nível de CI | Testar só as 17 faltantes em arquivos separados — mantém o padrão espalhado, não cobre tabelas futuras | Cobertura RLS hoje é parcial (11 de ~18 tabelas) |

---

## Test Specification

Parametrized table set (18 business tables w/ `tenant_id`, `tenants` is the root): products, customers, sales, sale_items, comandas, comanda_items, kitchen_order_seqs, print_logs, stock_movements, cash_sessions, cash_movements, receivables, receivable_payments, payables, payable_payments, subscriptions, override_log, user_permissions, tenant_members. (`platform_settings` excluded — global singleton, no `tenant_id`, owner-only.) Each row below marked `[T*]` is replicated per table in the parametrized suite. DB-touching tests skip without `DATABASE_URL` (`HAS_DB`).

### Contract Tests (from RFs/RNs)

| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| iso-RF03-read | `[T*]` userA não lê linha do tenant B | database | RF03/RN03 | `withUserRls(userA, select where id=rowB.id)` | `[]` (linha invisível) | `rows.toHaveLength(0)` |
| iso-RF03-write | `[T*]` userA não escreve linha do tenant B | database | RF03/RN03 | `withUserRls(userA, update set …. where id=rowB.id .returning())` | `[]`; row B intacta | `updated.toHaveLength(0)` + leitura owner mostra valor original |
| iso-RN03-allpresent | Suite cobre 100% das tabelas com `tenant_id` | database | RN03 | lista parametrizada vs. schema (`tenant_id` cols) | sem tabela faltante | contagem testada == contagem com coluna; sem `.skip` órfão |
| iso-RN03-policy-gap | Tabela com `tenant_id` sem policy falha o teste | database | RN03 | tabela hipotética sem RLS | read/write cross-tenant retorna linha | teste vermelho (contrato trava merge) |
| admin-RF01-getname | `getTenantName` retorna nome via service | backend | RF01 | `getTenantName(tenantId)` | `{ name }` ou `null` | service retorna nome correto; action não toca Drizzle |
| admin-RF01-release | `releaseSubscription` renova + loga atômico | backend | RF01 | `releaseSubscription(tenantId, 3, byUser)` | `{ newValidUntil }`; log "renewed" | valid_until = base+3 meses; 1 linha em subscription_log |
| admin-RF01-suspend | `suspendTenant` seta suspended_at + loga | backend | RF01 | `suspendTenant(tenantId, byUser)` | suspended_at=now; log "suspended" | campo setado + log inserido na mesma tx |
| admin-RF01-unsuspend | `releaseFromSuspension` limpa + loga | backend | RF01 | `releaseFromSuspension(tenantId, byUser)` | suspended_at=null; log "released" | campo limpo + log inserido |
| admin-RF01-no-drizzle | Nenhuma action super-admin importa db/schema | backend | RF01 | grep `app/(admin)/superadmin/` | 0 imports de `db`/`tenants`/drizzle | grep retorna vazio (assert estrutural) |
| ops-RF02-batch | `listOperators` usa ≤2 queries | backend | RF02 | seed 10 operadores c/ permissões; `listOperators(ctx)` | `OperatorDto[]` correto | contador de queries ≤ 2 (constante vs. N) |
| ops-RF02-empty | `selectPermissionsByUserIds([])` não vai ao banco | backend | RF02 | `selectPermissionsByUserIds(tid, [])` | `new Map()` | retorna Map vazio; 0 queries |
| ops-RF02-map | Batch mapeia permissões por userId | backend | RF02 | userIds com permissões distintas | `Map<userId, code[]>` correto | cada userId → suas codes; owner → `[]` |
| ops-RF02-parity | Output idêntico ao N+1 anterior | backend | RF02/RNF02 | mesmos dados, antes vs. depois | `OperatorDto[]` igual | permissions por operador inalteradas |
| audit-RNF01-index | Query de auditoria usa Index Scan | database | RNF01 | `EXPLAIN` da query `tenant_id+created_at+action_code` | plano com Index Scan | sem `Seq Scan` no plano |
| audit-RNF01-result | Índice não muda resultado da auditoria | database | RNF01/RNF02 | `selectOverrideLogs(tenant, range)` | mesmas linhas de antes | resultado idêntico (só perf muda) |
| mig-RN01-pushonly | `db:setup` = push + rls é o caminho oficial | database | RN01 | inspeção `package.json`/CLAUDE.md | `db:setup`=`db:push`+`db:rls`; doc presente | scripts existem; CLAUDE.md documenta push-only |
| mig-RN02-no-migrate | `db:migrate` e migration `0000` removidos | database | RN02 | inspeção repo | sem `db:migrate`; sem `0000_*.sql` | grep `db:migrate`=vazio; arquivo ausente; `*_rls.sql` intactos |
| gates-RNF02 | Gates saem exit 0 | backend | RNF02 | `typecheck`/`lint`/`test`/`build` | exit 0 em todos | comportamento observável inalterado |

### Test File Mapping

| Area | Test File | Test IDs |
|------|-----------|----------|
| database | `db/__tests__/tenant-isolation-regression.test.ts` | iso-RF03-read, iso-RF03-write, iso-RN03-allpresent, iso-RN03-policy-gap |
| backend | `lib/services/admin/__tests__/tenant-admin-service.test.ts` | admin-RF01-getname, admin-RF01-release, admin-RF01-suspend, admin-RF01-unsuspend |
| backend | `app/(admin)/superadmin/__tests__/actions-no-drizzle.test.ts` | admin-RF01-no-drizzle |
| backend | `lib/services/users/__tests__/operator-service.test.ts` | ops-RF02-batch, ops-RF02-empty, ops-RF02-map, ops-RF02-parity |
| database | `db/__tests__/override-log-index.test.ts` | audit-RNF01-index, audit-RNF01-result |
| database | `db/__tests__/migration-strategy.test.ts` | mig-RN01-pushonly, mig-RN02-no-migrate |
| backend | validation gates (CI, no file) | gates-RNF02 |

---

## Database

### Entities

| Entity | Table | Key Fields | Reference |
|--------|-------|------------|-----------|
| Override Log (index only) | `override_log` | `tenant_id`, `created_at`, `action_code` | Similar: `db/schema/cash-movements.ts` (composite index `tenant_id + created_at`) |

No new tables. No new columns. Schema change is index-only.

### Migration

**Strategy: push-only (RN01/RN02)**

- **Add composite index** on `override_log`: `index("override_log_tenant_created_action_idx").on(t.tenantId, t.createdAt, t.actionCode)` inside the table callback in `db/schema/override-log.ts`. Applied via `db:push` (no sequential migration file created).
- **Remove stale file**: delete `db/migrations/0000_perfect_mikhail_rasputin.sql` — never ran in prod (push-only since day 1); removal is safe without baseline audit.
- **Deprecate `db:migrate`**: remove the `"db:migrate": "drizzle-kit migrate"` entry from `package.json` (RN02); no deploy path depends on it.
- **Keep all `*_rls.sql` files**: `db/migrations/0001_rls.sql` … `0011_override_rls.sql` are NOT drizzle-kit output — they are RLS policy scripts consumed by `scripts/apply-rls.ts` (scans `*_rls.sql` suffix in sorted order). Untouched.
- **Document push-only in CLAUDE.md**: note in "Validation Gates" / "Banco" that `drizzle-kit push` is the official schema-evolution path; Drizzle snapshot is the source of truth; `db:setup` = push + rls.
- **RLS policy gap (if discovered by regression suite)**: a table with `tenant_id` but no policy → new `db/migrations/NNNN_<table>_rls.sql` following `0011_override_rls.sql`, then `npm run db:rls`. No sequential drizzle-kit migration needed.

Reference (index syntax): `db/schema/cash-movements.ts:74-75`, `db/schema/subscriptions.ts:61-63`. Reference (RLS format): `db/migrations/0011_override_rls.sql`. Reference (apply filter): `scripts/apply-rls.ts`.

### Repository

No new repository methods. `override_log` is append-only; reads go through `lib/services/audit/audit-data.ts:214` (already filters `tenant_id + created_at`). The index makes those existing queries use an index scan — no signature changes.

---

## Backend

This is a REFACTOR. No HTTP endpoints, no UI, no schema changes here (index/migrations live in Database). Entry points are existing server actions; behavior stays identical (RNF02). All admin/permission data access runs on the owner `db` connection (bypasses RLS) — cross-tenant by design — and that **must be preserved** (RNF02 / owner-bypass from {{doc:0011F}}). No `withUserRls` introduced. Monetary values stay in cents (untouched).

### Service Functions (entry: server actions in `superadmin/actions.ts`)
| Function | Layer | Signature (params -> return) | Connection | Purpose |
|----------|-------|------------------------------|------------|---------|
| `releaseSubscription` | service | `(tenantId, months, byUserId) -> Promise<{ newValidUntil: Date }>` | owner-bypass | Renova: calc valid_until + update + log "renewed" numa tx |
| `suspendTenant` | service | `(tenantId, byUserId) -> Promise<void>` | owner-bypass | Seta suspended_at=now + log "suspended" numa tx |
| `releaseFromSuspension` | service | `(tenantId, byUserId) -> Promise<void>` | owner-bypass | Seta suspended_at=null + log "released" numa tx |
| `getTenantName` | service | `(tenantId) -> Promise<{ name: string } \| null>` | owner-bypass | Nome p/ confirmação de exclusão (substitui query inline) |

### Data Layer (`admin-data.ts` + `permission-data.ts`)
| Function | File | Purpose |
|----------|------|---------|
| `selectTenantName(tenantId)` | `lib/services/admin/admin-data.ts` (novo) | PK lookup do nome do tenant (owner db) |
| `selectPermissionsByUserIds(tenantId, userIds)` | `lib/services/permissions/permission-data.ts` (add) | Batch via `inArray`; `userIds=[]` → `new Map()` sem ir ao banco; filtro `tenant_id` sempre explícito |

- `selectPermissionsByUserIds` genérica/reutilizável; aceita `exec: Exec = db` p/ consistência com `selectPermissionCodes` (que permanece — outros chamadores usam).
- Lógica transacional (update tenant + insert log) vive no service, reusando `selectTenantById`/`insertSubscriptionLog`/`updateTenantValidUntil`/`updateTenantSuspendedAt` de `subscriptions/repository.ts` dentro de `db.transaction`. `admin-data.ts` cobre só a leitura nova (`selectTenantName`).

### Actions Refactored (`app/(admin)/superadmin/actions.ts`)
| Action fn | File:line today | Change |
|-----------|-----------------|--------|
| `releaseSubscriptionAction` | actions.ts:25–70 | Após validar `months`, chama `releaseSubscription(...)`; remove `db.transaction`, `addCalendarMonths`, calc de base |
| `suspendTenantAction` | actions.ts:72–104 | Chama `suspendTenant(...)`; remove tx inline e import de `tenants` |
| `releaseFromSuspensionAction` | actions.ts:106–134 | Chama `releaseFromSuspension(...)`; remove tx inline |
| `deleteTenantAction` | actions.ts:136–163 | Troca `db.select(tenants.name)` (143–147) por `getTenantName(...)`; mantém confirmação e `deleteTenantById` |
| (imports) | actions.ts:3–7,21 | Remove `eq`, `db`, `tenants`, `addCalendarMonths`, `insertSubscriptionLog`, `selectTenantById`; mantém `requireFounder`, schemas zod, `toActionError`. Zero import de `db`/schema/drizzle |

`listOperators` (`operator-service.ts:68–88`): substituir `Promise.all(map(... await selectPermissionCodes))` por (1) `selectOperators` + (2) `selectPermissionsByUserIds(ctx.tenantId, nonOwnerIds)`, depois `rows.map(sync)` lendo `permsMap.get(userId) ?? []`. Owner → `[]`. Output `OperatorDto[]` idêntico; ≤2 queries (RF02). Import troca `selectPermissionCodes` → `selectPermissionsByUserIds`.

### Module Structure
```
lib/services/admin/
  tenant-admin-service.ts   (+ suspendTenant, releaseFromSuspension, releaseSubscription, getTenantName)
  admin-data.ts             (NOVO — selectTenantName; padrão *-data.ts de 0014F)
lib/services/permissions/
  permission-data.ts        (+ selectPermissionsByUserIds; selectPermissionCodes mantida)
lib/services/users/
  operator-service.ts       (listOperators refatorado p/ batch)
lib/services/subscriptions/
  repository.ts             (reusado: selectTenantById, insertSubscriptionLog, update* — sem alteração)
```

Reference: `lib/services/users/operator-data.ts` + `audit-data.ts` — padrão `*-data.ts` (SQL/owner db) + `*-service.ts` (regra) de {{doc:0014F}}.

---

## Main Flow

**Refactor super-admin (RF01):**
1. Founder aciona um botão (renovar/suspender/liberar/excluir) no painel super-admin.
2. Server action (`actions.ts`) valida input com schema zod (defesa de borda — permanece).
3. Action → chama o service de `lib/services/admin/` (`releaseSubscription`/`suspendTenant`/`releaseFromSuspension`/`getTenantName`).
4. Service (owner-bypass) abre `db.transaction`, atualiza `tenants` + grava `subscription_log` atomicamente reusando os helpers de `repository.ts`.
5. Action retorna `ActionResult`; UI revalida. Comportamento idêntico ao anterior.

**Batch permissões (RF02):** `listOperators` → `selectOperators` (1 query) → `selectPermissionsByUserIds(nonOwnerIds)` (1 query) → map síncrono → `OperatorDto[]`.

**Índice (RNF01):** schema Drizzle ganha o índice → `db:push` aplica → query de `audit-data.ts` passa a usar Index Scan.

## Implementation Order

1. **Database** — índice em `override-log.ts`; remover `0000`; remover `db:migrate`; documentar push-only no CLAUDE.md.
2. **Backend (RF02)** — `selectPermissionsByUserIds` + refactor `listOperators` (isolado, baixo risco, fecha o N+1).
3. **Backend (RF01)** — `admin-data.ts` (`selectTenantName`) + 4 funções transacionais no `tenant-admin-service.ts` + limpeza de `actions.ts`.
4. **Tests** — suite de regressão parametrizada + testes de contrato por área; se a suite achar tabela sem RLS, criar a policy faltante (`NNNN_<table>_rls.sql` + `db:rls`).
5. **Gates** — `typecheck`/`lint`/`test`/`build` exit 0 (RNF02).

## Requirements Coverage

| ID | Requirement | Covered? | Area | Tasks |
|----|-------------|----------|------|-------|
| RF01 | Acesso a dados super-admin só via `lib/services/admin/` | YES | Backend | admin-data + 4 service fns + actions cleanup |
| RF02 | `listOperators` ≤ 2 queries | YES | Backend | `selectPermissionsByUserIds` + refactor |
| RF03 | Regressão valida isolamento cross-tenant por tabela | YES | Tests | suite parametrizada (18 tabelas) |
| RNF01 | Query de auditoria usa índice (sem Seq Scan) | YES | Database | índice composto `override_log` |
| RNF02 | Sem regressão funcional; gates exit 0 | YES | All | parity tests + gates |
| RN01 | Push-only é a estratégia oficial | YES | Database | doc CLAUDE.md + `db:setup` canônico |
| RN02 | `db:migrate` + migration `0000` removidos | YES | Database | delete `0000` + remove script |
| RN03 | `tenant_id` como fronteira inviolável (contrato de teste) | YES | Tests | iso-RN03-allpresent + policy-gap |

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| Suite de regressão acha tabela sem RLS | Média | Escopo cresce (criar policy) | É o objetivo do contrato; criar `NNNN_<table>_rls.sql` + `db:rls` está em escopo (about.md Includes) |
| Refactor do super-admin perde funcionalidade | Baixa | Founder não gerencia lojas | Testes de contrato p/ as 4 ações + parity; comportamento observável inalterado (RNF02) |
| Índice não basta p/ tenants grandes | Baixa | Auditoria ainda lenta no futuro | `EXPLAIN` valida Index Scan agora; particionamento fica p/ diagnóstico próprio |
| `inArray` com lista vazia falha | Baixa | Erro em loja sem operadores | Short-circuit `userIds=[] → new Map()` testado (ops-RF02-empty) |

## Quick Reference

| Pattern | Codebase search |
|---|---|
| Índice composto Drizzle | `db/schema/cash-movements.ts`, `db/schema/subscriptions.ts` |
| RLS policy migration | `db/migrations/0011_override_rls.sql`, `scripts/apply-rls.ts` |
| `*-data.ts` / `*-service.ts` split | `lib/services/users/operator-data.ts`, `lib/services/audit/audit-data.ts` |
| Owner-bypass connection | `lib/services/subscriptions/repository.ts`, `db/index.ts` |
| Helpers de tenant/subscription | `selectTenantById`, `insertSubscriptionLog`, `updateTenantValidUntil` em `subscriptions/repository.ts` |
| RLS test pattern + helpers | `db/__tests__/products-rls.test.ts`, `db/__tests__/seed.ts` (`withUserRls`, `createTestUser`, `seedTenant`) |
