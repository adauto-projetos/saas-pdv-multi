---
id: 0002F
type: feature-plan
slug: venda-rapida-mercado
status: planned
created: 2026-06-09
updated: 2026-06-09
related: [0002F, 0001F, PRODUCT, OWNER]
---

# Plan: 0002F — Venda Rápida (Mercado)

## TL;DR

Plano técnico de {{doc:0002F}} — tela de caixa que vende produtos da {{doc:0001F}}. Acrescenta 2 tabelas (`sales`, `sale_items`), busca de produto por código de barras/nome, e um **serviço de venda transacional** que registra a venda e dá baixa no estoque na MESMA transação `withUserRls`. Headline de segurança: o cliente envia só `productId` + `quantity`; o **servidor** resolve preço/nome/unidade do produto (snapshot — RN02), recalcula subtotal/total e persiste — sem confiar em preço do cliente.

## Overview

A 0001F já entrega produtos (preço em centavos, unidade `un`/`kg`, estoque, código de barras) sob multi-tenancy/RLS e auth local. A 0002F é o checkout: monta carrinho, calcula total ao vivo e finaliza. Reaproveita `withUserRls`, helpers de dinheiro, `ActionResult`, e os padrões de Server Actions/UI da 0001F.

## Architecture Decisions

| Decision | Rationale | Alternative rejected | Triggering constraint |
|---|---|---|---|
| Preço/nome resolvidos no servidor por `productId` | Impede adulteração de preço no cliente; snapshot fiel | Confiar no preço enviado pelo cliente — inseguro | RN02 (snapshot) + segurança |
| `tenant_id` também em `sale_items` | RLS uniforme (mesma política de `products`), sem join na policy | Policy por subquery em `sales` — mais lenta/complexa | RN01 (RLS) |
| Venda + itens + baixa de estoque na MESMA transação | Atomicidade: ou tudo grava, ou nada | Baixar estoque em passo separado — risca inconsistência | RF07 |
| Baixa de estoque sem bloquear venda | Estoque inicial pode estar impreciso; não travar o caixa | Bloquear venda sem estoque — atrapalha operação | RN05 |
| `payment_method` como enum (CHECK) | Rótulo simples alimenta fechamento (#6) | Integração de pagamento — fora do MVP | RN07 / RF06 |
| Carrinho em estado de cliente (`useCart`) | Venda em andamento é volátil; sem persistência | Persistir carrinho no banco — complexidade sem ganho | Scope (carrinho não persiste) |

## Main Flow

1. Operador abre **/caixa** (campo de código já focado).
2. Bipa/digita código → `lookupProductByBarcode` → item entra no carrinho (qtd 1) → foco volta (RF01/RF10).
3. Sem código → busca por nome (`searchProducts`) → seleciona → entra no carrinho (RF02).
4. Item `kg` → operador digita o peso → subtotal = `round(preço × peso)` (RF03/RF05).
5. Ajusta qtd / remove item → total recalcula no cliente (RF04/RF05).
6. **Finalizar** → escolhe forma de pagamento → `finalizeSale` (servidor recalcula tudo, grava venda+itens, baixa estoque) → carrinho limpa (RF06/RF07).
7. Cancelar limpa o carrinho sem gravar (RF08). "Vendas de hoje" lista o dia (RF09).

## Implementation Order

Database (sales/sale_items + RLS) → Backend (validação, serviço transacional, actions, busca) → Frontend (tela de caixa, carrinho, diálogo de pagamento, vendas do dia).

---

## Test Specification

### Contract Tests (from RFs/RNs)

| ID | Test Case | Area | RF/RN | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| T01 | Lookup por código retorna produto | backend | RF01 | barcode existente | ProductDto | preço/unidade corretos |
| T02 | Lookup código inexistente | backend | RF01 | barcode ausente | null | sem erro, null |
| T03 | Busca por nome retorna lista | backend | RF02 | "coca" | ProductDto[] | filtra por nome, tenant |
| T04 | Subtotal por peso (kg) | backend | RF03 | preço 590, qtd 0.75 | subtotal 443 | round(590×0.75) |
| T05 | Total = soma dos subtotais | backend | RF05/RN06 | 2 itens | total = Σ subtotais | inteiro em centavos |
| T06 | Finalizar grava venda + itens | backend | RF07 | items + payment | SaleDto persistido | sale + sale_items inseridos |
| T07 | Finalizar baixa o estoque | backend | RF07 | item qtd 3 | stock -= 3 | products.stock_quantity caiu |
| T08 | Preço é snapshot do servidor | backend | RN02 | client envia preço falso | usa preço do produto | unit_price_cents = produto |
| T09 | Carrinho vazio não finaliza | backend | RN03 | items: [] | ValidationError | rejeita |
| T10 | Quantidade ≤ 0 rejeitada | backend | RN04 | qtd 0 | ValidationError | rejeita |
| T11 | Estoque pode ficar negativo | backend | RN05 | qtd > estoque | venda OK, stock < 0 | não bloqueia |
| T12 | Forma de pagamento inválida | backend | RN07 | payment "boleto" | ValidationError | enum rejeita |
| T13 | Venda atribuída ao usuário | backend | RN08 | finalize como user A | sale.user_id = A | da sessão, não input |
| T14 | Tenant A não vê venda de B | database | RN01 | listar como A | sem vendas de B | RLS bloqueia |
| T15 | Vendas do dia | backend | RF09 | listTodaySales | só vendas de hoje | filtra por data |
| T16 | tenantId vem da sessão | backend | RN01 | finalize forjando tenant | usa tenant da sessão | input ignorado |
| T17 | Carrinho: add/editar/remover | frontend | RF04 | ações no carrinho | itens/total atualizam | estado correto |
| T18 | Foco + Enter adiciona | frontend | RF10 | Enter no código | item add, foco volta | input refocado |
| T19 | Diálogo de pagamento finaliza | frontend | RF06 | confirma forma | chama finalizeSale | action chamada |

### Test File Mapping

| Area | Test File | Test IDs |
|------|-----------|----------|
| backend | lib/services/sales/sale-service.test.ts | T04, T05, T06, T07, T08, T09, T10, T11, T13, T15, T16 |
| backend | lib/services/sales/lookup.test.ts | T01, T02, T03 |
| backend | lib/validation/sale.test.ts | T09, T10, T12 |
| database | db/__tests__/sales-rls.test.ts | T14 |
| frontend | components/caixa/Cart.test.tsx | T17 |
| frontend | components/caixa/BarcodeInput.test.tsx | T18 |
| frontend | components/caixa/PaymentDialog.test.tsx | T19 |

### Coverage vs Requirements

100% — cada RF/RN tem ≥1 caso (ver tabela Requirements Coverage abaixo).

---

## Database

### Entities

| Entity | Table | Key Fields | Reference |
|--------|-------|------------|-----------|
| Venda | `sales` | `id uuid PK`, `tenant_id FK→tenants NOT NULL`, `user_id FK→users NOT NULL`, `total_cents integer NOT NULL`, `payment_method text NOT NULL CHECK in('dinheiro','pix','cartao')`, `created_at timestamptz DEFAULT now()` | `db/schema/products.ts` |
| Item da venda | `sale_items` | `id uuid PK`, `sale_id FK→sales CASCADE NOT NULL`, `tenant_id FK→tenants NOT NULL`, `product_id uuid FK→products ON DELETE SET NULL`, `name_snapshot text NOT NULL`, `unit text NOT NULL`, `unit_price_cents integer NOT NULL`, `quantity numeric(10,3) NOT NULL`, `subtotal_cents integer NOT NULL` | `db/schema/products.ts` |

### Migration
- **Create** `sales` + `sale_items` (Drizzle em `db/schema/sales.ts`, `db/schema/sale-items.ts`; barrel `db/schema/index.ts`).
- **CHECK**: `sales.total_cents >= 0`; `sale_items.subtotal_cents >= 0`, `sale_items.unit_price_cents >= 0`, `sale_items.quantity > 0`; `payment_method in (...)`.
- **Index**: `sales(tenant_id, created_at)` (lista do dia), `sale_items(sale_id)`, `sale_items(tenant_id)`.
- **RLS** (`db/migrations/0002_sales_rls.sql`, aplicado via `db:rls`): habilita RLS + policy `tenant_isolation` (TO app_user, `tenant_id IN (...)`) em `sales` e `sale_items`. Grants já cobertos por `ALTER DEFAULT PRIVILEGES` do 0001.

### Repository / Data access
| Method | Purpose |
|--------|---------|
| `insertSale(tx, tenantId, userId, paymentMethod, totalCents)` | Insere a venda; retorna id |
| `insertSaleItems(tx, tenantId, saleId, items)` | Insere itens (com snapshot) |
| `decrementProductStock(tx, tenantId, productId, qty)` | Baixa estoque do produto |
| `selectSalesOfDay(tx, tenantId, from, to)` | Vendas do dia (RF09) |
| `selectProductByBarcode(tx, tenantId, barcode)` *(em products/data.ts)* | Lookup por código (RF01) |
| `searchProductsByName(tx, tenantId, query, limit)` *(em products/data.ts)* | Busca por nome (RF02) |

---

## Backend

### Server Actions
| Action | Input DTO | Output DTO | Purpose |
|--------|-----------|------------|---------|
| lookupProductByBarcodeAction | { barcode } | ProductDto \| null | RF01 — achar produto por código |
| searchProductsAction | { query } | ProductDto[] | RF02 — buscar por nome |
| finalizeSaleAction | FinalizeSaleInput | SaleDto | RF06/RF07 — registra venda + baixa estoque |
| listTodaySalesAction | — | SaleDto[] | RF09 — vendas do dia |

### DTOs / Schemas (zod, lib/validation/sale.ts)
| DTO | Fields | Validations |
|-----|--------|-------------|
| SaleItemInput | productId: uuid; quantity: number | quantity > 0 (RN04) |
| FinalizeSaleInput | items: SaleItemInput[]; paymentMethod: 'dinheiro'\|'pix'\|'cartao' | items min 1 (RN03); paymentMethod enum (RN07) |
| SaleItemDto | id; productId\|null; name; unit; unitPriceCents; quantity; subtotalCents | — |
| SaleDto | id; tenantId; userId; totalCents; paymentMethod; createdAt; items: SaleItemDto[] | — |

### Services (lib/services/sales/)
| Service fn | Responsibility |
|-----------|----------------|
| finalizeSale(ctx, input) | Em `withUserRls`: resolve cada produto (preço/nome/unidade), calcula `subtotal = round(unitPriceCents × quantity)` e total, insere venda+itens, baixa estoque. tenantId/userId do ctx (RN02/RN08/RF07) |
| listTodaySales(ctx) | Vendas do dia atual do tenant (RF09) |
| lookupProductByBarcode(ctx, barcode) / searchProducts(ctx, query) | Leitura por código/nome (RF01/RF02) |

### Module Structure
`lib/services/sales/` — `data.ts`, `sale-service.ts`, `lookup.ts` · `lib/validation/sale.ts` · `app/(app)/caixa/actions.ts` · `types/sale.ts`. Reference: `lib/services/products/`, `app/(app)/products/actions.ts`.

---

## Frontend

### Pages
| Route | Page Component | Purpose |
|-------|----------------|---------|
| /caixa | CashierPage | Tela de caixa: busca, carrinho, total, finalizar (RF01–RF08, RF10) |
| /vendas | TodaySalesPage | Lista das vendas do dia (RF09) |

### Components
{"BarcodeInput":{"location":"components/caixa/","purpose":"campo código auto-focado; Enter adiciona e refoca (RF01/RF10)"},"ProductSearch":{"location":"components/caixa/","purpose":"busca por nome com dropdown de resultados (RF02)"},"Cart":{"location":"components/caixa/","purpose":"tabela do carrinho: qtd editável, remover, subtotal (RF03/RF04)"},"CartSummary":{"location":"components/caixa/","purpose":"total ao vivo + botão Finalizar/Cancelar (RF05/RF08)"},"PaymentDialog":{"location":"components/caixa/","purpose":"escolher forma de pagamento e confirmar (RF06)"},"TodaySalesList":{"location":"components/caixa/","purpose":"vendas do dia (RF09)"}}

### Hooks & State
{"hooks":{"useCart":{"type":"useReducer (client state)","purpose":"itens, add/updateQty/remove/clear, total derivado; sem persistência"}},"stores":{}}
Server state via Server Actions; mutações chamam a action e limpam o carrinho. Toast (sonner) no sucesso/erro.

### Types (mirror from backend)
{"SaleDto":{"fields":"id,tenantId,userId,totalCents,paymentMethod,createdAt,items","sourceDTO":"SaleDto"},"SaleItemDto":{"fields":"id,productId,name,unit,unitPriceCents,quantity,subtotalCents","sourceDTO":"SaleItemDto"},"FinalizeSaleInput":{"fields":"items,paymentMethod","sourceDTO":"FinalizeSaleInput"},"PaymentMethod":{"fields":"'dinheiro'|'pix'|'cartao'","sourceDTO":"-"}}

---

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| Cliente adultera preço do item | Média | Alto | Servidor resolve preço por `productId` (snapshot); ignora preço do cliente (T08) |
| Baixa de estoque sem atomicidade | Média | Alto | Venda+itens+baixa na mesma transação `withUserRls` (T06/T07) |
| RLS faltando em `sale_items` | Baixa | Alto | `tenant_id` na tabela + policy própria; teste T14 |
| numeric(10,3) trafega como string e quebra cálculo | Baixa | Médio | Coerção explícita p/ number na data layer (padrão da 0001F) |
| Conversão de fuso no "vendas do dia" | Média | Baixo | Calcular início/fim do dia no servidor; cobrir com T15 |

## Requirements Coverage

| ID | Requirement | Covered? | Area | Tasks |
|----|-------------|----------|------|-------|
| RF01 | Adicionar por código de barras | YES | DB + Backend + Frontend | T01, T02, T18 |
| RF02 | Buscar por nome | YES | Backend + Frontend | T03 |
| RF03 | Item por peso (kg) | YES | Backend + Frontend | T04 |
| RF04 | Editar/remover no carrinho | YES | Frontend | T17 |
| RF05 | Subtotal + total ao vivo | YES | Backend + Frontend | T04, T05 |
| RF06 | Finalizar com forma de pagamento | YES | Backend + Frontend | T06, T19 |
| RF07 | Registrar venda + baixar estoque | YES | DB + Backend | T06, T07 |
| RF08 | Cancelar venda em andamento | YES | Frontend | T17 |
| RF09 | Vendas do dia | YES | Backend + Frontend | T15 |
| RF10 | Foco + Enter (bipagem) | YES | Frontend | T18 |
| RN01 | Isolamento por tenant (RLS) | YES | DB (RLS) + Backend | T14, T16 |
| RN02 | Snapshot do preço | YES | Backend | T08 |
| RN03 | Não finalizar carrinho vazio | YES | Backend | T09 |
| RN04 | Quantidade > 0 | YES | Backend | T10 |
| RN05 | Estoque pode ficar negativo | YES | Backend | T11 |
| RN06 | Total em centavos | YES | Backend | T05 |
| RN07 | Forma de pagamento (enum, rótulo) | YES | Backend | T12 |
| RN08 | Venda atribuída ao usuário logado | YES | Backend | T13 |
| RNF01 | Adição/total percebidos como instantâneos | YES | DB (índice) + Frontend | T01 (lookup indexado) |

## Quick Reference

| Pattern | Codebase search terms |
|---|---|
| Entity / Schema | `db/schema/sales.ts`, `db/schema/sale-items.ts` (espelhar `db/schema/products.ts`) |
| Data layer | `lib/services/sales/data.ts`, `lib/services/products/data.ts` |
| Service | `lib/services/sales/sale-service.ts` (espelhar `product-service.ts`) |
| Validation | `lib/validation/sale.ts` (espelhar `product.ts`) |
| Server actions | `app/(app)/caixa/actions.ts` (espelhar `products/actions.ts`) |
| RLS | `db/migrations/0002_sales_rls.sql`, `withUserRls` em `db/rls.ts` |
| UI / carrinho | `components/caixa/*`, `app/(app)/caixa/page.tsx` |
