---
id: 0007F
type: feature-discovery
slug: impressao
created: 2026-06-14
related: [0006F, 0002F, 0004F, 0005F, 0003F, PRODUCT, OWNER]
---

## TL;DR

Printing kitchen orders (comanda de cozinha) on `addComandaItem` and fiscal receipts (cupom fiscal/SAT/NFC-e) on sale finalization requires integrating thermal printer hardware via USB/serial/network. The system has complete order/receipt data available at trigger points (comanda + sale + items + customer + tenant context), all in centavos and multi-tenant isolated, with no existing printer patterns in the codebase.

## Related Features

| Feature | Refs | Tipo |
|---|---|---|
| 0006F Comanda/Mesa | comanda-service.ts (addComandaItem, closeComanda) | Dependencia — venda de mesa triggers kitchen print |
| 0002F Venda Rapida | sale-service.ts (finalizeSale) | Dependencia — venda triggers fiscal receipt print |
| 0004F Financeiro | Customer + paymentMethod context | Reuso — customer data, payment tracking |
| 0005F Lucro/Fechamento | cost_cents_snapshot in sale_items | Reuso — cost snapshot for fiscal/audit |
| 0003F Estoque | stock-movements by comanda/sale_id | Context — what was printed + when |

## Reusable Functionality

1. **Server-side transactional pattern** (withUserRls, single tx): comanda-service and sale-service wrap all operations in withUserRls(ctx.userId, async (tx) => {...}), guaranteeing atomicity. Print trigger can follow the same pattern — print happens inside the tx after insert succeeds, or queued for async retry.

2. **Multi-tenant isolation + RLS**: All data is tenant-scoped via tenant_id in schema and enforced by RLS policies. Print settings (printer address, thermal columns, receipt format) will inherit the same pattern — stored at tenant level (e.g., new printer_config table with tenant_id FK).

3. **Snapshot data integrity**: Both comanda close and sale finalization capture product price/cost at decision time (salePriceCents, costCentsSnapshot). Receipt printing can reuse the snapshot already in sale_items — never stale/recalculated.

4. **Audit trail via user_id + timestamps**: Every comanda/sale records userId and timestamps (openedAt, closedAt, createdAt). Print log can follow the same — printed_at, printed_by, printer_id, plus original itemdata hash for reprint detection.

5. **ActionResult<T> error pattern**: Action files use toActionError(error) for consistent error serialization. Print errors (no printer found, thermal service unavailable) can use the same pattern.

## Existing Patterns

### Trigger Points (Both Server-Side Actions)

1. **Kitchen print** (comanda):
   - When: addComandaItemAction() → addComandaItem(ctx, input) in service
   - Data: Full ComandaDto returned (id, label, status, items with names/qtys/observations)
   - Access: Server action → service layer (no client-side delay)

2. **Fiscal receipt** (sale):
   - When: closeComandaAction() → closeComanda() OR regular finalizeSale() (0002F)
   - Data: Full SaleDto returned (id, items[], totalCents, paymentMethod, customerId, createdAt, userId)
   - Access: Server action → service layer

### Data Available at Print Time

**For kitchen print** (from ComandaDto + product snapshot at print time):
- comandaId (UUID)
- label (e.g., "Mesa 3", "Joao")
- openedAt (ISO datetime)
- items with: name, quantity, observation (optional, up to 200 chars), unit (un/kg)

**For fiscal receipt** (from SaleDto + snapshot in sale_items):
- saleId (UUID)
- totalCents (integer, centavos)
- paymentMethod (dinheiro/pix/cartao/fiado)
- customerId (UUID | null, required for fiado)
- items with: nameSnapshot, unit, quantity, unitPriceCents, subtotalCents, costCentsSnapshot
- createdAt (ISO datetime)
- userId (operator)

### Thermal Printer Integration Points

**No existing code** — codebase has zero printer/receipt/PDF libraries:
- package.json has no escpos, thermal-printer, pdfkit, puppeteer, html2pdf
- No window.print() usage (not a browser-print feature)
- No iframe/PDF generation infrastructure
- No /api/print or webhook routes for printer services

**All hardware integration is new.**

### Settings/Configuration Pattern

Current settings model (from settings-service.ts):
- Only defaultMarkupPercent stored in tenants.default_markup_percent column
- Accessed via getDefaultMarkup() / updateDefaultMarkup()

For printer config, follow the pattern:
- Option A: Add columns to tenants table (printer_enabled, printer_type, printer_address)
- Option B: Create a printer_config table (future-proof for multiple printers)

**Tenant context flow**: AuthContext always carries tenantId, so any service can load tenant-scoped printer config without input validation.

## Prerequisites Analysis

| Prerequisito | Status | Notes |
|---|---|---|
| Trigger points identified | YES | addComandaItem() and closeComanda() / finalizeSale() in service layer |
| Data structure for kitchen order | YES | ComandaDto with items, observation, unit |
| Data structure for receipt | YES | SaleDto with snapshot items (price + cost frozen) |
| Multi-tenant isolation pattern | YES | All data scoped by tenant_id; RLS enforced |
| Snapshot integrity (price/cost) | YES | sale_items already has nameSnapshot, unitPriceCents, costCentsSnapshot |
| Audit trail (user/timestamp) | YES | userId and timestamps in comanda/sale |
| Server-side transactional pattern | YES | withUserRls wrapper; print can queue inside tx |
| Thermal printer hardware library | DECISION | Choose: escpos-usb, node-serialport, network socket, or cloud service |
| Print format specification | DECISION | Kitchen: 80mm width, item lines. Fiscal: CFe/SAT/NFC-e rules? |
| Failure handling / retry | DECISION | Sync block or async queue? |
| Tenant printer discovery | DECISION | Auto-detect or manual IP/port config? |

## Open Questions

### Architecture & Integration

1. **Print trigger timing**:
   - Should print be synchronous (inside service tx, blocking response) or asynchronous (fire-and-forget queue)?
   - Sync = safer (audit trail, strong ACID) but slower (1-5s per print)
   - Async = faster UX but requires print queue table + retry logic

2. **Printer hardware stack**:
   - USB thermal printer (escpos library, local to POS terminal)?
   - Network printer (TCP socket, IP:port)?
   - Cloud print service (API call, e.g., PrintNode)?
   - Implication: infrastructure (print server, agent, or local daemon)?

3. **Kitchen vs fiscal separation**:
   - Single printer for both, or two separate printers?
   - Implication: schema needs to track printer config per print type

### Fiscal & Compliance

4. **Fiscal requirements by region**:
   - Brazil (cupom fiscal, ICMS, SAT, NFC-e, CFe format)?
   - Does tenant need CNPJ/CPF on receipt?
   - State-level tax rules (ICMS varies by estado)?
   - Implication: receipt template varies by compliance rules

5. **NFC-e vs SAT vs standard receipt**:
   - NFC-e = Sefaz integration, digital signature, async submission
   - SAT = SAT device (hardware) + digital cert
   - Standard cupom = plain receipt, no electronic filing
   - MVP: Start with plain kitchen order + simple receipt (defer NFC-e/SAT to Phase 3)?

### Configuration & Settings

6. **Printer discovery and registration**:
   - Auto-scan network, or manual IP/port entry?
   - Tenant printer registration UI (settings page, setup wizard)?
   - Implication: admin-facing config UI is new scope

7. **Retry and error handling**:
   - If printer offline: abort sale, or queue for retry?
   - After N failures: alert operator, or just log?
   - Implication: user experience (wait for print success?)

### Data & Audit

8. **Print log**:
   - Log every print attempt (success/failure)?
   - Fields: print_id, tenant_id, sale_id | comanda_id, print_type, printer_id, printed_at, status, error_message
   - Implication: new print_logs table + queries

9. **Reprint workflow**:
   - Can operator request reprint after sale closes?
   - Reprint uses same snapshot data (immutable), just re-send to printer
   - Implication: action/endpoint to reprint by saleId + UI button

10. **Package dependencies**:
    - escpos or escpos-usb for thermal USB?
    - node-serialport for serial port?
    - pdf-lib or pdfkit for PDF (less common for thermal)?
    - Template engine for receipt format?

## Summary

**Codebase is ready for print integration** in terms of:
- YES: Clean trigger points (service actions returning complete data)
- YES: Snapshot data (price/cost frozen at sale time)
- YES: Multi-tenant isolation (tenant-scoped printer config fits pattern)
- YES: Audit trail (user/timestamp already captured)

**But requires new decisions** on:
- DECISION: Sync vs async print (failure handling + UX)
- DECISION: Printer hardware stack (USB, network, cloud)
- DECISION: Fiscal compliance rules (Brazil? NFC-e or simple receipt?)
- DECISION: Tenant printer config (auto-discover, manual, admin UI)
- DECISION: Reprint workflow (operator recovery)

**Recommended MVP scope**:
1. Synchronous print on addComandaItem (kitchen order) and closeComanda (receipt)
2. Support USB thermal printer via escpos library (local to terminal)
3. Simple receipt format (no NFC-e/SAT, no ICMS — item list + total + date)
4. Manual printer config in tenant settings (IP:port or USB device ID)
5. Basic error handling (print failure logged, not blocking sale)
6. Reprint endpoint for operator recovery
7. Defer network printer auto-discovery, multi-printer setup, and fiscal compliance to Phase 3
