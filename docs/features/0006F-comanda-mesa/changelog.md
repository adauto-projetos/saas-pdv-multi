---
id: CHG0007
type: changelog
slug: comanda-mesa
feature: 0006F
created: 2026-06-13
related: [0006F, 0002F, 0003F, 0004F, 0005F]
---

# Changelog — Comanda/Mesa (0006F)

Fecha a **Fase 1 (Vender)** do roadmap com o recurso #3: **comanda/mesa** para o lado bar/lanchonete. O operador abre uma conta com rótulo livre, lança itens ao longo do atendimento (baixando estoque no ato), vê o total parcial ao vivo, e fecha escolhendo a forma de pagamento — convertendo a comanda em venda e integrando automaticamente com caixa, fiado e lucro.

## O que muda

### Banco de dados — novas tabelas e colunas

- **`comandas`** — tabela de lifecycle (aberta→fechada|cancelada): `id`, `tenant_id`, `label`, `status`, `opened_by/at`, `closed_by/at`, `sale_id`. Índice `(tenant_id, status)` para listagem rápida. Sem unique parcial — várias abertas por tenant (RN04).
- **`comanda_items`** — itens sem coluna de preço (snapshot só no fechamento — RN05): `comanda_id`, `product_id`, `quantity numeric(10,3)`, `observation`. CHECK `quantity > 0`.
- **`stock_movements.comanda_id`** — UUID nullable (sem FK declarada, mirror `cash_movements`). Identifica o movimento de estoque como oriundo de um lançamento/estorno de comanda antes da venda existir.
- **`sales.comanda_id`** — UUID nullable. Back-link de auditoria: qual venda veio do fechamento de qual comanda.
- **`db/migrations/0006_comanda_rls.sql`** — RLS: `ENABLE ROW LEVEL SECURITY` + política `tenant_isolation` em `comandas` e `comanda_items`, idêntico ao padrão de 0005F.

### Backend — serviço e integração

- **`lib/services/comanda/comanda-data.ts`** — repositório: `insertComanda`, `selectComandaById`, `selectOpenComandas` (LEFT JOIN products, total parcial via preço corrente — RNF01), `insertComandaItem`, `deleteComandaItem`, `closeComandaRow`, `cancelComandaRow`, `selectComandaHistory`. LEFT JOIN (não INNER) preserva itens de produto removido do catálogo para que o serviço possa rejeitar o fechamento com erro acionável.
- **`lib/services/comanda/comanda-service.ts`** — 8 funções de serviço, todas em `withUserRls` tx (RNF02):
  - `openComanda` — sem conflito de abertura (RN04)
  - `addComandaItem` — insere item + `recordComandaExit` na mesma tx (RN03, RNF02)
  - `removeComandaItem` — `recordComandaEstorno` + delete atomicamente (RF03)
  - `cancelComanda` — estorna todos os itens, status `cancelada`, sem venda (RF04, RN06)
  - `closeComanda` — snapshot de preço/custo no fechamento via `selectProductById` (RN05); `insertSale` + `insertSaleItems` + `closeComandaRow` + caixa/fiado; **não** chama `recordSaleExit` (RN08); vincula sessão de caixa se houver (RN09)
  - `getComanda`, `listOpenComandas`, `listComandaHistory`
- **`lib/services/stock/data.ts`** — novas funções `recordComandaExit` (−qty, carimba `comanda_id`) e `recordComandaEstorno` (+qty inverso). Campo `comandaId?` opcional adicionado ao input de `insertMovement`.
- **`lib/services/sales/data.ts`** — `insertSale` ganha parâmetro opcional `comandaId` para gravar o back-link.
- **`lib/validation/comanda.ts`** — 6 schemas zod: `openComandaSchema`, `addComandaItemSchema`, `removeComandaItemSchema`, `comandaIdSchema`, `closeComandaSchema` (`.refine` fiado⇒customerId — RN07), `comandaFilterSchema`.
- **`types/comanda.ts`** — `ComandaStatus`, `ComandaItemDto`, `ComandaDto`, `ComandaSummaryDto`.
- **`app/(app)/comandas/actions.ts`** — 8 Server Actions: `openComandaAction`, `addComandaItemAction`, `removeComandaItemAction`, `cancelComandaAction`, `closeComandaAction`, `getComandaAction`, `listOpenComandasAction`, `listComandaHistoryAction`.

### Frontend — tela de comandas

- **`app/(app)/comandas/page.tsx`** — RSC `force-dynamic`; carrega abertas via `listOpenComandasAction`; fallback `text-destructive` se erro.
- **`components/comandas/ComandasScreen`** — raiz client: grade de abertas + `OpenComandaDialog` + seção de histórico.
- **`components/comandas/OpenComandaDialog`** — input de rótulo livre → `openComandaAction` → refresh (mirror `OpenSessionDialog`).
- **`components/comandas/ComandaCard`** — label, status badge, total parcial, aberta em; ações: lançar item (expande `ComandaItemPanel`), fechar (`CloseComandaDialog`), cancelar (AlertDialog confirm).
- **`components/comandas/ComandaItemPanel`** — lista de itens com observação e subtotal; `AddItemForm`; `removeComandaItemAction` por item (AlertDialog).
- **`components/comandas/AddItemForm`** — reutiliza `BarcodeInput` + `ProductSearch` do caixa; `QuantityInput`; campo de observação opcional.
- **`components/comandas/CloseComandaDialog`** — AlertDialog (abandon não fecha — RF06); total parcial informativo + aviso de divergência; 4 métodos de pagamento; `CustomerPicker` para fiado.
- **`components/comandas/ComandaHistory`** — tabela filtrável (from/to); `useEffect` + cleanup `active` (mirror `SessionHistory`); colunas: identificação, status, datas, link para venda.
- **`app/(app)/layout.tsx`** — link "Comandas" adicionado ao nav após Caixa.

### Testes

- **`lib/services/comanda/comanda-service.test.ts`** — 36 testes de integração (HAS_DB); cobre todos os `comanda-*` do TDD spec: lifecycle, estoque, parcial, fechamento (snapshot, caixa, fiado, sem re-baixa), imutabilidade, listas.
- **`db/__tests__/comanda-rls.test.ts`** — isolamento cross-tenant para `comandas` e `comanda_items`.
- **`lib/validation/comanda.test.ts`** — 24 testes zod puro (sempre rodados); cobre todos os `val-*`.
- **`db/__tests__/seed.ts`** — helpers: `seedComanda`, `seedComandaItem`, `setProductPrice`, `getProductStock`.

## Regras de negócio preservadas

| Regra | Comportamento |
|---|---|
| RN03 | Estoque baixa ao lançar; estorna ao remover/cancelar; pode ficar negativo |
| RN04 | Várias comandas abertas simultâneas por tenant (sem conflito) |
| RN05 | `comanda_items` sem preço congelado; snapshot lido no fechamento |
| RN06 | Fechada/cancelada imutável — add/remove/cancel/reclose rejeitados |
| RN07 | Fechar exige ≥1 item; fiado exige cliente (zod `.refine` + service guard) |
| RN08 | `closeComanda` não chama `recordSaleExit` — evita baixa dupla de estoque |
| RN09 | Dinheiro vincula sessão de caixa se houver turno aberto; sem bloqueio se não |

## Validação

- `npm run typecheck` · `npm run lint` · `npm test` (250/250) · `npm run build` — todos exit 0.
- Revisão de código: score 9/10; 2 auto-correções (LEFT JOIN, split de teste RF08).

## Quick Ref

```json
{
  "id": "0006F",
  "domain": "comanda mesa bar",
  "touched": [
    "app/(app)/comandas/",
    "components/comandas/",
    "lib/services/comanda/",
    "lib/services/stock/",
    "lib/services/sales/",
    "lib/validation/",
    "types/",
    "db/schema/",
    "db/migrations/",
    "db/__tests__/"
  ],
  "patterns": [
    "lifecycle-table",
    "rls-row-level-security",
    "server-actions",
    "atomic-transaction",
    "snapshot-at-close",
    "ledger-exit-estorno"
  ],
  "keywords": ["comanda", "mesa", "conta aberta", "lançamento", "fechamento", "estoque", "snapshot"]
}
```
