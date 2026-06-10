---
id: 0003F
type: feature-plan
slug: estoque
status: planned
created: 2026-06-10
updated: 2026-06-10
related: [0003F, 0001F, 0002F, PRODUCT, OWNER]
---

# Plan: 0003F — Estoque

## TL;DR

Plano técnico de {{doc:0003F}} — movimentação de estoque. Acrescenta 1 tabela (`stock_movements`) e 1 campo em `products` (`min_stock`). Cada movimentação **ajusta `products.stock_quantity` e grava o log na MESMA transação `withUserRls`** (RN02). A `quantity` da movimentação é o **delta assinado** aplicado (entrada +, saída −, ajuste = contagem − atual), o que dá histórico legível e auditoria. **Retrofit:** o `finalizeSale` (0002F) troca a baixa crua por `recordSaleExit` (grava `saída` + ajusta), tudo na transação da venda.

## Overview

A fundação (0001F produtos + 0002F venda) está na `master`. O Estoque reaproveita `products.stock_quantity`, `withUserRls`, o data layer `Executor`, `ActionResult` e os padrões de UI. Novo: serviço de movimentação transacional, tela de estoque baixo, histórico por produto, campo de nível mínimo no produto, e realce de estoque negativo na lista existente.

## Architecture Decisions

| Decision | Rationale | Alternative rejected | Triggering constraint |
|---|---|---|---|
| `quantity` = delta assinado | Soma audita o estoque; histórico mostra +/- | Magnitude + sinal por tipo — cálculo espalhado | RN02 (consistência), RF05 (histórico) |
| `stock_quantity` continua a fonte; movimento ajusta na mesma tx | Consistência atômica; sem refactor de leitura | Estoque derivado da soma — refactor grande | RN02 |
| Ajuste por contagem: delta = contagem − atual | Fluxo natural de inventário | Digitar a diferença — exige cálculo mental | RF02/3.5 |
| Retrofit: `finalizeSale` chama `recordSaleExit` | A venda passa a registrar saída sem duplicar baixa | Trigger no banco — lógica escondida | RF03/RN08 |
| `min_stock` nullable em `products` | Nível mínimo opcional por produto | Tabela à parte — over-engineering | RF06/RN06 |
| Estoque pode ficar negativo (sem bloqueio) | Herdado da 0002F; ajuste corrige | Bloquear saída — trava o caixa | RN05 |

## Main Flow

1. **Entrada (RF01):** /estoque → "Nova movimentação" → seleciona produto + tipo `entrada` + qtd + motivo → `recordEntry` (delta +qtd) → estoque sobe + log.
2. **Ajuste (RF02):** seleciona produto + `ajuste` + **contagem real** → `recordAdjustment` (delta = contagem − atual) → estoque = contagem + log.
3. **Venda (RF03):** `finalizeSale` (0002F) → para cada item, `recordSaleExit` (delta −qtd, `sale_id`) → estoque baixa + log `saída`.
4. **Mínimo (RF06):** editar produto (0001F) → campo `min_stock`.
5. **Estoque baixo (RF07):** /estoque lista produtos com `stock_quantity ≤ min_stock`.
6. **Histórico (RF05):** /estoque/[id] → movimentações do produto, filtro tipo/período.
7. **Negativo (RF08):** /products realça em vermelho `stock_quantity < 0`.

## Implementation Order

Database (`stock_movements` + `min_stock` + RLS) → Backend (data layer, serviço, retrofit do finalizeSale, actions, validação) → Frontend (movimentação, estoque baixo, histórico, campo min_stock, realce).

---

## Test Specification

### Contract Tests (from RFs/RNs)

| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | Entrada sobe estoque + grava log | backend | RF01 | recordEntry(prod, 10, "compra") | stock += 10; 1 movimento entrada | delta +10 persistido |
| T02 | Entrada qtd ≤ 0 rejeitada | backend | RN03 | recordEntry(prod, 0) | ValidationError | rejeita |
| T03 | Ajuste acerta estoque pela contagem | backend | RF02 | stock 8, recordAdjustment(prod, 5) | stock = 5; movimento ajuste delta −3 | contagem vira estoque |
| T04 | Ajuste contagem negativa rejeitada | backend | RN03 | recordAdjustment(prod, -1) | ValidationError | rejeita |
| T05 | Venda registra saída + baixa | backend | RF03/RN08 | finalizeSale 1 item qtd 3 | stock −3; movimento saida com sale_id | log saída referencia venda |
| T06 | Movimento ajusta estoque na mesma tx | backend | RN02 | recordEntry | stock_after = before + delta | atômico |
| T07 | Movimento grava tipo/qtd/motivo/usuário | backend | RN04 | recordEntry(...,"compra") | movimento com user_id + reason | campos persistidos |
| T08 | Histórico do produto retorna movimentos | backend | RF05 | listMovements(prod) | StockMovementDto[] desc | ordenado por data |
| T09 | Histórico filtra por tipo | backend | RF05 | listMovements(prod, type=entrada) | só entradas | filtro aplicado |
| T10 | Define min_stock do produto | backend | RF06 | setMinStock(prod, 5) | product.minStock = 5 | persistido (nullable) |
| T11 | Lista estoque baixo (≤ min) | backend | RF07 | stock 2, min 5 → listLowStock | inclui o produto | filtra ≤ min, min not null |
| T12 | Produto sem min não dispara alerta | backend | RN06 | min null | não aparece em lowStock | ignorado |
| T13 | Estoque pode ficar negativo | backend | RN05 | saída > estoque | stock < 0, sem erro | não bloqueia |
| T14 | Movimentação isolada por tenant | database | RN01 | listar como tenant A | sem movimentos de B | RLS bloqueia |
| T15 | tenant/user vêm da sessão | backend | RN01/RN04 | recordEntry forjando tenant | usa sessão | input ignorado |
| T16 | Quantidade respeita numeric(10,3) | backend | RN07 | entrada 0.750 kg | delta 0.750 | fração preservada |
| T17 | Dialog de movimentação valida e envia | frontend | RF01/RF02 | submit entrada | chama action | action chamada |
| T18 | Lista de estoque baixo renderiza | frontend | RF07 | lowStock data | linhas com produto/qtd/min | render correto |
| T19 | min_stock editável no ProductForm | frontend | RF06 | edита produto | campo min_stock presente | valor enviado |
| T20 | ProductsTable realça negativo | frontend | RF08 | stock −2 | célula destacada | classe/realce |

### Test File Mapping

| Area | Test File | Test IDs |
|------|-----------|----------|
| backend | lib/services/stock/stock-service.test.ts | T01,T02,T03,T04,T06,T07,T08,T09,T10,T11,T12,T13,T15,T16 |
| backend | lib/services/sales/sale-service.test.ts (retrofit) | T05 |
| backend | lib/validation/stock.test.ts | T02,T04 |
| database | db/__tests__/stock-rls.test.ts | T14 |
| frontend | components/estoque/StockMovementDialog.test.tsx | T17 |
| frontend | components/estoque/LowStockList.test.tsx | T18 |
| frontend | components/products/ProductForm.test.tsx (min_stock) | T19 |
| frontend | components/products/ProductsTable.test.tsx (negativo) | T20 |

### Coverage vs Requirements

100% — ver tabela Requirements Coverage abaixo.

---

## Database

### Entities

| Entity | Table | Key Fields | Reference |
|--------|-------|------------|-----------|
| Movimentação | `stock_movements` | `id uuid PK`, `tenant_id FK→tenants NOT NULL`, `product_id FK→products CASCADE NOT NULL`, `type text NOT NULL CHECK in('entrada','saida','ajuste')`, `quantity numeric(10,3) NOT NULL`, `reason text`, `sale_id uuid FK→sales SET NULL`, `user_id uuid FK→users NOT NULL`, `created_at timestamptz DEFAULT now()` | `db/schema/sale-items.ts` |
| Produto (alter) | `products` | + `min_stock numeric(10,3)` (NULLABLE) | `db/schema/products.ts` |

### Migration
- **Alter** `products`: add `min_stock numeric(10,3)` NULLABLE (RF06/RN06).
- **Create** `stock_movements` (`db/schema/stock-movements.ts`; barrel). `quantity` = delta assinado (entrada +, saída −, ajuste ±).
- **Index**: `stock_movements(tenant_id, product_id, created_at)` (histórico), `stock_movements(tenant_id)`.
- **RLS** (`db/migrations/0003_stock_rls.sql`, aplicado por `db:rls`): policy `tenant_isolation` (TO app_user) em `stock_movements`. Grants cobertos por `ALTER DEFAULT PRIVILEGES`.

### Repository / Data access
| Method | Purpose |
|--------|---------|
| `adjustProductStock(tx, tenantId, productId, delta)` *(products/data.ts)* | Soma `delta` ao `stock_quantity` (delta ±) |
| `setProductMinStock(tx, tenantId, productId, minStock)` *(products/data.ts)* | Define `min_stock` (RF06) |
| `selectLowStockProducts(tx, tenantId)` *(products/data.ts)* | Produtos com `stock_quantity ≤ min_stock` e min não-nulo (RF07) |
| `insertMovement(tx, tenantId, data)` | Insere a linha de movimentação |
| `selectMovements(tx, tenantId, productId, filters)` | Histórico filtrável (RF05) |
| `recordSaleExit(tx, tenantId, userId, productId, qty, saleId)` | Saída da venda: movimento `saida` + ajuste (−qty) |

---

## Backend

### Server Actions
| Action | Input DTO | Output DTO | Purpose |
|--------|-----------|------------|---------|
| recordEntryAction | StockEntryInput | StockMovementDto | RF01 — entrada |
| recordAdjustmentAction | StockAdjustmentInput | StockMovementDto | RF02 — ajuste por contagem |
| listMovementsAction | MovementFilterInput | StockMovementDto[] | RF05 — histórico |
| setMinStockAction | MinStockInput | ProductDto | RF06 — nível mínimo |
| listLowStockAction | — | ProductDto[] | RF07 — estoque baixo |

### DTOs / Schemas (zod, lib/validation/stock.ts)
| DTO | Fields | Validations |
|-----|--------|-------------|
| StockEntryInput | productId: uuid; quantity: number; reason?: string | quantity > 0 finite (RN03) |
| StockAdjustmentInput | productId: uuid; countedQuantity: number; reason?: string | countedQuantity ≥ 0 finite (RN03) |
| MinStockInput | productId: uuid; minStock: number\|null | minStock ≥ 0 finite ou null (RN06) |
| MovementFilterInput | productId: uuid; type?: 'entrada'\|'saida'\|'ajuste'; from?: string; to?: string | — |
| StockMovementDto | id; productId; type; quantity; reason\|null; saleId\|null; userId; createdAt | — |

### Services (lib/services/stock/)
| Service fn | Responsibility |
|-----------|----------------|
| recordEntry(ctx, input) | `withUserRls`: insertMovement(entrada, +qty) + adjustProductStock(+qty) |
| recordAdjustment(ctx, input) | get produto; delta = counted − stock; insertMovement(ajuste, delta) + set stock = counted |
| listMovements(ctx, filter) / setMinStock(ctx, input) / listLowStock(ctx) | leitura/escrita sob RLS |
| recordSaleExit (data layer, chamada pelo finalizeSale) | movimento `saida`(−qty, saleId) + ajuste, na transação da venda (RF03) |

### Module Structure
`lib/services/stock/` — `data.ts`, `stock-service.ts` · `lib/validation/stock.ts` · `types/stock.ts` · `app/(app)/estoque/actions.ts`. **Retrofit:** `lib/services/sales/sale-service.ts` troca `decrementProductStock` por `recordSaleExit`. Reference: `lib/services/sales/`, `app/(app)/caixa/actions.ts`.

---

## Frontend

### Pages
| Route | Page Component | Purpose |
|-------|----------------|---------|
| /estoque | EstoquePage | Estoque baixo + botão "Nova movimentação" (entrada/ajuste) (RF01/RF02/RF07) |
| /estoque/[id] | MovimentacoesPage | Histórico de movimentações do produto, filtrável (RF05) |

### Components
{"StockMovementDialog":{"location":"components/estoque/","purpose":"form entrada/ajuste: produto, tipo, qtd/contagem, motivo (RF01/RF02)"},"LowStockList":{"location":"components/estoque/","purpose":"tabela de produtos com estoque baixo (RF07)"},"MovementHistory":{"location":"components/estoque/","purpose":"histórico do produto com filtro tipo/período (RF05)"},"ProductPicker":{"location":"components/estoque/","purpose":"busca/seleção de produto (reusa searchProductsAction)"}}
Edições: `components/products/ProductForm.tsx` (+ campo `min_stock`, RF06); `components/products/ProductsTable.tsx` (realce de estoque negativo, RF08); link "Estoque" no header (`app/(app)/layout.tsx`).

### Hooks & State
{"hooks":{},"stores":{}}
Estado de form via `useState` (padrão 0001F); leituras via Server Actions/RSC; toast (sonner) no sucesso/erro.

### Types (mirror from backend)
{"StockMovementDto":{"fields":"id,productId,type,quantity,reason,saleId,userId,createdAt","sourceDTO":"StockMovementDto"},"MovementType":{"fields":"'entrada'|'saida'|'ajuste'","sourceDTO":"-"},"StockEntryInput":{"fields":"productId,quantity,reason","sourceDTO":"StockEntryInput"},"StockAdjustmentInput":{"fields":"productId,countedQuantity,reason","sourceDTO":"StockAdjustmentInput"}}
`ProductDto` ganha `minStock: number|null` (espelha a coluna).

---

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| Retrofit do finalizeSale quebra a venda | Média | Alto | `recordSaleExit` roda na MESMA tx; testes da 0002F + T05 garantem |
| Divergência estoque × movimentos | Média | Médio | Ajuste + movimento na mesma tx (RN02); T06 verifica delta |
| `db:push` derruba RLS (footgun conhecido) | Alta | Alto | Sempre `db:rls`/`db:setup` após push (CLAUDE.md) |
| Sinal do delta trocado (entrada/saída) | Baixa | Médio | Serviço fixa o sinal; T01/T05 cobrem |
| numeric(10,3) como string quebra cálculo | Baixa | Médio | Coerção p/ number na data layer (padrão 0001F) |

## Requirements Coverage

| ID | Requirement | Covered? | Area | Tasks |
|----|-------------|----------|------|-------|
| RF01 | Entrada de estoque | YES | DB+Backend+Frontend | T01, T17 |
| RF02 | Ajuste por contagem | YES | Backend+Frontend | T03, T17 |
| RF03 | Venda registra saída (retrofit) | YES | Backend | T05 |
| RF04 | Movimento grava tipo/qtd/motivo/data/usuário | YES | DB+Backend | T07 |
| RF05 | Histórico por produto (filtrável) | YES | Backend+Frontend | T08, T09 |
| RF06 | Nível mínimo por produto | YES | DB+Backend+Frontend | T10, T19 |
| RF07 | Tela de estoque baixo | YES | Backend+Frontend | T11, T18 |
| RF08 | Realce de estoque negativo na lista | YES | Frontend | T20 |
| RN01 | Isolamento por tenant (RLS) | YES | DB+Backend | T14, T15 |
| RN02 | stock_quantity fonte; ajuste+log na mesma tx | YES | Backend | T06 |
| RN03 | qtd entrada/saída > 0; contagem ≥ 0 | YES | Backend | T02, T04 |
| RN04 | Movimento atribuído ao usuário; tipo/motivo | YES | Backend | T07, T15 |
| RN05 | Estoque pode ficar negativo | YES | Backend | T13 |
| RN06 | min_stock opcional; sem min não alerta | YES | DB+Backend | T12 |
| RN07 | Quantidades em numeric(10,3) por unidade | YES | DB+Backend | T16 |
| RN08 | Saída de venda referencia sale_id | YES | Backend | T05 |

## Quick Reference

| Pattern | Codebase search terms |
|---|---|
| Entity / Schema | `db/schema/stock-movements.ts` (espelhar `sale-items.ts`); `products.min_stock` |
| Data layer | `lib/services/stock/data.ts`, `lib/services/products/data.ts` |
| Service | `lib/services/stock/stock-service.ts` (espelhar `sale-service.ts`) |
| Retrofit | `lib/services/sales/sale-service.ts` (`recordSaleExit`) |
| Validation | `lib/validation/stock.ts` |
| Server actions | `app/(app)/estoque/actions.ts` |
| RLS | `db/migrations/0003_stock_rls.sql`, `withUserRls` |
| UI | `components/estoque/*`, `app/(app)/estoque/*`, `ProductForm`/`ProductsTable` |
