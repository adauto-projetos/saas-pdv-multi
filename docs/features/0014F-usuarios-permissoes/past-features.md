# Past Features Discovery — 0014F usuarios-permissoes

> Relationship map of existing features to 0014F (operator users + granular permissions). Grounded against the real `db/schema/` file list. Detailed code-level confirmation lives in `discovery.md`.

## Ranked relationships

| Feature | Name | Relationship | Why it matters to 0014F | Read |
|---|---|---|---|---|
| 0011F | super-admin-billing | prerequisite + integration | Operator limit stored in `platform-settings` (table EXISTS), edited in super admin panel (SF02). 0014F reads/enforces limit; panel may need a new field. | `db/schema/platform-settings.ts`, `db/schema/subscriptions.ts`, super admin pages |
| 0002F | venda-rapida-mercado | extends + author-tracking | Sale must record which operator finalized it. Permission "Vendas" gates `/caixa`. | `db/schema/sales.ts`, sale-service |
| 0005F | lucro-fechamento | extends + author-tracking + sensitive | Cash open/close records `opened_by`/`closed_by`. Permission "Caixa"; close may need override. | `db/schema/cash-sessions.ts`, cash-session-service |
| 0006F | comanda-mesa | extends + author-tracking + sensitive | Comanda records `opened_by`/`closed_by`. Permission "Comanda"; remove item / cancel may need override. | `db/schema/comandas.ts`, comanda-service |
| 0004F | financeiro | extends + sensitive | Cash movements (sangria/suprimento) need "Financeiro" gate + author tracking. | `db/schema/cash-movements.ts`, finance service |
| 0003F | estoque | extends + author-tracking | Stock movements need "Estoque" gate + author. | `db/schema/stock-movements.ts`, stock-service |
| 0001F | product-markup-pricing | shares-data | Products/preços gated by "Produtos"; price visibility is the core thing operators must NOT see freely. | `db/schema/products.ts` |
| 0013F | liberacao-meses | reference-only | Listed in brainstorm `related` but about month-liberation, not permissions. No data overlap. | — |

## Top hypotheses (to confirm in discovery.md)

1. **platform-settings EXISTS** — confirmed by file list (`db/schema/platform-settings.ts`). Need to read whether it has a `max_operators` / operator-limit field and whether the super admin panel can edit it. If absent → adding the field is a prerequisite of the limit sub-scope only.
2. **users vs tenant-members** — project has both `users.ts` and `tenant-members.ts`. Role/ownership may live in `tenant-members` (per-tenant role), not `users`. This decides where "operator" role and "is_active" live, and how anti-escalation + owner-supreme is modeled.
3. **Author columns** — cash-sessions and comandas likely already have `opened_by`/`closed_by`; sales/stock-movements/cash-movements need checking. Missing columns = retrofit.
4. **No permission layer exists today** — expect zero permission checks in services/actions. 0014F adds guard helpers in `lib/auth/` + gates in actions. This is the core build.
5. **Sensitive actions (desconto/estorno/cancelamento)** — confirm whether these features exist yet. The override framework gates them; if some don't exist, the override hook applies only to those that do.
