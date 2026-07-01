# Data Report

**Generated on:** 2026-06-29
**Score:** 8.5/10
**Status:** 🟢 (sólido; ressalvas são de tuning de índices de FK e housekeeping de migration)

---

## Summary

A camada de dados está madura e disciplinada para um MVP+: todas as 22 tabelas de negócio têm `tenant_id NOT NULL` com FK `ON DELETE CASCADE`, todas estão cobertas por uma policy RLS de isolamento por tenant, dinheiro é sempre `integer` em centavos (nenhum `numeric`/float usado para moeda), e os ledgers (estoque, caixa, pagamentos, override, print, subscription) são append-only com CHECK constraints de sinal/valor. Os dois itens que a auditoria anterior (2026-06-28) apontou — o N+1 em `listOperators` e a falta de índice em `override_log` — **foram corrigidos** (verificado com evidência de linha). Os achados remanescentes são de baixo/médio impacto: o `meta/` do Drizzle ainda referencia uma migration `0000` órfã (housekeeping da estratégia push-only), e várias colunas FK secundárias (`user_id`, `sale_id`, `product_id`, `customer_id`, `*_payment_id`) não têm índice próprio — irrelevante no volume atual, relevante quando uma loja acumular histórico.

---

## Analysis Context

- **ORM/Query Builder:** Drizzle ORM (`drizzle-orm` 0.45, driver `postgres-js`)
- **Tenant Column:** `tenant_id` (uuid, `NOT NULL`, FK → `tenants(id)` `ON DELETE CASCADE`)
- **Schema strategy:** **Push-only** (RN01) — `db/schema/` é fonte da verdade; `db:setup` = `drizzle-kit push --force` + `apply-rls.ts`. NÃO há `db:migrate`. Os `*_rls.sql` em `db/migrations/` são policies RLS, não migrations Drizzle.
- **MCP Available:** N/A — projeto não usa Supabase; Postgres self-hosted, RLS nativo via `withUserRls`. Análise feita por leitura direta de `db/schema/` + `db/migrations/*_rls.sql` (sem banco no ar nesta sessão).

---

## Schema Integrity — tenant_id + RLS coverage

Cruzamento de `db/schema/index.ts` (22 tabelas) contra os `db/migrations/*_rls.sql`. **Todas as tabelas de negócio têm `tenant_id` + RLS.** Tabelas globais sem `tenant_id` (`users`, `platform_settings`) são intencionais e tratadas à parte.

| Tabela | `tenant_id NOT NULL` | RLS habilitada + policy | Arquivo da policy |
|---|---|---|---|
| `users` | N/A (global) | ✅ `user_self_read` (self only) | `0001_rls.sql:38` |
| `tenants` | N/A (raiz) | ✅ `tenant_self_read`/`_update` | `0001`/`0009_impersonation_rls.sql:44` |
| `tenant_members` | ✅ | ✅ `tenant_member_isolation` (não-recursiva) | `0001_rls.sql:72` |
| `user_permissions` | ✅ | ✅ `tenant_isolation` | `0010_usuarios_rls.sql:20` |
| `override_log` | ✅ | ✅ `tenant_isolation` | `0011_override_rls.sql:17` |
| `products` | ✅ | ✅ `tenant_isolation` | `0001_rls.sql:79` |
| `sales` | ✅ | ✅ | `0002_sales_rls.sql:14` |
| `sale_items` | ✅ | ✅ | `0002_sales_rls.sql:30` |
| `stock_movements` | ✅ | ✅ | `0003_stock_rls.sql:12` |
| `customers` | ✅ | ✅ | `0004_financeiro_rls.sql:14` |
| `cash_movements` | ✅ | ✅ | `0004_financeiro_rls.sql:36` |
| `receivables` | ✅ | ✅ | `0004_financeiro_rls.sql:58` |
| `receivable_payments` | ✅ | ✅ | `0004_financeiro_rls.sql:80` |
| `payables` | ✅ | ✅ | `0004_financeiro_rls.sql:102` |
| `payable_payments` | ✅ | ✅ | `0004_financeiro_rls.sql:124` |
| `cash_sessions` | ✅ | ✅ | `0005_lucro_rls.sql:15` |
| `comandas` | ✅ | ✅ | `0006_comanda_rls.sql:14` |
| `comanda_items` | ✅ | ✅ | `0006_comanda_rls.sql:34` |
| `print_logs` | ✅ | ✅ (SELECT+INSERT only) | `0007_impressao_rls.sql:15` |
| `kitchen_order_seqs` | ✅ | ✅ (SELECT+INSERT+UPDATE) | `0007_impressao_rls.sql:36` |
| `subscription_log` | ✅ | ✅ (SELECT+INSERT only) | `0008_subscription_rls.sql:16` |
| `platform_settings` | N/A (singleton global) | ➖ Fora da RLS — por design | `platform-settings.ts:11-16` |

**Coverage gap:** nenhum. `0009_impersonation_rls.sql` reaplica `tenant_isolation` em massa (16 tabelas) trocando o predicado por `current_app_tenants()` (suporte a impersonação founder); `0010`/`0011` aplicam `user_permissions`/`override_log` depois (ordem alfabética de `apply-rls.ts:19-22` garante que rodam após o 0009). **Defesa em profundidade adicional:** `scripts/verify-prod.ts:46-61` consulta `pg_class`/`pg_policy` no boot e **aborta o container** se qualquer tabela com coluna `tenant_id` estiver sem RLS ou sem policy — pega o footgun do `drizzle-kit push` continuamente.

> Nota de nomenclatura (informacional): `db/schema/index.ts:21` exporta `./subscriptions`, mas a tabela definida nesse arquivo chama-se `subscription_log` (`subscriptions.ts:30`). O `context-discovery.md` lista a tabela como `subscriptions`. Não é defeito (o nome real no banco é `subscription_log`, coerente com a policy `0008`), mas o nome do arquivo (`subscriptions.ts`) diverge do nome da tabela — vale alinhar para evitar confusão.

---

## Money as Cents

✅ **Sem violações.** Todo valor monetário é `integer` (centavos) com CHECK de não-negatividade ou positividade. Os únicos `numeric` do schema são para **quantidade** (kg/un fracionário) e **percentual de markup** — nunca moeda:

| Coluna `numeric` | Tabela:linha | Propósito (não-moeda) |
|---|---|---|
| `markup_percent (5,2)` | `products.ts:36` | Percentual de margem |
| `stock_quantity (10,3)` | `products.ts:40` | Quantidade (precisão de grama) |
| `min_stock (10,3)` | `products.ts:44` | Quantidade |
| `quantity (10,3)` | `sale-items.ts:41`, `stock-movements.ts:36`, `comanda-items.ts:44` | Quantidade |
| `default_markup_percent (5,2)` | `tenants.ts:15` | Percentual |

CHECK de centavos presentes: `products_cost_cents_non_negative`/`_sale_price_cents_non_negative` (`products.ts:61-65`), `sales_total_cents_non_negative` (`sales.ts:51`), `sale_items_*_non_negative` (`sale-items.ts:49-50`), `cash_movements_amount_sign` (`cash-movements.ts:70-73`), `receivable_payments_amount_positive` (`receivable-payments.ts:49`), `payable_payments_amount_positive` (`payable-payments.ts:49`), etc.

---

## Ledger / Append-only Integrity

Os ledgers seguem o padrão correto (delta assinado ou só-INSERT) com CHECK de integridade:

- **`stock_movements`** — delta assinado; CHECK `stock_movements_quantity_sign` casa sinal com tipo (`stock-movements.ts:57-60`). FK `product_id` CASCADE, `user_id` RESTRICT (preserva autoria), `sale_id` SET NULL.
- **`cash_movements`** — delta assinado; CHECK `cash_movements_amount_sign` (`cash-movements.ts:70-73`). `receivable_payment_id`/`payable_payment_id` são uuid sem FK (evita ciclo; documentado `cash-movements.ts:46-49`).
- **`receivable_payments` / `payable_payments`** — imutáveis (RN10); só `amount_positive` CHECK. Saldo derivado na leitura, sem coluna de status (evita dupla fonte de verdade).
- **`override_log`** — append-only; FKs `actor_user_id`/`authorizer_user_id` SET NULL preservam o log (`override-log.ts:27-33`).
- **`print_logs`** — append-only por GRANT (SELECT+INSERT só, `0007_impressao_rls.sql:11`).
- **`subscription_log`** — append-only por GRANT (`0008_subscription_rls.sql:12`); CHECK de `action` válida.

✅ Sem problemas de integridade de ledger.

---

## Cascade / FK Integrity

Padrão consistente e bem-pensado:
- `tenant_id` → `tenants(id)` **CASCADE** em todas as tabelas (apagar loja limpa tudo).
- Colunas de autoria (`user_id`, `opened_by`, `closed_by`, `printed_by`) → **RESTRICT** (não deixa apagar usuário com histórico) ou **SET NULL** em logs (preserva a linha).
- Snapshots de venda: `sale_items.product_id` **SET NULL** (`sale-items.ts:35-37`) — histórico sobrevive ao delete do produto (já guarda `name_snapshot`/`unit_price_cents`/`cost_cents_snapshot`).
- Back-links circulares (`sales.comanda_id`, `stock_movements.comanda_id`, `cash_movements.*_payment_id`, `print_logs.trigger_id`) são uuid **sem** `.references()` por design — evitam ciclo de bootstrap; documentados em cada schema. ⚠️ Trade-off consciente: esses uuids polimórficos **não têm integridade referencial garantida pelo banco** (órfãos possíveis se a app falhar entre inserts) — aceitável dado que são audit back-links, não o vínculo canônico.

---

## Indexes

### tenant_id index — ✅ cobertura completa

Toda tabela de negócio tem índice liderado por `tenant_id` (direto ou composto): `products_tenant_id_idx`, `sales_tenant_created_idx`, `sale_items_tenant_idx`, `stock_movements_tenant_idx`, `customers_tenant_idx`, `cash_movements_tenant_idx`, `receivables_tenant_customer_idx`, `receivable_payments_tenant_receivable_idx`, `payables_tenant_due_date_idx`, `payable_payments_tenant_payable_idx`, `cash_sessions_tenant_opened_at_idx`, `comandas_tenant_status_idx`, `comanda_items_tenant_idx`, `print_logs_tenant_printed_at_idx`, `subscription_log_tenant_at_idx`, `override_log_tenant_created_action_idx`. `kitchen_order_seqs` usa PK composta `(tenant_id, date)` (`kitchen-order-seqs.ts:34`) — o `tenant_id` é a coluna líder, ok.

### `override_log` — ✅ índice agora presente (regressão da auditoria anterior corrigida)

A auditoria de 2026-06-28 apontou `override_log` sem índices. **Corrigido:** `override-log.ts:42-46` define `override_log_tenant_created_action_idx` em `(tenant_id, created_at, action_code)` — casa exatamente a query de auditoria por período + ação.

### FK columns sem índice próprio — 🟡 tuning

Postgres **não** cria índice automático em FK. Várias FKs secundárias não são cobertas por nenhum índice (nem como coluna líder). Impacto hoje é nulo (volume baixo), mas cresce com o histórico e, principalmente, torna `ON DELETE`/`UPDATE` da tabela-pai mais lento (full scan na filha p/ checar a FK).

| FK sem índice | Tabela:linha | Pai | Quando dói |
|---|---|---|---|
| `user_id` | `sales.ts:30` | users | Relatório por operador; delete/merge de usuário |
| `customer_id` | `sales.ts:38` | customers | Vendas de um cliente; delete de cliente |
| `product_id` | `sale-items.ts:35` | products | Itens de um produto; **delete de produto faz scan em sale_items** |
| `user_id`, `sale_id` | `stock-movements.ts:38,44` | users/sales | Movimentos por venda/usuário |
| `user_id`, `sale_id`, `session_id`, `cash_movement_id` refs | `cash-movements.ts:38,45,52` | users/sales/cash_sessions | Conciliação por turno/usuário |
| `user_id`, `sale_id` | `receivables.ts:41,42` | users/sales | — |
| `user_id`, `cash_movement_id` | `receivable-payments.ts:37,41` | users/cash_movements | — |
| `user_id`, `cash_movement_id` | `payable-payments.ts:37,41` | users/cash_movements | — |
| `opened_by`, `closed_by`, `sale_id` | `comandas.ts:38,44,51` | users/sales | Comandas de um operador |
| `product_id` | `comanda-items.ts:41` | products | **Delete de produto faz scan em comanda_items** |
| `opened_by`, `closed_by` | `cash-sessions.ts:41,45` | users | — |
| `actor_user_id`, `authorizer_user_id` | `override-log.ts:27,31` | users | — |
| `printed_by` | `print-logs.ts:48` | users | — |

> A maioria das **queries de leitura** já é tenant-scoped e cai no índice de `tenant_id`, então o ganho prático em SELECTs é marginal. O risco mais concreto é o **custo de delete/restrição do lado do pai** (ex.: deletar um produto varre `sale_items`/`comanda_items`/`stock_movements` inteiros do tenant). Prioridade: indexar `sale_items.product_id` e `comanda_items.product_id` se deleção de produto for comum.

---

## N+1 Queries

✅ **Nenhum N+1 encontrado.** Os data modules seguem o padrão batch-fetch + group-in-memory:

- **`listOperators` (regressão da auditoria anterior corrigida):** antes era N+1 (1 query de permissões por operador). Agora `operator-service.ts:72-94` faz 1 select de membros + 1 batch `selectPermissionsByUserIds` (`permission-data.ts:40-62`, usa `inArray`) — `O(2)` queries independente do nº de operadores. Confirmado.
- `comanda-data.ts:192-209` (`selectOpenComandas`) — 1 query de comandas + 1 batch de itens via `inArray` (`selectItemsByComandaIds`), agrupados em memória (loop `:117` é só agrupamento, sem query dentro).
- `sales/data.ts:100-126` — mesmo padrão: 1 select de vendas + 1 `inArray` de itens, loop `:120` só agrupa.
- `audit-data.ts` — uma query agregada (`GROUP BY` autoria) por métrica, sem loop de query (documentado `:18`).

Nenhum `for/forEach/map` com `await` de query dentro foi encontrado em `lib/services/**/*data*.ts`.

---

## Owner-connection reads of tenant data

A conexão `db` (owner, **bypassa RLS**) é usada deliberadamente em alguns módulos porque a policy não-recursiva de `tenant_members` esconderia outros membros sob `withUserRls`. **Todos** esses reads carregam predicado `tenant_id` explícito — verificado:

| Módulo (owner `db`) | tenant_id explícito? | Evidência |
|---|---|---|
| `operator-data.ts` | ✅ | `:34,57,138,159` (todo select/update filtra `tenantMembers.tenantId`) |
| `permission-data.ts` | ✅ | `:28,49,92` (`eq(userPermissions.tenantId, tenantId)`) |
| `override-data.ts` | ✅ | `:40` (`eq(tenantMembers.tenantId, tenantId)`) |
| `audit-data.ts` | ✅ | `:54,70,85,103` (toda métrica filtra por tenant) |
| `admin-data.ts` / `tenant-admin-service.ts` | ➖ cross-tenant **por design** (founder gerencia qualquer loja, gate `requireFounder` na action) | `admin-data.ts:6-11,14-22` |
| `subscriptions/repository.ts` | ✅ por tenant/PK | `:18,54,67,75` |

✅ Nenhum read de dado de tenant via owner sem predicado de tenant (exceto os founder cross-tenant intencionais, protegidos por `requireFounder`).

---

## Migration / Push-only Consistency

🟡 **Migration Drizzle `0000` órfã (housekeeping da auditoria anterior — ainda presente).** O `db/migrations/meta/_journal.json:9` referencia a entry `0000_perfect_mikhail_rasputin` e existe `db/migrations/meta/0000_snapshot.json`, mas **não existe nenhum arquivo `0000_*.sql`** no diretório (confirmado por `ls`). Como a estratégia oficial é **push-only** (`db:setup` = `drizzle-kit push --force`; `db:generate` nunca é executado no fluxo), esse `meta/` é um resquício de um `db:generate` antigo, agora desconectado da realidade. Não causa dano (o push ignora o `meta/`), mas:
- confunde quem lê o repo (parece haver migrations versionadas que não existem);
- `drizzle.config.ts:11` aponta `out: "./db/migrations"`, ou seja, um `db:generate` futuro escreveria SQL Drizzle no **mesmo diretório** dos `*_rls.sql` hand-written — misturando dois mundos.

**Fix sugerido:** ou remover `db/migrations/meta/` (assumindo push-only puro), ou mover os `*_rls.sql` para um diretório próprio (ex.: `db/policies/`) e ajustar `apply-rls.ts:18` + `out` do drizzle.config. Decisão de RN01 (push-only) é consciente — registrado como housekeeping, não defeito.

> `0008_subscription_lifecycle.sql` é o único `*.sql` em `db/migrations/` que **não** é `_rls` nem é aplicado por `apply-rls.ts` (que filtra `_rls.sql`, `apply-rls.ts:20`). É um DDL manual (ALTER/CREATE) que **não roda** no `db:setup` — o schema dessas colunas/tabela já vem do `push` a partir de `db/schema/`. Ou seja, esse arquivo é documentação/histórico, não executado. Vale um comentário no topo deixando isso explícito para não induzir alguém a aplicá-lo à mão.

---

## Consolidated Issues

### 🔴 Critical
Nenhum.

### 🟠 High
Nenhum.

### 🟡 Medium

#### [DATA-001] FKs secundárias sem índice (custo de delete do pai + queries por FK)
**Tabelas:** `sale_items.product_id`, `comanda_items.product_id`, `stock_movements.{user_id,sale_id}`, `cash_movements.{user_id,sale_id,session_id}`, `sales.{user_id,customer_id}`, `comandas.{opened_by,closed_by,sale_id}`, `cash_sessions.{opened_by,closed_by}`, `*_payments.{user_id,cash_movement_id}`, `override_log.{actor,authorizer}_user_id`, `print_logs.printed_by`.
**Impacto:** Postgres não indexa FK automaticamente; deletar um produto/usuário varre a tabela-filha inteira do tenant; queries por essas colunas não têm índice próprio (caem no scan tenant-filtered).
**Fix:** Adicionar índices nas FKs mais quentes — prioridade em `sale_items.product_id` e `comanda_items.product_id` (delete de produto). Avaliar custo/benefício para as colunas de autoria conforme o histórico cresce.

#### [DATA-002] `meta/` do Drizzle referencia migration `0000` inexistente (push-only)
**Arquivos:** `db/migrations/meta/_journal.json:9`, `db/migrations/meta/0000_snapshot.json` (sem `0000_*.sql` correspondente).
**Impacto:** Resquício de `db:generate` antigo, inconsistente com a estratégia push-only; `drizzle.config.ts:11` (`out: "./db/migrations"`) faria um futuro `db:generate` colidir com os `*_rls.sql`. Confunde a leitura do repo.
**Fix:** Remover `db/migrations/meta/` OU separar policies RLS em diretório próprio e ajustar `apply-rls.ts` + `out`.

### 🟢 Low / Informational

#### [DATA-003] Nome do arquivo `subscriptions.ts` ≠ nome da tabela `subscription_log`
**Arquivo:** `db/schema/subscriptions.ts:30` (tabela `subscription_log`), exportado como `./subscriptions` em `index.ts:21`.
**Fix:** Renomear o arquivo para `subscription-log.ts` para casar com a tabela (kebab-case da convenção).

#### [DATA-004] `0008_subscription_lifecycle.sql` é DDL manual não executado pelo setup
**Arquivo:** `db/migrations/0008_subscription_lifecycle.sql` (não casa o filtro `_rls.sql` de `apply-rls.ts:20`).
**Fix:** Adicionar comentário no topo deixando claro que é histórico/documentação (o schema vem do push), para ninguém aplicá-lo à mão.

#### [DATA-005] Back-links uuid polimórficos sem integridade referencial
**Colunas:** `sales.comanda_id`, `stock_movements.comanda_id`, `cash_movements.{receivable,payable}_payment_id`, `print_logs.trigger_id`.
**Impacto:** Trade-off consciente (evitar FK circular); órfãos possíveis se a app falhar entre inserts. Aceitável por serem audit back-links.

---

## Fix Checklist

### Indexes
- [ ] [DATA-001] Criar índice em `sale_items.product_id` e `comanda_items.product_id` (delete de produto)
- [ ] [DATA-001] Avaliar índices nas FKs de autoria (`user_id`/`opened_by`/...) conforme histórico cresce

### Migrations / Housekeeping
- [ ] [DATA-002] Remover `db/migrations/meta/` ou separar `*_rls.sql` em diretório próprio
- [ ] [DATA-003] Renomear `subscriptions.ts` → `subscription-log.ts`
- [ ] [DATA-004] Comentar `0008_subscription_lifecycle.sql` como não-executado

---

## Recommendations

1. **Prioridade 1:** Indexar `sale_items.product_id` e `comanda_items.product_id` — barato e elimina full-scan no delete de produto.
2. **Prioridade 2:** Limpar o `meta/` órfão do Drizzle e/ou isolar os `*_rls.sql` num diretório próprio para a estratégia push-only ficar sem ambiguidade.
3. **Prioridade 3 (conforme escala):** Adicionar índices nas FKs de autoria à medida que o histórico por loja crescer; medir antes (são úteis sobretudo para deletes/relatórios cross-coluna).

---

## Analysis Limitations

| Análise | Motivo | Como habilitar |
|---|---|---|
| Verificação de índices/policies ao vivo (`pg_indexes`/`pg_policy`) | Sem `DATABASE_URL`/Postgres no ar nesta sessão | `docker compose up -d` + `npm run db:setup`; ou confiar no `verify-prod.ts` (checa RLS no boot) |
| Plano de execução real (EXPLAIN) das queries | Idem | Subir o banco com seed (`npm run seed:testfull`) e rodar `EXPLAIN ANALYZE` |
| MCP Supabase | N/A — projeto não usa Supabase (RLS nativo via `withUserRls`) | Não aplicável |

---

## Scoring

Base 10, deduções:
- [DATA-001] FKs sem índice (tuning, impacto baixo no volume atual, mas múltiplas tabelas): −1.0
- [DATA-002] `meta/` órfão / inconsistência push-only: −0.5
- Itens informacionais (DATA-003/004/005): sem dedução material.

**Score = 8.5/10.** Schema integrity, RLS coverage, money-as-cents e ausência de N+1 estão impecáveis; os dois itens da auditoria anterior (N+1 em `listOperators`, `override_log` sem índice) foram corrigidos. As ressalvas são de tuning de índice e housekeeping de migration, não de correção.

---

*Document generated by the data-analyzer subagent*
