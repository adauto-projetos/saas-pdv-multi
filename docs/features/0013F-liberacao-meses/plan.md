---
id: 0013F
type: feature-plan
created: 2026-06-25
updated: 2026-06-25
related: [[0013F]]
---

# Plan: 0013F — Liberação Flexível de Meses

## TL;DR

Plano técnico para parametrizar a liberação de assinatura do super admin (extensão da {{doc:0011F}}): o founder digita **N meses de calendário (1–24)** num campo livre do diálogo, vê a nova validade ao vivo e confirma numa única ação. Decisões-chave: cálculo por **meses de calendário** num utilitário puro compartilhado (`lib/format/calendar-month.ts`) que mata a duplicação action↔diálogo apontada no discovery; uma coluna nova `months_released` (nullable) no `subscription_log` para a auditoria (RF05); validação RN01 em duas camadas (zod no cliente e no servidor). Cobrança segue manual — nada de gateway nem liberação em lote.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Test Specification](#test-specification)
- [Database](#database)
- [Backend](#backend)
- [Frontend](#frontend)
- [Risks](#risks)
- [Requirements Coverage](#requirements-coverage)
- [Main Flow](#main-flow)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Context

Hoje a liberação soma um bloco fixo de +30 dias por clique (`actions.ts:30`), exigindo 12 cliques para dar 1 ano e arriscando erro de contagem. Este plano adiciona um parâmetro de quantidade: campo numérico no diálogo, soma em meses de calendário, e auditoria do número de meses liberados — sem tocar no modelo de status (derivado de `validUntil`/`suspendedAt`), na auth (`requireFounder`) nem na cobrança (manual via WhatsApp/PIX).

## Architecture Decisions

| Decisão | Rationale | Alternativa rejeitada | Constraint que obriga |
|---|---|---|---|
| Cálculo por **meses de calendário** em util puro isomórfico `lib/format/calendar-month.ts` | Soma `+30 dias` erra meses reais (fev, meses de 31); um único util evita o drift de ter o cálculo no action e no diálogo | Manter `base + 30*24*60*60*1000` duplicado em action + componente | RN02 (meses de calendário, ajuste fim-de-mês); discovery flagou a duplicação |
| Auditar via coluna nova `months_released` (integer, **nullable**) | `validUntilAfter`/`byUserId` já cobrem parte da RF05; só falta a quantidade. Nullable não quebra linhas existentes nem outras actions | Novo `action` label (`released_custom_months`) ou jsonb de metadata | RF05; CHECK de `action` é fechado e `subscription_log` é append-only |
| **Apenas campo livre** (sem botões 1/3/6/12) | Um número cobre qualquer combinação sem engessar períodos | Botões fixos ou híbrido botões+campo | Decisão explícita do founder no brainstorm (about.md Scope) |
| Revalidar RN01 (1–24) no **servidor** com zod, além do cliente | Cliente é conveniência; servidor é a última linha contra valor fora do range chegar ao banco | Confiar só no `min`/`max` do `<input>` (burlável digitando) | RN01 + métrica "0 liberações fora do range no banco" |
| Range **1–24** meses | Teto de 2 anos cobre o caso real (anual) sem liberar décadas por engano | 1–60 (assumido no discovery, agora obsoleto) | RN01 (about.md sobrepõe o discovery) |

---

## Test Specification

Source: about.md (RF01–RF05, RN01–RN03, RNF01) + plan-{database,backend,frontend}.
Vitest; convenções de `lib/validation/comanda.test.ts` (zod puro) e `app/(admin)/superadmin/actions.test.ts` (`// @vitest-environment node`, `HAS_DB ? describe : describe.skip`, mocks de `getAuthUser`/`next/cache`). Utils puros sem DB; T59–T65 exigem `DATABASE_URL` (pulam sem ele).

### Contract Tests (from RFs/RNs)
| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T49 | soma simples avança mesmo dia | backend | RN02 | (2026-01-15, 2) | 2026-03-15 | dia/mês/ano iguais |
| T50 | overflow fim-de-mês clampa | backend | RN02 | (2026-01-31, 1) | 2026-02-28 | dia = último de fev |
| T51 | overflow ano bissexto | backend | RN02 | (2024-01-31, 1) | 2024-02-29 | clampa p/ 29 |
| T52 | virada de ano | backend | RN02 | (2025-11-30, 3) | 2026-02-28 | ano+1, clamp |
| T53 | preserva hora/minuto da base | backend | RN02 | base c/ 10:30 +1 | mesma hora 10:30 | horário inalterado |
| T54 | meses=0 rejeitado | backend | RN01 | {months:0} | success=false | safeParse falha |
| T55 | meses=1 aceito (mín) | backend | RN01 | {months:1} | success=true | boundary baixo ok |
| T56 | meses=24 aceito (máx) | backend | RN01 | {months:24} | success=true | boundary alto ok |
| T57 | meses=25 rejeitado | backend | RN01 | {months:25} | success=false | acima do teto |
| T58 | não-inteiro/Infinity/neg rejeitado | backend | RN01 | {1.5},{Infinity},{-3} | success=false | .int()/.finite()/.min |
| T59 | valid_until futuro: base=validUntil | backend | RF03/RN03 | future +2mo | addCalendarMonths(future,2) | newValidUntil ≈ esperado (DB) |
| T60 | loja vencida: base=hoje | backend | RF03/RN03 | past +1mo | addCalendarMonths(now,1) | ignora tempo vencido (DB) |
| T61 | destrava loja suspensa | backend | RF04 | suspendedAt set, release | suspendedAt=null | tenant ativo (DB) |
| T62 | log grava months_released | backend | RF05 | release months=3 | row action=renewed, monthsReleased=3 | persiste meses+byUserId (DB) |
| T63 | log grava validade resultante | backend | RF05 | release | validUntilAfter = newValidUntil | snapshot correto (DB) |
| T64 | months inválido revalidado no servidor | backend | RN01 | months=99 | ok=false antes do try | defesa-em-profundidade (DB) |
| T65 | não-founder recebe erro | backend | RNF01 | isFounder=false | ok=false | acesso negado (DB) |
| T66 | input default pré-preenchido 1 | frontend | RF01 | render dialog | input value=1 | estado inicial (RTL) |
| T67 | preview ao vivo recalcula | frontend | RF02 | digita 6 | nova validade=base+6mo | usa addCalendarMonths (RTL) |
| T68 | fora do range desabilita confirmar | frontend | RN01 | digita 0 ou 25 | confirm disabled + msg pt-BR | não dispara action (RTL) |

### Test File Mapping
| Area | Test File | Test IDs |
|------|-----------|----------|
| backend (util puro) | `lib/format/calendar-month.test.ts` | T49–T53 |
| backend (zod puro) | `lib/validation/subscription.test.ts` | T54–T58 |
| backend (integração, DB) | `app/(admin)/superadmin/actions.test.ts` (estende) | T59–T65 |
| frontend (componente) | `components/admin/release-dialog.test.tsx` | T66–T68 |

> Notas: T59–T65 exigem `DATABASE_URL` (pulam sem ele). T49–T58 são puros, sempre rodam e cobrem o núcleo (RN01/RN02/RN03) sem DB nem RTL. T66–T68 exigem `jsdom`+Testing Library — se o projeto não tiver setup RTL, são infra nova (alternativa: testar `isValid` como util puro). T24/T25 atuais chamam `releaseSubscriptionAction(tenantId)` sem `months`; ajustar para `(tenantId, 1)` ao adicionar o 2º parâmetro.

---

## Database

### Entities
| Entity | Table | Key Fields | Reference |
|--------|-------|------------|-----------|
| Subscription Log | `subscription_log` | `id`, `tenant_id`, `action`, `valid_until_before`, `valid_until_after`, `by_user_id`, `months_released`, `at` | `db/schema/subscriptions.ts` |

### Migration
- ADD COLUMN (nullable): `subscription_log.months_released` — `integer`, NULL permitido (linhas existentes e actions não-release não têm meses; só `action='renewed'` da 0013F preenchem).
- Sem mudança no CHECK `subscription_log_action_valid` — `months_released` é ortogonal ao conjunto de `action`.
- Sem novos índices — `months_released` nunca é filtro; leituras já servidas por `tenant_at_idx`/`tenant_action_idx`.
- RLS: após `db:push`, rodar `npm run db:rls` (ou `npm run db:setup`) — `db:push` derruba as policies (CLAUDE.md).

### Repository
| Method | Purpose |
|--------|---------|
| `insertSubscriptionLog` | Estende o `data` aceito para incluir `monthsReleased` opcional; demais chamadores não afetados (campo nullable). `lib/services/subscriptions/repository.ts` |

---

## Backend

### Server Actions / Contracts
| Action | Input | Output | Guard | Purpose |
|--------|-------|--------|-------|---------|
| `releaseSubscriptionAction` | `tenantId: string`, `months: number` | `ActionResult<{ newValidUntil: Date }>` | `requireFounder()` (RNF01) | Avança validade N meses de calendário e destrava (RF03/RF04) |

Mudanças em `app/(admin)/superadmin/actions.ts` (atual L18-52):
- 2º parâmetro `months`. 1º passo do corpo: `releaseMonthsSchema.safeParse({ months })` → falha retorna `{ ok:false, error }` antes do try (padrão `app/(app)/comandas/actions.ts:41-44`). Revalida RN01 no servidor (defesa em profundidade).
- Remove `base.getTime() + 30*24*60*60*1000` (L30); chama `addCalendarMonths(base, parsed.data.months)` (RN02). Base segue `max(validUntil, now)` (RN03), L28-29 preservada.
- Transação `db.transaction` (update tenants `{ validUntil, suspendedAt:null }` + insert log) preservada. `insertSubscriptionLog` recebe `monthsReleased`; `action` permanece `"renewed"` (RF05).

### Validation (zod)
| Schema | File | Fields | Rules |
|--------|------|--------|-------|
| `releaseMonthsSchema` | `lib/validation/subscription.ts` (novo) | `months: number` | `.int().finite().min(1).max(24)` (RN01); mensagens pt-BR (padrão `lib/validation/comanda.ts`); exporta `ReleaseMonthsInput` p/ o cliente |

### Shared Utilities
| Util | File | Signature | Purpose / Rules |
|------|------|-----------|-----------------|
| `addCalendarMonths` | `lib/format/calendar-month.ts` (novo) | `(base: Date, months: number) => Date` | Soma N meses de calendário; clampa overflow de fim-de-mês (Jan 31 +1 → Fev 28/29) (RN02). Pura, isomórfica (sem `"use server"`), importável pelo diálogo cliente. Path junto de `money.ts`/`percent.ts`. |

### Files Touched
- `lib/format/calendar-month.ts` (novo) · `lib/validation/subscription.ts` (novo)
- `lib/services/subscriptions/repository.ts` (mod — amplia `data` de `insertSubscriptionLog`)
- `app/(admin)/superadmin/actions.ts` (mod — assinatura + safeParse + `addCalendarMonths` + `monthsReleased`)
- `db/schema/subscriptions.ts` (mod — coluna `months_released`)

Reference: `app/(app)/comandas/actions.ts:38-54`, `lib/validation/comanda.ts`, `lib/format/money.ts`, `lib/services/subscriptions/repository.ts:31-39`.

---

## Frontend

### Components (modified)
| Component | File | Change |
|-----------|------|--------|
| `ReleaseDialog` | `components/admin/release-dialog.tsx` | Input numérico (default `1`); remove `calcNewValidUntil` local; preview ao vivo via util compartilhado; guard RN01 desabilita confirmar |
| `TenantTable` | `components/admin/tenant-table.tsx` | Copy "+30 dias"→"Liberar meses"; `handleRelease(tenantId, months)`; passa `months` do `onConfirm` |

### State & Handlers
{"months (useState<number>)":{"file":"release-dialog.tsx","purpose":"input controlado, default 1 (RF01)"},"isValid (derivado)":{"file":"release-dialog.tsx","purpose":"Number.isInteger && 1–24; gate do confirm + msg inline (RN01)"},"newValidUntil (derivado)":{"file":"release-dialog.tsx","purpose":"addCalendarMonths(base, months) por render (RF02/RN02/RN03)"},"handleRelease":{"file":"tenant-table.tsx","purpose":"captura months e chama releaseSubscriptionAction(tenantId, months)"}}

### Shared imports / Types (mirror backend)
| Import | From | Use |
|--------|------|-----|
| `addCalendarMonths` | `lib/format/calendar-month.ts` | preview base=max(validUntil,now)+N (RN02/RN03) |
| `ReleaseMonthsInput` | `lib/validation/subscription.ts` | tipa `months` espelhando o backend |

> `onConfirm` muda `() => void` → `(months: number) => void` (precedente `components/admin/delete-store-dialog.tsx`). Base do preview reusa `validUntil>now ? validUntil : now`; só o passo `+30d` vira `addCalendarMonths`. `min/max/step` no input são dica de UX — o guard real é `isValid` (number input aceita digitação fora do range). `formatDate` e o box verde de preview permanecem.

---

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| Preview cliente difere do servidor por timezone | Baixa | Baixo | Mostrar a data retornada pelo servidor após confirmar; util compartilhado garante mesma lógica |
| `<input type=number>` aceita valor fora de 1–24 digitado | Média | Baixo | Guard derivado `isValid` bloqueia confirmar; servidor revalida (RN01) |
| `db:push` derruba RLS policies | Média | Alto | Rodar `npm run db:rls` / `npm run db:setup` após push (CLAUDE.md) |
| T24/T25 quebram com nova assinatura | Alta | Baixo | Atualizar chamadas para `(tenantId, 1)` na mesma task do backend |
| Setup RTL inexistente p/ T66–T68 | Média | Baixo | Núcleo coberto por T49–T58 (puros); RTL opcional ou testar `isValid` puro |

## Requirements Coverage

| ID | Requirement | Covered? | Area | Tasks |
|----|-------------|----------|------|-------|
| RF01 | Campo numérico de meses, default 1 | YES | Frontend | T66 |
| RF02 | Preview da nova validade ao vivo | YES | Frontend | T67 |
| RF03 | Avança N meses de calendário | YES | Backend | T59, T60 |
| RF04 | Liberação destrava loja suspensa | YES | Backend | T61 |
| RF05 | Registra meses + validade + autor | YES | Database + Backend | T62, T63 |
| RN01 | Inteiro 1–24, valida cliente + servidor | YES | Backend + Frontend | T54–T58, T64, T68 |
| RN02 | Meses de calendário + ajuste fim-de-mês | YES | Backend | T49–T53 |
| RN03 | Base = max(validUntil, hoje) | YES | Backend | T59, T60 |
| RNF01 | Restrito ao founder | YES | Backend | T65 |

**Coverage: 100%** (RF01–RF05, RN01–RN03, RNF01 todos mapeados a ≥1 task).

## Main Flow

1. Founder clica **"Liberar meses"** numa loja (`tenant-table.tsx`) → abre `ReleaseDialog`.
2. Diálogo mostra input pré-preenchido com `1`; founder digita N → preview recalcula `addCalendarMonths(max(validUntil,hoje), N)` ao vivo (RF01/RF02).
3. `isValid` (1–24 inteiro) habilita **Confirmar**; fora do range → desabilita + msg pt-BR (RN01).
4. Confirmar → `handleRelease(tenantId, N)` → `releaseSubscriptionAction(tenantId, N)`.
5. Action: `requireFounder` → `safeParse` (RN01) → `addCalendarMonths` (RN02/RN03) → `db.transaction`: update `tenants` (validUntil, suspendedAt:null, RF03/RF04) + `insertSubscriptionLog` (action=renewed, monthsReleased=N, RF05) → `revalidatePath`.

## Implementation Order

1. **Database** — coluna `months_released` + `npm run db:setup` (re-aplica RLS).
2. **Backend** — `addCalendarMonths`, `releaseMonthsSchema`, `insertSubscriptionLog` (tipo), `releaseSubscriptionAction` (assinatura + safeParse + util), ajustar T24/T25.
3. **Frontend** — `ReleaseDialog` (input + preview + guard), `tenant-table` (copy + wiring).
4. **Tests** — T49–T58 (puros), T59–T65 (DB), T66–T68 (RTL/opcional).

## Quick Reference

| Pattern | Codebase search |
|---|---|
| Server action + safeParse | `app/(app)/comandas/actions.ts:38-54` |
| Zod pt-BR | `lib/validation/comanda.ts` |
| Util puro isomórfico | `lib/format/money.ts`, `lib/format/percent.ts` |
| Repository / log insert | `lib/services/subscriptions/repository.ts:31-39` |
| Dialog devolve valor via onConfirm | `components/admin/delete-store-dialog.tsx` |
| Trigger + estado do diálogo | `components/admin/tenant-table.tsx` |
| Action test (node + HAS_DB) | `app/(admin)/superadmin/actions.test.ts` |
