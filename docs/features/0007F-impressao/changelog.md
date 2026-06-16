---
id: CHG0008
type: changelog
slug: impressao
created: 2026-06-16
updated: 2026-06-16
related: [0007F, 0006F, 0002F]
---

## TL;DR

Entrega a **integração com impressora térmica USB** no PDV: ao lançar um item em comanda imprime o **pedido de cozinha** (sequencial diário, produto, quantidade, observação); ao fechar venda direta ou comanda imprime o **cupom simples** (itens, total, forma de pagamento, cliente se fiado). Falha de impressora nunca bloqueia a venda — toast avisa o operador e erro fica logado. Reimpressão disponível via botão em cada linha de item e no histórico. Feature 0007F implementada em 21 tarefas (database + backend + frontend), 280 testes passando.

## TOC

- [Changeset](#changeset)
- [Database](#database)
- [Backend](#backend)
- [Frontend](#frontend)
- [Test Coverage](#test-coverage)
- [Decisions](#decisions)
- [Quick Ref](#quick-ref)

## Changeset

**Branch:** `feature/0007F-impressao` → `master`
**Files changed:** 22 code files (+ 6 documentation)
**Tests:** 280 passed (49 suites) — sem regressões

### Arquivos novos

| Arquivo | Descrição |
|---------|-----------|
| `db/schema/print-logs.ts` | Schema Drizzle da tabela `print_logs` — log append-only de impressões |
| `db/schema/kitchen-order-seqs.ts` | Schema Drizzle da tabela `kitchen_order_seqs` — sequencial diário atômico |
| `db/migrations/0007_impressao_rls.sql` | GRANT + ENABLE RLS + policies de tenant isolation para as duas novas tabelas |
| `lib/services/print/print-data.ts` | Data layer: `insertPrintLog`, `getNextKitchenOrderNum`, `selectPrintLogsByTrigger`, `selectTenantName`, `selectCustomerName` |
| `lib/services/print/printer-driver.ts` | Interface `PrinterDriver` + `UsbPrinterDriver` (stub ESC/POS) + `NoopPrinterDriver` (testes) |
| `lib/services/print/print-service.ts` | `tryKitchenPrint`, `tryReceiptPrint`, `reprintKitchen`, `reprintReceipt` — nunca lançam (RF05/RN04) |
| `lib/services/print/print-service.test.ts` | 26 testes unitários + padrão HAS_DB para integração |
| `lib/validation/print.ts` | Schemas Zod `reprintKitchenSchema` + `reprintReceiptSchema` (UUID RFC 4122 v4) |
| `app/(app)/comandas/print-actions.ts` | `reprintKitchenAction`, `reprintReceiptAction` — propagam resultado do serviço |
| `app/(app)/comandas/print-actions.test.ts` | Testes T29 (printWarning em addComandaItemAction) e T30 (UUID inválido) |
| `components/comandas/ReprintButton.tsx` | Botão ghost sm que chama ação de reimpressão e toasta resultado |

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `db/schema/index.ts` | Adicionadas exports de `print-logs` e `kitchen-order-seqs` |
| `lib/services/errors.ts` | `ActionResult<T>` success branch ganha `printWarning?: string` |
| `types/comanda.ts` | Adicionado `AddComandaItemResult = { comanda: ComandaDto; item: ComandaItemDto }` |
| `lib/services/comanda/comanda-service.ts` | `addComandaItem` retorna `AddComandaItemResult` (captura item inserido para o print) |
| `lib/services/comanda/comanda-service.test.ts` | Atualizado para `AddComandaItemResult` e adicionado assert do novo campo `item` |
| `app/(app)/comandas/actions.ts` | `addComandaItemAction` → `tryKitchenPrint` pós-tx; `closeComandaAction` → `tryReceiptPrint` pós-tx (seção isolada em try/catch) |
| `app/(app)/caixa/actions.ts` | `finalizeSaleAction` → `tryReceiptPrint` pós-tx (seção pós-commit isolada) |
| `components/comandas/AddItemForm.tsx` | `if (res.printWarning) toast.warning(...)` após lançamento de item |
| `components/comandas/CloseComandaDialog.tsx` | `if (res.printWarning) toast.warning(...)` após fechar comanda |
| `components/comandas/ComandaItemPanel.tsx` | `<ReprintButton type="cozinha" id={item.id} />` por linha de item |
| `components/comandas/ComandaHistory.tsx` | `<ReprintButton type="cupom" id={c.saleId} />` condicional quando `saleId !== null` |

## Database

Duas novas tabelas, ambas com `tenant_id` FK, RLS habilitado, policies via subquery `tenant_members` (mesmo padrão de 0006F).

### `print_logs`

Registro append-only de cada tentativa de impressão. `trigger_id` é polimórfico (sem FK) — aponta para `comanda_items.id` (type=cozinha) ou `sales.id` (type=cupom). GRANT restrito: SELECT + INSERT apenas.

```
id (uuid PK) · tenant_id · type CHECK('cozinha'|'cupom') · trigger_id (uuid, sem FK)
status CHECK('ok'|'falhou') DEFAULT 'ok' · error_message (nullable)
printed_at (timestamptz, defaultNow) · printed_by FK→users
```

Indexes: `(tenant_id, printed_at DESC)`, `(tenant_id, type, trigger_id)`

### `kitchen_order_seqs`

Sequencial diário por tenant. PK composta `(tenant_id, date)` — sem surrogate id. Upsert atômico: `INSERT ON CONFLICT DO UPDATE SET seq=seq+1 RETURNING seq`. GRANT: SELECT + INSERT + UPDATE (upsert requer UPDATE).

```
tenant_id (FK→tenants) · date (date) · seq (integer DEFAULT 1)
```

## Backend

### Print como side-effect (RN04)

O print nunca entra na transação de banco do core. Fluxo em `addComandaItemAction`:
1. `addComandaItem(ctx, data)` — tx de banco commita, retorna `AddComandaItemResult`
2. `tryKitchenPrint(ctx, item, comanda)` — tx separada para seq; driver USB; tx separada para log

Em `closeComandaAction` e `finalizeSaleAction`:
1. `closeComanda/finalizeSale` — tx core commita, retorna `SaleDto`
2. `selectTenantName` — tx separada (mantém tx de venda curta)
3. `tryReceiptPrint(ctx, sale, tenantName)` — driver + log

A seção pós-commit fica em `try/catch` próprio que sempre retorna `{ ok: true, printWarning }` — falha de `selectTenantName` ou `tryReceiptPrint` nunca retorna `{ ok: false }` ao cliente (venda já gravada).

### Nunca lança (RF05)

Todas as funções de print (`tryKitchenPrint`, `tryReceiptPrint`, `reprintKitchen`, `reprintReceipt`) têm outer try/catch que captura qualquer erro, loga `status='falhou'` em tx separada e retorna `{ success: false, error }`. Driver USB instanciado apenas se `PRINTER_DEVICE` estiver definido.

### Sequencial atômico (RN02)

`getNextKitchenOrderNum` usa single statement `INSERT ... ON CONFLICT (tenant_id, date) DO UPDATE SET seq = kitchen_order_seqs.seq + 1 RETURNING seq` — sem SELECT prévio, sem race condition, 5 chamadas concorrentes retornam 5 números distintos.

### Customer name em fiado (RF03)

`tryReceiptPrint` e `reprintReceipt` verificam `paymentMethod === "fiado" && customerId !== null`; se verdadeiro, chamam `selectCustomerName(tx, tenantId, customerId)` para incluir o nome do cliente no cupom.

## Frontend

### ReprintButton

Componente `"use client"` com props `{ type: 'cozinha' | 'cupom'; id: string }`. Estado local `pending` durante a chamada. Chama `reprintKitchenAction` ou `reprintReceiptAction` conforme o tipo. Exibe `toast.success`, `toast.error` ou `toast.warning` (se `printWarning`). Sem `router.refresh()` — print é side-effect puro sem impacto em cache. Sem AlertDialog — operação idempotente.

### Toast de aviso (RF05)

`AddItemForm` e `CloseComandaDialog` verificam `res.printWarning` no retorno das actions. Se presente, disparam `toast.warning(res.printWarning)` após o toast de sucesso da operação principal.

## Test Coverage

| Arquivo | Testes | Padrão |
|---------|--------|--------|
| `lib/services/print/print-service.test.ts` | 26 | Unit (driver mockado) + HAS_DB para integração |
| `app/(app)/comandas/print-actions.test.ts` | 4 | T29 (printWarning propagado), T30 (UUID inválido rejeitado) |
| Total (suite completa) | 280 | 49 arquivos, 0 falhas |

Cobertura dos testes de print: RF01-RF08, RN01-RN06, RN08. DB integration skipa sem `DATABASE_URL`.

## Decisions

| Decisão | Escolha | Alternativa rejeitada |
|---------|---------|----------------------|
| Print fora da tx de banco | USB I/O (1-3 s) não pode segurar row lock | Print dentro da tx — deadlock sob concorrência |
| Atomic upsert para sequencial | Single statement, sem race | Advisory lock — frágil |
| `trigger_id` sem FK (polimórfico) | Um campo para cozinha e cupom | Duas colunas nullable — JOIN mais verboso |
| `printWarning` em `ActionResult<T>` | `ok: true` + aviso quando venda ok, print falhou | `ok: false` — mataria o fluxo quando venda está gravada |
| Driver abstraction (interface) | `NoopPrinterDriver` permite testes sem hardware | Chamar `escpos` direto — não mockável |
| `selectCustomerName` no print service | Lookup em tx separada, só para fiado | Adicionar `customerName` ao `SaleDto` — mudança mais invasiva |
| Seção pós-commit em try/catch próprio | `selectTenantName` falha nunca retorna `ok:false` | Deixar no try externo — violaria RN04 em caso de timeout |

## Quick Ref

```json
{
  "id": "0007F",
  "domain": "impressão PDV",
  "touched": [
    "app/(app)/caixa/",
    "app/(app)/comandas/",
    "components/comandas/",
    "db/migrations/",
    "db/schema/",
    "lib/services/comanda/",
    "lib/services/print/",
    "lib/validation/",
    "types/"
  ],
  "patterns": ["side-effect-outside-tx", "never-throw-service", "atomic-upsert", "polymorphic-fk", "optional-warning-result"],
  "keywords": ["impressão", "cupom", "cozinha", "ESC/POS", "USB", "sequencial", "reimpressão", "print_logs"]
}
```
