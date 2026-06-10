---
id: 0002F
type: feature-discovery
slug: venda-rapida-mercado
created: 2026-06-09
updated: 2026-06-09
related: [0002F, 0001F]
---

## TL;DR

Análise de codebase para {{doc:0002F}}. Diferente da 0001F (greenfield), agora **há fundação pronta**: produtos, multi-tenancy/RLS, auth local, camada de serviços e padrões de UI. A venda rápida **reaproveita quase tudo** e adiciona: 2 tabelas novas (`sales`, `sale_items`), busca de produto por código de barras, serviço de venda transacional (registra + baixa estoque) e a tela de caixa.

## Estado do Codebase

- App implementado pela 0001F: `db/schema/{products,tenants,tenant_members,users}.ts`, `lib/services/products/*`, `app/(app)/products/*`, auth local (`lib/auth/*`), RLS (`db/rls.ts`).
- Stack: Next 16 (app router, server actions) + Drizzle + Postgres (Docker) + Zod v4 + shadcn (Base UI).
- Padrões consolidados: dinheiro em centavos, `withUserRls`, `ActionResult<T>`, validação Zod na borda, componentes em `components/`.

## Reaproveitamento

| O quê | Onde | Uso na 0002F |
|---|---|---|
| Entidade `products` (preço, unidade, estoque, barcode) | `db/schema/products.ts` | Origem dos itens da venda; snapshot do preço |
| Data layer de produto | `lib/services/products/data.ts` | Estender com `getProductByBarcode(tenantId, code)` |
| RLS por transação | `db/rls.ts` (`withUserRls`) | Venda + baixa de estoque rodam isoladas por loja |
| Erros tipados + ActionResult | `lib/services/errors.ts` | Mesmo padrão nas actions de venda |
| Helpers de dinheiro | `lib/format/money.ts` | Total/subtotal/carrinho formatados |
| Contexto de auth (operador) | `lib/auth.ts` (`requireAuthContext`) | `userId` = operador da venda |
| Padrão de página/componentes | `app/(app)/products/*`, `components/products/*` | Espelhar na tela de caixa |

## Pré-requisitos

| Pré-requisito | Status |
|---|---|
| Produtos cadastrados (preço, unidade, barcode) | ✅ Feature 0001F |
| Multi-tenancy / RLS | ✅ Feature 0001F (`app_user`, `current_app_user()`) |
| Sessão/operador autenticado | ✅ Feature 0001F (auth local) |
| Tabelas de venda (`sales`, `sale_items`) | ⬜ Criar nesta feature |
| Busca de produto por código de barras | ⬜ Criar (data layer) |

## Padrões a Estabelecer

- **Snapshot de preço (RN02):** `sale_items` guarda `unit_price_cents` copiado do produto na hora da venda (não referência viva).
- **Transação venda + baixa de estoque (RF07):** inserir venda + itens e decrementar `products.stock_quantity` na MESMA transação `withUserRls` (atomicidade).
- **Quantidade como `numeric`:** itens por `kg` têm quantidade fracionária (espelha `stock_quantity` da 0001F).
- **Forma de pagamento:** coluna `payment_method` (text, CHECK `in ('dinheiro','pix','cartao')`).

## Related Features

| Feature | Relação | Nota |
|---|---|---|
| 0001F — Produtos + markup | Consome | Usa preço, unidade, estoque e código de barras |
| Estoque (#4, Fase 2) | Será consumida por / estende | A baixa simples daqui evolui para movimentação + alerta |
| Lucro/fechamento (#6, Fase 2) | Consome | Usa total da venda e custo do produto para lucro real |
| Comanda/mesa (#3, Fase 1) | Irmã | Outro modo de venda (hospitalidade); compartilha conceito de itens/total |

Refs: {{doc:0002F}}, {{doc:0001F}}, {{doc:PRODUCT}}.
