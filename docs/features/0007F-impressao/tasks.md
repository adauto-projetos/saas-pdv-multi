---
id: 0007F
type: feature-tasks
slug: impressao
status: in-progress
created: 2026-06-14
updated: 2026-06-16
related: [0007F, 0006F, 0002F]
---

# Tasks: 0007F — Impressão de cozinha/fiscal

## Metadata

| Field | Value |
|-------|-------|
| Complexity | COMPLEX |
| Total tasks | 21 |
| Services | database, backend, frontend, test |

## Requirements Coverage

- [x] RF01 — Impressão automática de pedido de cozinha ao lançar item em comanda
- [x] RF02 — Número sequencial diário por tenant no pedido de cozinha (formato #001)
- [x] RF03 — Impressão automática de cupom simples ao fechar venda (closeComanda / finalizeSale)
- [x] RF04 — Cupom não-fiscal (sem CNPJ, ICMS, SEFAZ)
- [x] RF05 — Falha de impressora não bloqueia venda; exibe toast e registra log
- [x] RF06 — Sem retry automático; reimpressão manual pelo operador
- [x] RF07 — Reimpressão de cupom ou pedido de cozinha a qualquer momento
- [x] RF08 — Registro de cada tentativa de impressão em print_logs (sucesso ou falha)
- [x] RN01 — Isolamento de print_logs por tenant via RLS
- [x] RN02 — Sequencial de cozinha por tenant + dia (UTC-3); incremento atômico sem duplicata
- [x] RN03 — Reimpressão usa dados imutáveis; não recalcula nem gera novo número de seq
- [x] RN04 — Print é side-effect fora da transação de banco; falha não reverte venda
- [x] RN05 — Cupom sem dados fiscais (sem CNPJ, CPF, ICMS, chave SEFAZ)
- [x] RN06 — Config via PRINTER_DEVICE; prints sequenciais (não concorrentes)
- [x] RN07 — Feature requer Node.js local com acesso USB; incompatível com Vercel serverless
- [x] RN08 — Nome do estabelecimento no cupom lido de tenants.name

## TDD

- [x] T-TEST-01 T01-T03: kitchen slip fields e observation null — `lib/services/print/print-service.test.ts`
- [x] T-TEST-02 T04-T07: seq format, incremento, reset diário, isolamento por tenant — `lib/services/print/print-service.test.ts`
- [x] T-TEST-03 T08-T12: receipt após close/finalize, campos, fiado, sem fiscal — `lib/services/print/print-service.test.ts`
- [x] T-TEST-04 T13-T17: kitchen/receipt failure não lança; log falhou; sem PRINTER_DEVICE — `lib/services/print/print-service.test.ts`
- [x] T-TEST-05 T18: sem retry automático (spy toHaveBeenCalledTimes 1) — `lib/services/print/print-service.test.ts`
- [x] T-TEST-06 T19-T21: reprint kitchen/receipt sucesso; dados imutáveis; sem novo seq — `lib/services/print/print-service.test.ts`
- [x] T-TEST-07 T22-T25: log ok inserido; campos completos; RLS isolation; seq atômico concurrent — `lib/services/print/print-service.test.ts`
- [x] T-TEST-08 T26-T28: sale commita antes do print; prints sequenciais; tenantName no receipt — `lib/services/print/print-service.test.ts`
- [x] T-TEST-09 T29: addComandaItemAction com print fail → ok:true + printWarning — `app/(app)/comandas/print-actions.test.ts`
- [x] T-TEST-10 T30: reprintKitchenAction com UUID inválido → ok:false sem chamar serviço — `app/(app)/comandas/print-actions.test.ts`

## Execution

- [x] T01 Criar schemas Drizzle print_logs e kitchen_order_seqs
  - Service: database
  - Files: `db/schema/print-logs.ts`, `db/schema/kitchen-order-seqs.ts`
  - Deps: -
  - Verify: `npx tsc --noEmit` passa sem erros nos novos arquivos

- [x] T02 Exportar novos schemas em db/schema/index.ts
  - Service: database
  - Files: `db/schema/index.ts`
  - Deps: T01
  - Verify: `import { printLogs, kitchenOrderSeqs } from '@/db/schema'` compila

- [x] T03 db:push + migration RLS 0007_impressao_rls.sql + db:rls
  - Service: database
  - Files: `db/migrations/0007_impressao_rls.sql`
  - Deps: T02
  - Verify: `npm run db:setup` sai exit 0; `\d print_logs` mostra RLS habilitado no psql

- [x] T04 Implementar print-data.ts (insertPrintLog, getNextKitchenOrderNum, selectPrintLogsByTrigger, selectTenantName)
  - Service: backend
  - Files: `lib/services/print/print-data.ts`
  - Deps: T03
  - Verify: `npm run typecheck` passa; funções exportadas tipadas corretamente

- [x] T05 Implementar printer-driver.ts (interface + UsbPrinterDriver + NoopPrinterDriver)
  - Service: backend
  - Files: `lib/services/print/printer-driver.ts`
  - Deps: T04
  - Verify: `npm run typecheck` passa; NoopPrinterDriver implementa PrinterDriver sem erro

- [x] T06 Implementar print-service.ts — tryKitchenPrint e tryReceiptPrint
  - Service: backend
  - Files: `lib/services/print/print-service.ts`
  - Deps: T04, T05
  - Verify: `npm run typecheck` passa; funções exportadas com assinatura correta

- [x] T07 Implementar print-service.ts — reprintKitchen e reprintReceipt
  - Service: backend
  - Files: `lib/services/print/print-service.ts`
  - Deps: T06
  - Verify: `npm run typecheck` passa; sem novo getNextKitchenOrderNum em reprint

- [x] T08 Escrever print-service.test.ts (T01-T28: unit + HAS_DB)
  - Service: test
  - Files: `lib/services/print/print-service.test.ts`
  - Deps: T06, T07
  - Verify: `npm test lib/services/print/print-service.test.ts` — 26 testes HAS_DB (passam com DB)

- [x] T09 Adicionar printWarning em ActionResult success branch
  - Service: backend
  - Files: `lib/services/errors.ts`
  - Deps: T06
  - Verify: `npm run typecheck` passa; campo `printWarning?: string` visível no tipo

- [x] T10 Adicionar AddComandaItemResult em types/comanda.ts
  - Service: backend
  - Files: `types/comanda.ts`
  - Deps: -
  - Verify: `npm run typecheck` passa; tipo exportado com shape `{ comanda, item }`

- [x] T11 Integrar tryKitchenPrint em addComandaItemAction (actions.ts)
  - Service: backend
  - Files: `app/(app)/comandas/actions.ts`
  - Deps: T06, T09, T10
  - Verify: `npm run typecheck` passa; retorno de addComandaItem é AddComandaItemResult; print pós-tx

- [x] T12 Integrar tryReceiptPrint em closeComandaAction (actions.ts)
  - Service: backend
  - Files: `app/(app)/comandas/actions.ts`
  - Deps: T06, T09, T11
  - Verify: `npm run typecheck` passa; selectTenantName chamado pós-tx antes do print

- [x] T13 Integrar tryReceiptPrint em finalizeSale (sale-service.ts)
  - Service: backend
  - Files: `app/(app)/caixa/actions.ts`
  - Deps: T06, T09
  - Verify: `npm run typecheck` passa; selectTenantName chamado pós-tx antes do print

- [x] T14 Criar lib/validation/print.ts e print-actions.ts
  - Service: backend
  - Files: `lib/validation/print.ts`, `app/(app)/comandas/print-actions.ts`
  - Deps: T07, T09
  - Verify: `npm run typecheck` passa; schemas reprintKitchen/reprintReceipt exportados

- [x] T15 Escrever print-actions.test.ts (T29, T30 + success paths)
  - Service: test
  - Files: `app/(app)/comandas/print-actions.test.ts`
  - Deps: T14
  - Verify: `npm test app/(app)/comandas/print-actions.test.ts` — 4 testes passam

- [x] T16 Atualizar actions.ts — addComandaItemAction e closeComandaAction
  - Service: backend
  - Files: `app/(app)/comandas/actions.ts`
  - Deps: T11, T12, T14
  - Verify: `npm run typecheck` passa; printWarning propagado no ActionResult

- [x] T17 Criar ReprintButton.tsx
  - Service: frontend
  - Files: `components/comandas/ReprintButton.tsx`
  - Deps: T14
  - Verify: componente compila; props `{ type, id }` tipadas; toast.success/error/warning usados

- [x] T18 Adicionar toast warning em AddItemForm e CloseComandaDialog
  - Service: frontend
  - Files: `components/comandas/AddItemForm.tsx`, `components/comandas/CloseComandaDialog.tsx`
  - Deps: T09, T16
  - Verify: `npm run typecheck` passa; `if (res.printWarning) toast.warning(...)` presente

- [x] T19 Adicionar ReprintButton em ComandaItemPanel (por linha de item)
  - Service: frontend
  - Files: `components/comandas/ComandaItemPanel.tsx`
  - Deps: T17
  - Verify: `npm run typecheck` passa; ReprintButton renderizado com type="cozinha"

- [x] T20 Adicionar ReprintButton em ComandaHistory (quando saleId não nulo)
  - Service: frontend
  - Files: `components/comandas/ComandaHistory.tsx`
  - Deps: T17
  - Verify: `npm run typecheck` passa; ReprintButton renderizado com type="cupom" condicional

- [x] T21 Rodar suite completa de testes com DB (T04-T07, T14, T16, T22-T25)
  - Service: test
  - Files: `lib/services/print/print-service.test.ts`
  - Deps: T08, T03
  - Verify: `npm test` com DATABASE_URL definido — todos os 30 testes passam (18 unit + 10 DB + 2 action)

## Acceptance Checklist

- [x] `addComandaItem` chama `tryKitchenPrint` após commit da tx de banco (RF01, RN04)
- [x] Pedido de cozinha contém `orderNum`, `comandaLabel`, `name`, `quantity`, `unit`, `observation` (RF01)
- [x] `observation: null` é passado ao driver sem transformação (RF01)
- [x] `getNextKitchenOrderNum` retorna 1 no primeiro call do dia; rende `#001` no slip (RF02)
- [x] Dois calls consecutivos retornam 1 e 2; atomic upsert sem race condition (RF02, RN02)
- [x] Sequencial reinicia a 1 em novo dia (UTC-3); isolado por tenant (RF02, RN02)
- [x] 5 calls concorrentes retornam 5 números distintos sem duplicata (RN02)
- [x] `closeComanda` chama `tryReceiptPrint` com `tenantName` resolvido pós-tx (RF03, RN08)
- [x] `finalizeSale` chama `tryReceiptPrint` com `tenantName` resolvido pós-tx (RF03, RN08)
- [x] Cupom contém `tenantName`, `items`, `totalCents`, `paymentMethod`, `createdAt` (RF03)
- [x] `paymentMethod: "fiado"` inclui `customerName` no `ReceiptData` (RF03)
- [x] `ReceiptData` não contém campos `cnpj`, `cpf`, `icms`, `sefazKey` (RF04, RN05)
- [x] `tryKitchenPrint` retorna `{ success: false }` quando driver lança; não relança (RF05, RN04)
- [x] `tryReceiptPrint` retorna `{ success: false }` quando driver lança; não relança (RF05, RN04)
- [x] `PRINTER_DEVICE` ausente → `{ success: false }`, log `status='falhou'` (RF05, RN06)
- [x] `addComandaItemAction` com print fail retorna `ok: true` e `printWarning` preenchido (RF05)
- [x] Toast de aviso exibido em `AddItemForm` quando `res.printWarning` presente (RF05)
- [x] Toast de aviso exibido em `CloseComandaDialog` quando `res.printWarning` presente (RF05)
- [x] `printKitchenSlip` chamado exatamente 1× sem retry em caso de falha (RF06)
- [x] `reprintKitchen(ctx, comandaItemId)` chama driver e insere log `status='ok'` (RF07)
- [x] `reprintReceipt(ctx, saleId)` chama driver e insere log `status='ok'` (RF07)
- [x] Reimpressão usa dados imutáveis; não incrementa `kitchen_order_seq` (RF07, RN03)
- [x] UUID inválido em `reprintKitchenAction` retorna `ok: false`; serviço não chamado (RF07)
- [x] `ReprintButton` visível por linha de item em `ComandaItemPanel` (RF07)
- [x] `ReprintButton` visível em `ComandaHistory` quando `saleId !== null` (RF07)
- [x] `print_logs` row inserida com `status='ok'` em print bem-sucedido (RF08)
- [x] Row contém `tenant_id`, `type`, `trigger_id`, `printed_by`, `printed_at` não-nulos (RF08)
- [x] `print_logs` row inserida com `status='falhou'` e `error_message` em falha (RF08)
- [x] TenantB não vê logs de TenantA via RLS em `selectPrintLogsByTrigger` (RN01)
- [x] Linha de venda existe no DB antes do driver ser invocado (RN04)
- [x] Dois `tryKitchenPrint` consecutivos são sequenciais; segundo aguarda o primeiro (RN06)
- [x] `ReceiptData.tenantName` igual ao campo `name` lido da tabela `tenants` (RN08)
- [x] Feature documentada como incompatível com Vercel serverless (RN07)

## Validation Gates

- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm run lint` and fix failures in files touched by this work (0 errors, 0 warnings)
- [x] Run `npm test` and fix failures in files touched by this work (280/280 pass)
- [x] Run `npm run build` and fix failures (build succeeds)
