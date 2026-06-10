---
id: 0003F
type: feature-discovery
slug: estoque
created: 2026-06-10
updated: 2026-06-10
related: [0003F, 0001F, 0002F]
---

## TL;DR

Análise de codebase para {{doc:0003F}}. A fundação está madura (0001F + 0002F na `master`): produtos com `stock_quantity`, venda que já baixa o estoque, multi-tenancy/RLS, data layer e padrões de UI consolidados. O Estoque **reaproveita quase tudo** e adiciona: 1 tabela (`stock_movements`), 1 campo em `products` (`min_stock`), um serviço de movimentação transacional (ajusta `stock_quantity` + grava log) e a UI (entrada/ajuste, histórico, estoque baixo). Integração-chave: a venda (0002F) passa a registrar a saída.

## Estado do Codebase

- `master` contém 0001F (produtos + markup) e 0002F (venda/caixa). Stack: Next 16 + Drizzle + Postgres (Docker) + Zod v4 + shadcn (Base UI).
- `products.stock_quantity numeric(10,3)` já existe; a venda (`lib/services/sales/sale-service.ts` → `decrementProductStock`) já baixa.
- Padrões consolidados: `withUserRls`, `Executor` data layer, `ActionResult`, Server Actions, tabelas com `tenant_id` + RLS `tenant_isolation`.

## Reaproveitamento

| O quê | Onde | Uso na 0003F |
|---|---|---|
| `products.stock_quantity` / unidade | `db/schema/products.ts` | Fonte do estoque; ganha `min_stock` (nullable) |
| Baixa na venda | `lib/services/sales/sale-service.ts` (`decrementProductStock`) | **Retrofit:** também grava `stock_movements` (saída, sale_id) |
| RLS por transação | `db/rls.ts` (`withUserRls`) | Movimentação ajusta estoque + grava log isolado por loja |
| Data layer / erros / ActionResult | `lib/services/*/data.ts`, `lib/services/errors.ts` | Mesmo padrão |
| Listagem de produtos | `components/products/ProductsTable.tsx` | Estende com destaque de estoque negativo (RF08) |
| Apply-RLS genérico | `scripts/apply-rls.ts` (aplica todos `*_rls.sql`) | Novo `0003_stock_rls.sql` é aplicado automaticamente |

## Pré-requisitos

| Pré-requisito | Status |
|---|---|
| Produtos com `stock_quantity` e unidade | ✅ Feature 0001F |
| Venda que baixa estoque | ✅ Feature 0002F |
| Multi-tenancy / RLS (`app_user`, `current_app_user()`) | ✅ Feature 0001F |
| Tabela `stock_movements` + campo `min_stock` | ⬜ Criar nesta feature |

## Padrões a Estabelecer

- **Movimentação transacional (RN02):** ajustar `products.stock_quantity` e inserir a linha em `stock_movements` na MESMA transação `withUserRls`.
- **Ajuste por contagem (RF02):** `ajuste.quantity` = contagem real − `stock_quantity` atual (pode ser ±); grava a contagem como motivo.
- **Retrofit da venda (RF03/RN08):** `finalizeSale` insere uma `saida` por item com `sale_id` (na mesma transação da venda).
- **Tipos:** coluna `type` text com CHECK `in ('entrada','saida','ajuste')`.

## Related Features

| Feature | Relação | Nota |
|---|---|---|
| 0001F — Produtos | Estende | Adiciona `min_stock`; usa `stock_quantity`/unidade |
| 0002F — Venda rápida | Estende / integra | A baixa da venda passa a registrar movimentação `saída` |
| Lucro/fechamento (#6, Fase 2) | Será consumida por | Usará as movimentações + custo para lucro/valorização |

Refs: {{doc:0003F}}, {{doc:0001F}}, {{doc:0002F}}, {{doc:PRODUCT}}.
