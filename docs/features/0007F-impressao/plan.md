---
id: 0007F
type: feature-plan
slug: impressao
status: planned
created: 2026-06-14
updated: 2026-06-16
related: [0007F, 0006F, 0002F]
---

## TL;DR

Integra impressora térmica USB ao PDV: pedido de cozinha em `addComandaItem` e cupom simples em `closeComanda`/`finalizeSale`. Print é side-effect fora da tx de banco (RN04) — falha não bloqueia venda. Sequential kitchen order number via atomic upsert. 2 novas tabelas, 1 novo serviço, 3 pontos de integração, 30 testes.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Test Specification](#test-specification)
- [Database](#database)
- [Backend](#backend)
- [Frontend](#frontend)
- [Risks](#risks)
- [Validation](#validation)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Context

Ver {{doc:0007F}} para RFs/RNs completos. Triggers de impressão nascem em `addComandaItem` (0006F) e `finalizeSale` (0002F). Todos os dados necessários já existem nas DTOs (snapshot imutável em `sale_items`; `ComandaItemDto.observation`).

## Architecture Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Print fora da DB tx (RN04) | USB I/O lento (1-3 s) não pode segurar row lock do Postgres | Print dentro da tx — deadlock risco sob concorrência |
| `kitchen_order_seqs` com atomic upsert `ON CONFLICT DO UPDATE` | Single statement, sem race entre SELECT + INSERT no primeiro print do dia | Advisory lock — fragil (requer hash estável de tenant+date) |
| `trigger_id` sem FK (polymorphic) | `type='cozinha'` → `comanda_items.id`; `type='cupom'` → `sales.id` — mesma coluna para dois targets | Duas colunas nullable — JOIN mais verboso; padrão já usado em `sales.comanda_id` |
| `printWarning?: string` em `ActionResult<T>` | Core op ok + print fail = `ok: true` + warning; frontend tosta sem bloquear | `ok: false` em falha de print — mata flow do usuário quando venda está gravada |
| Driver abstraction (`PrinterDriver` interface) | `UsbPrinterDriver` + `NoopPrinterDriver` para testes sem hardware | Chamar `escpos` diretamente no serviço — não mockável |
| Prints sequenciais (não concorrentes) | Driver USB não aceita dois jobs simultâneos — interleave corrompe recibo | Fila async — adiciona complexidade para MVP local |
| `selectTenantName` em tx separada | `tenants.name` não está na sale/comanda tx; resolver pós-commit mantém tx curta | Passar tenantName pelo contexto auth — requer mudança de `AuthContext` |

## Test Specification

### Contract Tests

| ID | Test Case | Area | RF/RN | Verify |
|----|-----------|------|-------|--------|
| T01 | kitchen-called-after-add-item | backend | RF01 | `printKitchenSlip` chamado com `orderNum`, `comandaLabel`, `name`, `qty`, `obs` |
| T02 | kitchen-slip-fields | backend | RF01 | `comandaLabel="Mesa 3"`, `name="Cerveja"`, `obs="gelada"` |
| T03 | observation-null | backend | RF01 | `observation === null` passado ao driver |
| T04 | seq-format | backend | RF02 | `getNextKitchenOrderNum` retorna `1` no primeiro call do dia; slip renderiza `#001` |
| T05 | seq-increments | backend (DB) | RF02 | Dois calls consecutivos → `1` depois `2` |
| T06 | seq-resets-new-day | backend (DB) | RF02 | Novo dia → nova linha com `seq=1` |
| T07 | seq-per-tenant | backend (DB) | RF02/RN02 | TenantA e TenantB isolados (cada começa em 1) |
| T08 | receipt-after-close-comanda | backend | RF03 | `printReceipt` chamado após `closeComanda` |
| T09 | receipt-after-finalize-sale | backend | RF03 | `printReceipt` chamado após `finalizeSale` |
| T10 | receipt-fields | backend | RF03 | `totalCents`, `items.length`, `paymentMethod` presentes |
| T11 | receipt-fiado-customer | backend | RF03 | `customerName="João"` em `ReceiptData` |
| T12 | no-fiscal-fields | backend | RF04/RN05 | `ReceiptData` sem `cnpj`, `cpf`, `icms`, `sefazKey` |
| T13 | kitchen-failure-no-throw | backend | RF05/RN04 | `tryKitchenPrint` retorna `{ success:false }` quando driver lança |
| T14 | kitchen-failure-logs-falhou | backend (DB) | RF05/RF08 | `print_logs` row com `status='falhou'`, `error_message` preenchido |
| T15 | receipt-failure-no-throw | backend | RF05/RN04 | `tryReceiptPrint` nunca lança |
| T16 | receipt-failure-logs-falhou | backend (DB) | RF05/RF08 | Row com `type='cupom'`, `status='falhou'` |
| T17 | no-printer-device-env | backend | RF05/RN06 | `PRINTER_DEVICE` ausente → `{ success:false }`, log `'falhou'` |
| T18 | no-auto-retry | backend | RF06 | `printKitchenSlip` chamado exatamente 1×, sem retry |
| T19 | reprint-kitchen-success | backend | RF07 | `reprintKitchen` → driver chamado, log `status='ok'` |
| T20 | reprint-receipt-success | backend | RF07 | `reprintReceipt` → driver chamado, log `status='ok'` |
| T21 | reprint-uses-immutable-data | backend | RF07/RN03 | Reimpressão não gera novo número de seq |
| T22 | log-ok-inserted | backend (DB) | RF08 | Row com todos campos obrigatórios non-null |
| T23 | log-fields-complete | backend (DB) | RF08 | `tenant_id`, `type`, `trigger_id`, `printed_by`, `printed_at` presentes |
| T24 | rls-isolation | backend (DB) | RN01 | TenantB não vê logs de TenantA via RLS |
| T25 | seq-atomic-concurrent | backend (DB) | RN02 | 5 calls concorrentes → 5 números distintos (1-5), sem duplicata |
| T26 | sale-commits-before-print | backend | RN04 | Linha de venda existe no DB antes do driver ser invocado |
| T27 | sequential-prints | backend | RN06 | Dois `tryKitchenPrint` não concorrentes — segundo aguarda primeiro |
| T28 | tenant-name-in-receipt | backend | RN08 | `ReceiptData.tenantName === "Padaria Central"` |
| T29 | action-result-print-warning | frontend | RF05 | `addComandaItemAction` com print fail → `ok:true`, `printWarning` preenchido |
| T30 | validation-reprint-invalid-uuid | backend | RF07 | UUID inválido → `ActionResult ok:false`, serviço não chamado |

### Test File Mapping

| Test File | IDs | Pattern |
|-----------|-----|---------|
| `lib/services/print/print-service.test.ts` | T01-T03, T08-T13, T15, T17-T21, T26-T28 | `vi.mock('../printer-driver')` — sem DB |
| `lib/services/print/print-service.test.ts` | T04-T07, T14, T16, T22-T25 | `HAS_DB ? describe : describe.skip` |
| `app/(app)/comandas/print-actions.test.ts` | T29, T30 | serviço mockado, sem DB |

## Database

### New Tables

| Table | PK | Tenant Isolation | Key Constraint |
|-------|-----|-----------------|----------------|
| `print_logs` | `id uuid` | `tenant_id` FK→tenants CASCADE + RLS | `trigger_id uuid NOT NULL` sem FK (polymorphic); GRANT SELECT,INSERT only (append-only) |
| `kitchen_order_seqs` | `(tenant_id, date)` composite | `tenant_id` FK→tenants CASCADE + RLS | atomic upsert `ON CONFLICT (tenant_id,date) DO UPDATE SET seq=seq+1 RETURNING seq`; GRANT SELECT,INSERT,UPDATE |

### print_logs fields
`id, tenant_id, type CHECK('cozinha'|'cupom'), trigger_id, status CHECK('ok'|'falhou') default 'ok', error_message nullable, printed_at timestamptz, printed_by FK→users`
Indexes: `(tenant_id, printed_at DESC)`, `(tenant_id, type, trigger_id)`

### kitchen_order_seqs fields
`tenant_id, date date, seq integer default 1` — Composite PK `(tenant_id, date)`. Caller converte data para UTC-3 antes de chamar.

### Drizzle Schema Files

| File | Action |
|------|--------|
| `db/schema/print-logs.ts` | CREATE — `trigger_id` sem `.references()` (polymorphic, padrão de `sales.ts`) |
| `db/schema/kitchen-order-seqs.ts` | CREATE — PK composto via `primaryKey(t.tenantId, t.date)` |
| `db/schema/index.ts` | ADD exports dos dois novos arquivos |
| `db/migrations/0007_impressao_rls.sql` | CREATE — GRANT + ENABLE RLS + policy `tenant_members` subquery (padrão `0006_comanda_rls.sql`) |

## Backend

### New Files

| File | Purpose |
|------|---------|
| `lib/services/print/print-data.ts` | `insertPrintLog`, `getNextKitchenOrderNum`, `selectPrintLogsByTrigger`, `selectTenantName` |
| `lib/services/print/printer-driver.ts` | Interface `PrinterDriver` + `UsbPrinterDriver` (lê `PRINTER_DEVICE`) + `NoopPrinterDriver` (testes) |
| `lib/services/print/print-service.ts` | `tryKitchenPrint`, `tryReceiptPrint`, `reprintKitchen`, `reprintReceipt` — never throw |
| `lib/services/print/print-service.test.ts` | 30 testes (T01-T28, driver mockado + HAS_DB para DB) |
| `lib/validation/print.ts` | `reprintKitchenSchema { comandaItemId: uuid }`, `reprintReceiptSchema { saleId: uuid }` |
| `app/(app)/comandas/print-actions.ts` | `reprintKitchenAction`, `reprintReceiptAction` → `ActionResult<void>` |

### Modified Files

| File | Change |
|------|--------|
| `lib/services/errors.ts` | `ActionResult<T>` success branch ganha `printWarning?: string` |
| `types/comanda.ts` | ADD `AddComandaItemResult = { comanda: ComandaDto; item: ComandaItemDto }` |
| `lib/services/comanda/comanda-service.ts` | `addComandaItem`: capture `insertComandaItem` return → return `{ comanda, item }`; após tx: `tryKitchenPrint`. `closeComanda`: após tx: fetch `tenantName` → `tryReceiptPrint` |
| `lib/services/sales/sale-service.ts` | `finalizeSale`: após tx: fetch `tenantName` → `tryReceiptPrint` |
| `app/(app)/comandas/actions.ts` | `addComandaItemAction`: destructure `{ comanda, item }`; propagar `printWarning`. `closeComandaAction`: idem |

### Service Contracts

#### Driver Interface (`printer-driver.ts`)
```
KitchenSlipData: { orderNum, comandaLabel, items: [{name, quantity, unit, observation}] }
ReceiptData: { tenantName, saleId, items: [{name, quantity, unit, unitPriceCents, subtotalCents}], totalCents, paymentMethod, customerName?, createdAt }
```

#### tryKitchenPrint flow
`getNextKitchenOrderNum` (own withUserRls tx) → `driver.printKitchenSlip` → `insertPrintLog status='ok'|'falhou'` (own tx). Never throws.

#### tryReceiptPrint flow
`driver.printReceipt` → `insertPrintLog` (own tx). Never throws. `tenantName` resolvido pelo caller em tx separada antes de chamar.

#### reprintKitchen / reprintReceipt
Carrega DTO original (imutável, RN03) → driver → `insertPrintLog`. Sem novo número de seq em reimpressão.

## Frontend

### Modified Files

| File | Change |
|------|--------|
| `lib/services/errors.ts` | (ver Backend — mesma mudança) |
| `types/comanda.ts` | (ver Backend — mesma mudança) |
| `components/comandas/AddItemForm.tsx` | Após `res.ok`: `if (res.printWarning) toast.warning(res.printWarning)` |
| `components/comandas/CloseComandaDialog.tsx` | Idem após `closeComandaAction` |
| `components/comandas/ComandaItemPanel.tsx` | ADD `<ReprintButton type="cozinha" id={item.id} />` por linha de item |
| `components/comandas/ComandaHistory.tsx` | ADD `<ReprintButton type="cupom" id={c.saleId} />` quando `c.saleId !== null` |

### New Component

`components/comandas/ReprintButton.tsx` — props: `{ type: 'cozinha'|'cupom'; id: string }`. Ghost icon button size sm. `pending` state local. `toast.success` / `toast.error` / `toast.warning` (Sonner, já importado). Sem `router.refresh()` (print é side-effect sem cache impact). Sem AlertDialog (ação segura/idempotente).

## Risks

| Risk | Prob | Impact | Mitigation |
|------|------|--------|------------|
| `escpos`/`@escpos/usb` incompatível com Node.js versão do projeto | Medium | Block | Verificar compatibilidade antes de instalar; testar com `NoopPrinterDriver` primeiro |
| USB access indisponível em ambiente de CI/Docker | High | Test skip | `PRINTER_DEVICE` ausente → `NoopPrinterDriver` ativado; USB tests marcados skip |
| `escpos` sem tipos TS (`@types/escpos` inexistente) | Medium | Build fail | Criar `lib/services/print/escpos.d.ts` com tipagem mínima |
| Reimpressão sem número de ordem original | Low | UX | RN03 especifica dados imutáveis; sem seq em reprint é comportamento correto |
| `selectTenantName` adiciona query extra por venda | Low | Perf | Query trivial (PK lookup); `tenants` é tabela pequena |

## Validation

| Check | How |
|-------|-----|
| `npm run typecheck` | `ActionResult<T>` com `printWarning`; `AddComandaItemResult`; driver interface |
| `npm run lint` | Sem `any`, sem `console.log` |
| `npm test` (sem DB) | T01-T03, T08-T13, T15, T17-T21, T26-T28, T29, T30 (18 unit + 2 action) |
| `npm test` (com DB) | +T04-T07, T14, T16, T22-T25 (10 DB integration) |
| Manual | Conectar impressora → `addComandaItem` → pedido impresso; `closeComanda` → cupom impresso; desconectar → toast aparece; botão Reimprimir → paper out |

## Implementation Order

1. **Database** — schema files (`print-logs.ts`, `kitchen-order-seqs.ts`) → `db/schema/index.ts` → `db:push` → `0007_impressao_rls.sql` → `db:rls`
2. **Backend data layer** — `print-data.ts` (insertPrintLog, getNextKitchenOrderNum, selectPrintLogsByTrigger, selectTenantName)
3. **Backend driver** — `printer-driver.ts` (interface + UsbPrinterDriver + NoopPrinterDriver)
4. **Backend service** — `print-service.ts` (tryKitchenPrint, tryReceiptPrint, reprint*)
5. **Backend tests** — `print-service.test.ts` (T01-T28, HAS_DB pattern)
6. **ActionResult change** — `lib/services/errors.ts` (`printWarning` field)
7. **Integration hooks** — `comanda-service.ts` + `sale-service.ts` + `actions.ts`
8. **Validation + print actions** — `lib/validation/print.ts` + `print-actions.ts` + `print-actions.test.ts`
9. **Frontend** — `ReprintButton.tsx` + toast warnings em `AddItemForm`, `CloseComandaDialog`, `ComandaItemPanel`, `ComandaHistory`

## Quick Reference

| Pattern | Search |
|---------|--------|
| RLS migration template | `db/migrations/0006_comanda_rls.sql` |
| Polymorphic uuid (no FK) | `db/schema/sales.ts` — `comandaId` |
| Composite PK in Drizzle | `db/schema/cash-sessions.ts` |
| withUserRls pattern | `lib/db/rls.ts` |
| ActionResult pattern | `lib/services/errors.ts` |
| HAS_DB test pattern | `lib/services/comanda/comanda-service.test.ts` |
| toast.warning usage | `components/comandas/AddItemForm.tsx` (after this feature) |
| Server action pattern | `app/(app)/comandas/actions.ts` |
