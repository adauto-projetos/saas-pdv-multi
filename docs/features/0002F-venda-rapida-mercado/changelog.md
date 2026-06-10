---
id: 0003CHG
type: changelog
slug: venda-rapida-mercado
created: 2026-06-10
related: [0002F, 0001F]
---

# Changelog: Venda Rápida (Mercado) — 0002F

## Summary

Entrega a **tela de caixa/checkout** do SAAS PDV.multi: o operador registra vendas bipando código de barras ou buscando por nome, vende por unidade ou por peso (kg), monta um carrinho editável com total ao vivo e finaliza escolhendo a forma de pagamento. Ao finalizar, a venda é registrada e o estoque baixa — tudo numa transação isolada por loja (RLS). É o recurso #2 do roadmap (Fase 1 — Vender), construído 100% sobre a fundação da feature 0001F.

## What Changed

### Database
- Tabelas `sales` e `sale_items` (dinheiro em centavos, `payment_method` enum via CHECK, snapshot de preço/nome em `sale_items`, `tenant_id` em ambas para RLS uniforme, CHECKs de não-negatividade/quantidade/unit).
- RLS (`db/migrations/0002_sales_rls.sql`): policy `tenant_isolation` em `sales` e `sale_items` para o papel `app_user`.
- `scripts/apply-rls.ts` agora aplica todos os `db/migrations/*_rls.sql` em ordem.

### Backend
- Data layer de vendas (`lib/services/sales/data.ts`): inserir venda + itens, baixar estoque, listar vendas do dia. Lookup de produto por código de barras e por nome (estendido em `products/data.ts`).
- Serviço transacional (`sale-service.ts`): **o servidor resolve preço/nome do produto** (snapshot, RN02), recalcula subtotal/total, grava venda+itens e baixa estoque na mesma transação `withUserRls`; mescla itens duplicados.
- Schemas Zod (`lib/validation/sale.ts`) e tipos (`types/sale.ts`).
- 4 Server Actions (`app/(app)/caixa/actions.ts`): lookup por código, busca por nome, finalizar venda, vendas do dia.

### Frontend
- Tela `/caixa` (`CashierScreen`) com layout responsivo: `BarcodeInput` (auto-foco + Enter), `ProductSearch` (combobox acessível), `Cart` (qtd editável, remover), `CartSummary` (total ao vivo + finalizar/cancelar), `PaymentDialog`.
- Hook `use-cart` (estado volátil via `useReducer`).
- Página `/vendas` + `TodaySalesList` (vendas do dia). Links Caixa/Vendas no header.

## Requirements Delivered

- **RF01–RF10:** código de barras, busca por nome, peso (kg), editar/remover, total ao vivo, finalizar com pagamento, registrar+baixar estoque, cancelar, vendas do dia, foco+Enter.
- **RN01–RN08:** isolamento por tenant (RLS), snapshot de preço, carrinho não-vazio, qtd > 0, estoque pode ficar negativo, total em centavos, forma de pagamento enum, venda atribuída ao usuário logado.
- **RNF01:** lookup por código via índice `(tenant_id, barcode)`.

## Tests

78 testes verdes (Vitest) — inclui integração e RLS contra o Postgres local (T01–T19). Gates: typecheck 0, lint 0, build 0.

## Notes & Decisions

- Segurança: o cliente envia só `{ productId, quantity }`; preço nunca vem do cliente.
- Pagamento é só rótulo (sem integração) — fora do MVP.
- Adiados (ver `review.md`): fuso horário em "vendas do dia" (feature #6), navegação por seta no dropdown de busca, AlertDialog→Dialog no pagamento.
- Footgun documentado: `drizzle-kit push` derruba as RLS policies — rodar `npm run db:rls` depois (ou `db:setup`).

## Quick Ref

```json
{"id":"0002F","domain":"PDV / venda (checkout)","touched":["db/schema/","db/migrations/","lib/services/sales/","lib/validation/","app/(app)/caixa/","app/(app)/vendas/","components/caixa/","types/"],"patterns":["server-actions","rls-multitenancy","transactional-service","price-snapshot","useReducer-cart"],"keywords":["caixa","checkout","venda","codigo-de-barras","carrinho","estoque","pagamento"]}
```
