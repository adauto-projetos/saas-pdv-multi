# Review: 0020F-camada-dados-services

> **Date:** 2026-06-29 | **Branch:** feature/0020F-camada-dados-services
> Reviewed by: /add.review (model: Opus 4.8)

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` — exit 0, 0 errors |
| Spec Compliance | ✅ PASSED | 15/15 acceptance items COMPLIANT; 8/8 RF/RN covered |
| Code Review Score | ✅ PASSED | 9.0/10 (threshold ≥ 7) — após auto-correção da única MEDIUM |
| Product Validation | ✅ PASSED | RF: 3/3 (RF01–RF03), RNF: 2/2, RN: 3/3 |
| Validation Gates | ✅ PASSED | typecheck → exit 0 · lint → exit 0 (8 warnings pré-existentes) · test → exit 0 (525 passed) · build → exit 0 |
| **Overall** | **✅ PASSED** | **Ready for merge** |

## Spec Compliance Audit

| Item | Type | Expected | Found at | Status |
|------|------|----------|----------|--------|
| RF01 | Layering | Actions super-admin sem Drizzle; dados via `lib/services/admin/` | `actions.ts` (0 imports `@/db`/drizzle) + `admin-data.ts:14` + `tenant-admin-service.ts:198,210,249,277` | COMPLIANT |
| RF02 | Batch query | `selectPermissionsByUserIds` + `listOperators` ≤2 queries | `permission-data.ts:40` + `operator-service.ts:72-94` | COMPLIANT |
| RF03 | Test contract | Suite parametrizada read+write cross-tenant por tabela | `tenant-isolation-regression.test.ts` (19 tabelas) | COMPLIANT |
| RNF01 | Index | Índice composto `(tenant_id, created_at, action_code)` | `override-log.ts:42-46` + EXPLAIN test | COMPLIANT |
| RNF02 | No regression | Gates exit 0; `OperatorDto[]` inalterado | parity test + gates verdes | COMPLIANT |
| RN01 | Strategy | Push-only oficial documentado; `db:setup`=push+rls | `package.json:20` + `CLAUDE.md` | COMPLIANT |
| RN02 | Cleanup | `db:migrate` removido; `0000_*.sql` ausente; `*_rls.sql` intactos | `package.json` (sem db:migrate) + 11 `*_rls.sql` preservados | COMPLIANT |
| RN03 | Inviolable | `allpresent` schema-derived trava tabela futura sem RLS | `tenant-isolation-regression.test.ts:625-665` | COMPLIANT |

**SPEC_AUDIT_STATUS: COMPLIANT** — 15/15 itens da Acceptance Checklist, 0 STALE_TICK, 0 RF/RN descobertos.

## Code Review Summary

Reviewer: Backend (read-only). 13 arquivos-fonte + docs + package.json + CLAUDE.md.

**Segurança (PASS):** toda query owner-bypass filtra `tenant_id` explicitamente; sem injeção (Drizzle builder + `sql` parametrizado); `requireFounder()` em todas as 7 actions; sem log de dado sensível; sem `any` em código de produção.

### Findings e auto-correções

| Severidade | Finding | Status |
|---|---|---|
| MEDIUM | TOCTOU: `selectTenantById` rodava FORA da transação em `releaseSubscription`/`suspendTenant`/`releaseFromSuspension` → snapshot `validUntilBefore` do log de auditoria podia ficar desatualizado sob escrita concorrente | ✅ CORRIGIDO — read movido para dentro de `db.transaction`; `selectTenantById` agora aceita `exec`/`tx` (padrão `exec = db` do codebase). Read+write atômicos. |
| LOW | Comentário auto-contraditório (18 vs 19 tabelas) no header da suite de regressão | ✅ CORRIGIDO — comentário alinhado a 19; nota que `iso-RN03-allpresent` (schema-derived) é a fonte autoritativa |
| LOW | `ops-RF02-batch` semeava 5 operadores (spec pede 10) | ✅ CORRIGIDO — bump para 10 (+ owner = 11); reforça a prova anti-N+1 |
| LOW | `getTenantName` é proxy fino sobre `selectTenantName` | ACEITO — segue o split `*-service.ts`/`*-data.ts` de 0014F; sem ação |
| LOW | `db:generate` ainda presente no `package.json` | ACEITO — fora de escopo (RN02 só exige remover `db:migrate`); inócuo |
| LOW | Dívida pré-existente: `tenant-admin-service.ts` ainda contém data-layer fns de 0011F (`listAllTenantsWithStats` etc.) | ACEITO — pré-data 0020F; não é regressão desta feature |

**Arquivos modificados na review (4):**
- `lib/services/admin/tenant-admin-service.ts`
- `lib/services/subscriptions/repository.ts`
- `db/__tests__/tenant-isolation-regression.test.ts`
- `lib/services/users/__tests__/operator-service.test.ts`

## Product Validation

| ID | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| RF01 | Acesso a dados super-admin só via `lib/services/admin/` | ✅ PASS | grep + `actions-no-drizzle.test.ts` (0 imports db/schema/drizzle) |
| RF02 | `listOperators` ≤ 2 queries | ✅ PASS | `operator-service.ts:73,78` (1 select + 1 batch); short-circuit `[]` |
| RF03 | Regressão valida isolamento cross-tenant por tabela | ✅ PASS | 19 tabelas; read+write bloqueados sob `app_user` |
| RNF01 | Auditoria usa Index Scan (sem Seq Scan) | ✅ PASS | índice composto + EXPLAIN test |
| RNF02 | Sem regressão funcional; gates exit 0 | ✅ PASS | parity test + 4 gates verdes |
| RN01 | Push-only oficial | ✅ PASS | `db:setup`=push+rls; CLAUDE.md |
| RN02 | `db:migrate` + `0000` removidos | ✅ PASS | sem db:migrate; `0000` ausente; `*_rls.sql` intactos |
| RN03 | `tenant_id` inviolável (contrato de teste) | ✅ PASS | `allpresent` schema-derived |

**Product Status: PASSED**

---

> Pré-requisitos: a suite de regressão NÃO descobriu tabela com `tenant_id` sem policy — todas as 19 já têm RLS. Nenhuma policy nova foi necessária nesta unidade.
