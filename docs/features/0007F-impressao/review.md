---
id: 0007F
type: feature-review
slug: impressao
status: passed
created: 2026-06-16
updated: 2026-06-16
related: [0007F]
---

# Review: 0007F-impressao

> **Date:** 2026-06-16 | **Branch:** feature/0007F-impressao

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` → exit 0 |
| Spec Compliance | ✅ PASSED | 33/33 acceptance items compliant; all RF01-RF08 / RN01-RN08 covered |
| Code Review Score | ✅ PASSED | Frontend 9.5/10 · Backend 8/10 · Overall 8.75/10 |
| Product Validation | ✅ PASSED | RF: 8/8, RN: 8/8 |
| typecheck | ✅ PASSED | `npm run typecheck` → exit 0 |
| lint | ✅ PASSED | `npm run lint` → exit 0 |
| test | ✅ PASSED | `npm test` → 280/280 pass |
| build | ✅ PASSED | `npm run build` → exit 0 |

| **Overall** | **✅ PASSED** | **Ready for merge** |

> Reviewed at: 2026-06-16 | Reviewed by: /add.review (model: claude-sonnet-4-6)

## Spec Compliance Audit

**Source:** `docs/features/0007F-impressao/tasks.md` § Acceptance Checklist (33 items, all `[x]`)

**RF/RN Coverage:** All 16 requirements (RF01-RF08, RN01-RN08) present in `## Requirements Coverage` and referenced by ≥1 acceptance checklist item.

| Status | Count |
|--------|-------|
| COMPLIANT | 33 |
| DIVERGENT | 0 |
| PENDING | 0 |
| STALE TICK | 0 |

**SPEC_AUDIT_STATUS = COMPLIANT**

## Code Review Summary

### Frontend Review (9.5/10)

**Files reviewed:** 5 (`ReprintButton.tsx`, `AddItemForm.tsx`, `CloseComandaDialog.tsx`, `ComandaItemPanel.tsx`, `ComandaHistory.tsx`)

**Issues found:** 1 Minor

| Severity | File | Issue | Fix |
|----------|------|-------|-----|
| Minor | `ReprintButton.tsx:54` | Dead ternary — both branches returned identical text `"Reimprimir"` | Changed to `"Reimprimir via"` / `"Reimprimir cupom"` for semantic differentiation |

**All contracts COMPLIANT:** ReprintButton props/behavior, printWarning toast guards in AddItemForm + CloseComandaDialog, ReprintButton per item in ComandaItemPanel, conditional ReprintButton in ComandaHistory.

### Backend Review (8/10 → 8.75/10 after fixes)

**Files reviewed:** 18 (all changed backend files)

**Issues found:** 3 Important · 2 Minor

| Severity | File | Issue | Fix |
|----------|------|-------|-----|
| Important | `print-actions.ts:28-29,46-47` | Reprint actions discarded `{ success: false }` from service — silent failure always returned `ok:true` | Propagate `result.success` → `{ ok:false, error }` on failure |
| Important | `print-service.ts:133,343` | `customerName: undefined` hardcoded — fiado receipts never show customer name (RF03) | Added `selectCustomerName` lookup in `tryReceiptPrint` + `reprintReceipt` when `paymentMethod==="fiado"` |
| Important | `caixa/actions.ts:57-59`, `comandas/actions.ts:134-136` | `selectTenantName` inside outer `try/catch` — transient DB error after sale commit could return `ok:false` even though sale succeeded (violates RN04) | Wrapped post-commit section in dedicated `try/catch` that always returns `{ ok:true, printWarning }` |
| Minor | `print-data.ts` | Missing `selectCustomerName` function (needed for fix above) | Added `selectCustomerName(tx, tenantId, customerId)` |
| Minor | `0007_impressao_rls.sql:15` | `print_logs` RLS policy uses `FOR ALL` without explaining why (misleading on append-only table) | Added comment: "FOR ALL; UPDATE/DELETE bloqueados pelo GRANT (defesa em profundidade)" |

**All Important issues fixed and re-verified** (typecheck, lint, test, build all exit 0 after fixes).

## Product Validation

| RF/RN | Description | Status | Location |
|-------|-------------|--------|----------|
| RF01 | Kitchen slip auto-print on `addComandaItem` | PASS | `actions.ts:68` — `tryKitchenPrint` after service |
| RF02 | Daily sequence `#001` format, atomic | PASS | `print-service.ts:52`, `print-data.ts:57-65` |
| RF03 | Receipt auto-print on `closeComanda` + `finalizeSale` | PASS | Both actions; customerName lookup for fiado (fixed) |
| RF04 | Non-fiscal receipt (`ReceiptData` no CNPJ/CPF/ICMS) | PASS | `printer-driver.ts:22-36` |
| RF05 | Print failure never blocks sale; toast warning | PASS | All try* functions return `{ success:false }` + `printWarning` |
| RF06 | No auto-retry | PASS | Single driver call, no retry loop |
| RF07 | Manual reprint available; uses immutable data | PASS | `reprintKitchen`/`reprintReceipt`; no new seq on reprint |
| RF08 | Every print attempt logged (ok or falhou) | PASS | `insertPrintLog` in both success + failure paths |
| RN01 | RLS on `print_logs`, `kitchen_order_seqs` | PASS | `0007_impressao_rls.sql` |
| RN02 | Atomic daily counter per tenant, no race | PASS | `INSERT ON CONFLICT DO UPDATE SET seq=seq+1 RETURNING seq` |
| RN03 | Reprint uses immutable data, no new seq | PASS | `reprintKitchen` uses `orderNum=0`; no `getNextKitchenOrderNum` call |
| RN04 | Print outside DB tx; failure never reverts sale | PASS | Post-commit isolation try/catch (fixed) |
| RN05 | No fiscal fields on receipt | PASS | `ReceiptData` type verified |
| RN06 | Sequential prints, `PRINTER_DEVICE` config | PASS | Sequential `await` driver calls; `UsbPrinterDriver` reads env var |
| RN07 | Incompatible with Vercel serverless; documented | PASS | JSDoc on `UsbPrinterDriver` |
| RN08 | `tenantName` from `tenants.name` | PASS | `selectTenantName` PK lookup |
