---
id: 0006F
type: feature-past-features
slug: comanda-mesa
created: 2026-06-12
related: [0001F, 0002F, 0003F, 0004F, 0005F]
---

# Past Features — relação com Comanda/mesa (0006F)

| Feature | Relação | O que reusar / integrar |
|---|---|---|
| {{doc:0002F}} venda-rápida-mercado | **CORE — reuso direto** | `finalizeSale` (sales/sale-service.ts) é o ponto de fechamento: cria `sales`+`sale_items`, baixa estoque, lança caixa/fiado, snapshot de custo. A comanda alimenta esse fluxo no fechamento, mas precisa de uma camada nova de "conta aberta" antes. PaymentDialog/Cart (components/caixa/) servem de espelho de UX. |
| {{doc:0001F}} produtos-markup | **Dependência** | Itens da comanda referenciam `products` (preço/nome/unidade/custo snapshot). Mesmo `selectProductById`. |
| {{doc:0003F}} estoque | **Integração** | Baixa de estoque via `recordSaleExit`. Decisão: baixar ao lançar item ou ao fechar a conta. |
| {{doc:0004F}} financeiro | **Integração (fechamento)** | Ao fechar: `dinheiro`→entrada de caixa, `fiado`→conta a receber (exige cliente). Reusa `insertCashMovement`/`recordSaleReceivable`. |
| {{doc:0005F}} lucro-fechamento | **Integração (fechamento)** | `cost_cents_snapshot` por item gravado no fechamento (mesma tx); entrada de caixa em dinheiro carimba `session_id` do turno aberto via `selectOpenSessionId`. |

## Conclusão

Comanda NÃO é uma `sale` nova solta — é uma **conta aberta** (estado intermediário) que, ao fechar, **desemboca no `finalizeSale` existente** (ou equivalente). O grande delta arquitetural: vendas hoje são atômicas (carrinho→finaliza); comanda é **long-lived** (abre, recebe N itens ao longo do tempo, fecha). Reúsa quase todo o pipeline de fechamento da 0002F+0004F+0005F.
