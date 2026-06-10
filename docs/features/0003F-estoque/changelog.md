---
id: 0004CHG
type: changelog
slug: estoque
created: 2026-06-10
related: [0003F, 0001F, 0002F]
---

# Changelog: Estoque — 0003F

## Summary

Entrega o controle de **estoque** do SAAS PDV.multi: registrar **entradas** (compra/reposição), corrigir por **ajuste de inventário** (contagem real), e ter **histórico** de todas as movimentações por produto, filtrável por tipo e período. A venda (0002F) passou a registrar automaticamente uma movimentação de **saída** (retrofit). Cada produto pode ter um **nível mínimo**; os abaixo do mínimo aparecem na tela de **estoque baixo**, e itens com estoque negativo são realçados na lista de produtos. Recurso #4 do roadmap (Fase 2 — Controlar).

## What Changed

### Database
- Tabela `stock_movements` (delta assinado: entrada +, saída −, ajuste ±; CHECK de tipo e de sinal; `sale_id` para rastrear saídas de venda; `tenant_id` para RLS) + campo `min_stock numeric(10,3)` (nullable) em `products`.
- RLS (`0003_stock_rls.sql`): policy `tenant_isolation` em `stock_movements`.

### Backend
- Data layer de estoque (`lib/services/stock/data.ts`): inserir movimento, listar com filtros (tipo/período, com guarda de datas inválidas), `recordSaleExit`. Em `products/data.ts`: `adjustProductStock`, `setProductStock`, `setProductMinStock`, `selectLowStockProducts`.
- Serviço transacional (`stock-service.ts`): entrada (+delta), ajuste (seta o estoque direto na contagem — sem drift de float), histórico, mínimo, estoque baixo — tudo na mesma transação `withUserRls`.
- **Retrofit:** `finalizeSale` (0002F) troca a baixa crua por `recordSaleExit` (movimento `saída` + baixa) na transação da venda. `min_stock` threaded pelo create/update do produto.
- 5 Server Actions (`app/(app)/estoque/actions.ts`); schemas Zod (`lib/validation/stock.ts`); tipos (`types/stock.ts`).

### Frontend
- `/estoque` (estoque baixo + `StockMovementDialog` para entrada/ajuste com `ProductPicker`), `/estoque/[id]` (`MovementHistory` filtrável por tipo e período, com loading/erro).
- `ProductForm` ganha campo de estoque mínimo; `ProductsTable` realça estoque negativo; link "Estoque" no header.

## Requirements Delivered

- **RF01–RF08:** entrada, ajuste por contagem, venda→saída, log completo, histórico filtrável, nível mínimo, tela de estoque baixo, realce de negativo.
- **RN01–RN08:** isolamento por tenant (RLS), estoque como fonte + log atômico, qtd>0/contagem≥0, atribuição ao usuário logado, estoque negativo permitido, mínimo opcional, numeric(10,3), saída referencia `sale_id`.

## Tests

99 testes verdes (Vitest) — inclui integração/RLS contra o Postgres local e a regressão da venda com o retrofit. Gates: typecheck 0, lint 0, build 0.

## Notes & Decisions

- Ajuste **seta** o estoque na contagem (em vez de somar delta) para evitar artefato de float em `numeric(10,3)`.
- CHECK de sinal por tipo no banco como última linha de defesa.
- Adiados (ver `review.md`): limpar `min_stock` pela tela de edição; fuso horário nas datas (feature #6); dinheiro/valorização de estoque (feature #6).

## Quick Ref

```json
{"id":"0003F","domain":"PDV / estoque (inventory)","touched":["db/schema/","db/migrations/","lib/services/stock/","lib/services/products/","lib/services/sales/","lib/validation/","app/(app)/estoque/","components/estoque/","components/products/","types/"],"patterns":["server-actions","rls-multitenancy","transactional-service","signed-delta-ledger","retrofit-integration"],"keywords":["estoque","movimentacao","entrada","ajuste","inventario","estoque-baixo","historico"]}
```
