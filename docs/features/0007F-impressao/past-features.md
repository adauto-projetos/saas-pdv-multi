# Past Features — 0007F Impressão

## Related Features

| Feature | Slug | Relationship | Key Files/Patterns |
|---------|------|-------------|-------------------|
| 0006F | comanda-mesa | integration (print trigger: addComandaItem, closeComanda) | `lib/services/comanda/comanda-service.ts`, `types/comanda.ts` |
| 0002F | venda-rapida-mercado | integration (print trigger: finalizeSale) | `lib/services/sales/sale-service.ts`, `types/sale.ts` |
| 0004F | financeiro | reuse (customer name para fiado; payment method label) | `lib/services/finance/customer-data.ts` |
| 0005F | lucro-fechamento | reuse (cost snapshot, session context) | `lib/services/profit/cash-session-data.ts` |
| 0001F | produtos | depends-on (product name, unit, barcode para receipt) | `lib/services/products/data.ts` |

## Details

### 0006F — Comanda/Mesa
- **Relationship:** Integração direta — dois triggers de impressão
  1. `addComandaItem` → comanda de cozinha (item adicionado à ordem)
  2. `closeComanda` → recibo final (comanda vira venda)
- **Relevant scope:** Items com `observation` (ex: "sem cebola") é dado crítico para cozinha; snapshot de preço/custo já disponível no fechamento.
- **Key files:** `comanda-service.ts`, `comanda-data.ts`, `types/comanda.ts` (`ComandaItemDto.observation`)
- **Reusable:** Estrutura ComandaDto/ComandaItemDto; padrão `withUserRls` tx atômica

### 0002F — Venda Rápida (Mercado)
- **Relationship:** Integração — `finalizeSale` é o trigger para cupom fiscal de venda direta
- **Relevant scope:** `sale_items` já tem snapshot (nameSnapshot, unitPriceCents, costCentsSnapshot); paymentMethod disponível
- **Key files:** `sale-service.ts` (`finalizeSale`), `types/sale.ts` (`SaleDto`, `SaleItemDto`)
- **Reusable:** SaleDto completo com total, itens, método de pagamento — template de receipt pronto

### 0004F — Financeiro
- **Relationship:** Reuso — customer lookup para fiado; label de pagamento
- **Key files:** `lib/services/finance/customer-data.ts`
- **Reusable:** `selectCustomerById` → nome do cliente no recibo de fiado

### 0005F — Lucro/Fechamento
- **Relationship:** Reuso — `selectOpenSessionId` para vincular print à sessão; costCentsSnapshot para fiscal
- **Key files:** `lib/services/profit/cash-session-data.ts`
- **Reusable:** sessionId para numeração sequencial de recibos por turno

## Summary

A impressão (0007F) tem dois fluxos de trigger: **cozinha** (quando item é lançado na comanda — 0006F) e **fiscal/recibo** (quando venda é finalizada — 0002F direto ou 0006F via closeComanda). Todos os dados necessários para o template de impressão (produto, quantidade, observação, preço, pagamento, cliente) já estão disponíveis nas DTOs existentes. O que falta é a integração com hardware de impressora e a configuração por tenant.
