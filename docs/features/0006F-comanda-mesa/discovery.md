---
id: 0006F
type: feature-discovery
slug: comanda-mesa
created: 2026-06-12
related: [0006F, 0001F, 0002F, 0003F, 0004F, 0005F]
---

## TL;DR

Comanda/mesa é uma **conta aberta** (long-lived) que recebe itens ao longo do atendimento e, no fechamento, desemboca no pipeline atômico já existente da venda ({{doc:0002F}} `finalizeSale` + estoque + financeiro + lucro). O delta novo: tabelas de comanda aberta + itens incrementais + lançar/remover item + fechar. Multi-tenant RLS, centavos.

## Related Features

| Feature | Refs | Tipo |
|---|---|---|
| {{doc:0002F}} | `lib/services/sales/sale-service.ts` (`finalizeSale`), `lib/services/sales/data.ts`, `components/caixa/*` | reuso/extensão |
| {{doc:0001F}} | `lib/services/products/data.ts` (`selectProductById`) | dependência |
| {{doc:0003F}} | `lib/services/stock/data.ts` (`recordSaleExit`) | integração |
| {{doc:0004F}} | `lib/services/finance/cash-data.ts`, `receivable-service.ts` | integração |
| {{doc:0005F}} | `lib/services/profit/cash-session-data.ts` (`selectOpenSessionId`), snapshot custo | integração |

## Reusable Functionality

- **Pipeline de fechamento**: `finalizeSale` já faz sale+items+estoque+caixa/fiado+snapshot numa tx `withUserRls`. A comanda fechada pode chamar essa lógica (ou um irmão que recebe itens já acumulados em vez de um carrinho).
- **Produto snapshot**: preço/nome/unidade/custo resolvidos do `products` no momento do lançamento ou do fechamento (decisão pendente — ver questionário).
- **PaymentDialog** (`components/caixa/PaymentDialog.tsx`): grade dinheiro/pix/cartão/fiado + CustomerPicker p/ fiado — espelho direto para o fechamento.
- **Cart/use-cart** (`components/caixa/`): UX de adicionar/remover item — base para "lançar item na comanda".

## Existing Patterns

- **Atômico vs long-lived**: hoje `sales` nasce pronta. Comanda exige estado `aberta`→`fechada` (espelha `cash_sessions` da 0005F: lifecycle + imutável após fechar + RLS).
- **Ledger/snapshot imutável**: 0003F/0004F/0005F congelam snapshots; comanda deve seguir (item lançado guarda preço/custo).
- **Server Actions → service → data → Drizzle `withUserRls`**; dinheiro em centavos; `tenant_id`/`userId` do ctx.

## Prerequisites Analysis

| Pré-requisito | Status |
|---|---|
| Produtos com preço/custo ({{doc:0001F}}) | ✅ existe |
| Pipeline de venda/estoque/financeiro/lucro | ✅ existe (0002F–0005F) |
| Identidade da comanda (mesa? cliente? rótulo livre?) | ❓ decisão no questionário |
| Momento da baixa de estoque (lançar vs fechar) | ❓ decisão no questionário |
| Múltiplas comandas abertas simultâneas | ❓ decisão no questionário |

## Open Questions (→ questionário STEP 4)

1. Identificação da comanda: número de mesa, cliente, ou rótulo livre?
2. Baixa de estoque ao lançar item ou só ao fechar?
3. Snapshot de preço/custo no lançamento ou no fechamento?
4. Pagamento no fechamento reusa PaymentDialog (dinheiro/pix/cartão/fiado)?
5. Editar/remover item e cancelar comanda aberta?
6. Várias comandas abertas ao mesmo tempo (diferente do turno único da 0005F)?
