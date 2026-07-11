---
id: 0025F-discovery
type: discovery
created: 2026-07-10
updated: 2026-07-10
related: [0025F]
---

# Discovery: Categorias de Produto (0025F)

## TL;DR

Feature permite que o dono do estabelecimento crie e gerencie categorias de produto dinamicamente, substituindo a lista fixa atual (Bebidas, Hortifruti, Mercearia, Lanches, Doces, Limpeza, Outros). Padrão canônico a imitar: CRUD de cliente (0004F). Riscos principais: migração de dados existentes (strings fixas → FKs), deleção de categorias em uso, ordem visual dos chips no caixa (regressão 0024H).

---

## Current State

### A Lista Fixa Hoje

| Arquivo | Linhas | Conteúdo |
|---|---|---|
| `lib/validation/product.ts` | 7–15 | `export const PRODUCT_CATEGORIES = ["Bebidas", "Hortifruti", "Mercearia", "Lanches", "Doces", "Limpeza", "Outros"]` |

**Consumidores:**
```
{"products.ProductForm.tsx":{"location":168,"usage":"select fixo + renderização de opções com PRODUCT_CATEGORIES.map()"},"caixa.CashierScreen.tsx":{"location":"11,44,21-29","usage":"chips de filtro (ALL_CATEGORIES = ['Todos', ...PRODUCT_CATEGORIES]) + mapeamento de cores CATEGORY_COLORS"}}
```

### Armazenamento no Banco

| Tabela | Coluna | Tipo | Nullable | Comportamento |
|---|---|---|---|---|
| `products` | `category` | text | ✅ | Valor livre (atualmente restrito à lista fixa em UI) |

**Path:** `db/schema/products.ts:46` — `category: text("category")`

Nenhuma constraint de FK atual (a categoria é armazenada como string literal). "Sem categoria" é representado como **null** no banco (linha 32 do CashierScreen: `p.category ?? "Outros"` — renderiza como "Outros" se null).

---

## Reusable Functionality

### Padrão de Tabela Tenant-Scoped + RLS (Modelo: 0004F)

**Schema Drizzle:**
```
{"file":"db/schema/customers.ts","relevant_lines":"16-35","pattern":{"id":"uuid PK","tenantId":"FK → tenants.id (cascade)","name":"text NOT NULL","indices":{"primary":"tenantId","compound":"tenantId + name"}}}
```

**Data Layer** (`lib/services/finance/customer-data.ts:1-56`):
- Funções: `insertCustomer(tx, tenantId, data)`, `selectCustomers(tx, tenantId, search?)`, `selectCustomerById(tx, tenantId, id)`
- Padrão: `Executor` (não Drizzle direto), filtro explícito de `tenantId`, DTO mapper (`toCustomerDto`)

**Service Layer** (`lib/services/finance/customer-service.ts:1-32`):
- Funções públicas: `createCustomer(ctx, input)`, `listCustomers(ctx, query)`
- Padrão: `withUserRls(ctx.userId, tx => ...)` + call data layer

**RLS Policy** (`db/migrations/0004_financeiro_rls.sql:10-28`):
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON "customers" TO app_user;
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "customers"
  FOR ALL TO app_user
  USING ("tenant_id" IN (SELECT "tenant_id" FROM "tenant_members" WHERE "user_id" = current_app_user()))
  WITH CHECK (/* idem */);
```

**Actions** (`app/(app)/financeiro/customers/actions.ts:24-54`):
- Padrão: `requireAuthContext()` + `safeParse()` + service call + `revalidatePath()`
- Erro handling: `toActionError()`

### Padrão de UI Picker (Modelo: 0004F)

**Componente** (`components/financeiro/CustomerPicker.tsx:13-117`):
- Props: `value` (DTO), `onSelect(DTO | null)`, `inputId?`
- State: `query`, `results` (fetched via action)
- useEffect com debounce (200ms) → call `listCustomersAction({ search: q })`
- Renderiza combobox com dropdown

---

## Existing Patterns

### Regra de Nomenclatura (CLAUDE.md)
```json
{"tabelas":"snake_case","componentes":"PascalCase (components/), kebab-case (components/ui/)","arquivos":"kebab-case","permissão":"code string: 'produtos' ← já existe"}
```

### Validação Zod (Pattern: `lib/validation/finance.ts`)

```typescript
// Input schemas:
export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  phone: z.string().trim().max(40).optional(),
});

// Query schemas:
export const customerQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

// ID schemas:
export const customerIdSchema = z.object({
  id: z.uuid("Cliente inválido"),
});

// Types:
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
```

Para categorias, seria:
```typescript
export const createProductCategorySchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(50),
  // description? color? — decidir no spec
});
export const productCategoryQuerySchema = z.object({
  search: z.string().trim().max(50).optional(),
});
export const productCategoryIdSchema = z.object({
  id: z.uuid("Categoria inválida"),
});
```

### Permissão Gating (Pattern: `lib/auth/permissions.ts` + `lib/validation/usuarios.ts`)

Permissão `"produtos"` **já existe** (PERMISSION_CODES, PERMISSION_LABELS). Guard: `requirePermission(ctx, "produtos")` — mesmo que outras features sob /products.

---

## Integration Points

### Superfícies Afetadas

| Arquivo | Linhas | O que Muda | Impacto |
|---|---|---|---|
| `components/products/ProductForm.tsx` | 18,168–174 | Trocar `PRODUCT_CATEGORIES` constante por chamada a `listProductCategoriesAction()` + loading state | Crítico — form de criação/edição de produto |
| `components/caixa/CashierScreen.tsx` | 11,21–29,44,75–78 | Trocar `PRODUCT_CATEGORIES` + `CATEGORY_COLORS` por dinâmico; cores armazenadas na tabela ou geradas | Crítico — chips de filtro do caixa, visual (regressão 0024H) |
| `lib/validation/product.ts` | 7–16 | Remover `PRODUCT_CATEGORIES` const; manter `ProductCategory` type (ou deletar se FK usada) | RN03: categoria vira FK, não mais enum |
| `app/(app)/products/page.tsx` | — | Adicionar link/botão "Gerenciar categorias" (novo subroute?) | Menor — navegação |
| `db/schema/index.ts` | — | Exportar nova tabela `product_categories` | Automático |
| `db/migrations/*_rls.sql` | — | Arquivo novo `XXX_product-categories_rls.sql` com política de isolamento | Crítico — RLS |
| `db/__tests__/tenant-isolation-regression.test.ts` | 626+ | Nada (teste parametrizado auto-descobre tabelas com `tenant_id`) | Automático |
| `lib/services/products/` | — | Criar `product-categories-data.ts`, `product-categories-service.ts` | Novo código |
| `app/(app)/products/categories/` | — | Criar rota (ou subroute de products) + page + actions | Novo código |
| `components/products/` | — | Criar `ProductCategoryPicker.tsx` (análogo a CustomerPicker) | Novo código |
| `docs/product/manual-data.ts` | — | Adicionar help text/infos de categorias (se houver InfoButton) | Menor — help |

---

## Prerequisites & Risks

### Pré-requisitos Críticos

| Item | Status | Ação |
|---|---|---|
| Schema `product_categories` com `tenant_id`, FK para `products` | ❌ | Criar em fase 1 — bloqueia service |
| RLS policy para `product_categories` | ❌ | Criar arquivo `_rls.sql` em fase 1 |
| Service layer (data + service) | ❌ | Criar em fase 1 — bloqueia actions |
| Server actions (create/list/delete/update) | ❌ | Criar em fase 2 |
| UI Picker (análogo a CustomerPicker) | ❌ | Criar em fase 2 |
| Integração ProductForm + CashierScreen | ❌ | Atualizar em fase 3 |
| Migração de dados existentes (strings → FKs) | ⚠️ | Decidir: manter valores atuais como categorias padrão do tenant, ou agrupar em "Sem categoria"? |

### Riscos Técnicos

| Risco | Severidade | Mitigation |
|---|---|---|
| **Migração de categorias fixas em uso** — produtos já com `category='Bebidas'` need map to FK | 🔴 Alta | Estratégia: criar as 7 categorias padrão como iniciais do tenant; migrar strings existentes com INSERT...ON CONFLICT ou seed. Testar com dados reais. |
| **Deleção de categoria em uso** — RFxx: o que fazer se usuário deleta "Bebidas" com produtos? | 🟠 Média | Validação: antes de deletar, contar `products.category_id = X`; se >0, lançar erro "Categoria em uso, remova os produtos primeiro". OU cascade soft-delete (marcar deleted_at). Decidir no spec. |
| **Regressão visual no caixa (0024H)** — cores dos chips, ordem, z-index | 🔴 Alta | Testes: verificar que BottomNav (z-40) não sobrepõe chips (precisará z-index review). Manter layout grid responsivo. Snapshot test dos chips se houver. |
| **Permissão de quem gerencia categorias** — só owner, ou operador com "produtos"? | 🟠 Média | Assumir: permissão "produtos" (já usada para upload de fotos em 0016F). Decidir no spec se criar/delete requer "loja" (sensível). |
| **Unicidade por tenant** — duas lojas podem ter categoria com mesmo nome? | 🟢 Baixa | Sim, unicidade é POR tenant (precedente: barcode em 0001F RN01). Índice `UNIQUE (tenant_id, name)`. |
| **Teste de isolamento automático** — tabela nova entra no suite sem config manual | 🟢 Baixa | `tenant-isolation-regression.test.ts` já parametrizado (iso-RN03-allpresent). Confirmar que seed cria dados de teste para nova tabela. |

### Decisões em Aberto (para Questões ao Usuário)

1. **Comportamento de deleção:** Bloquear deletar categorias em uso? Ou cascade? Ou soft-delete?
2. **Ordem visual:** As categorias devem aparecer na ordem fixa (Bebidas, Hortifruti, ...) ou na ordem de criação? Necessário campo `position`?
3. **Cores dos chips:** Manter cores hardcoded (CATEGORY_COLORS) e mapear pelo nome (problemático se renomear "Bebidas")? Ou armazenar cor no banco?
4. **Gestão visual:** UI onde? Página própria `/products/categories/`? Modal no ProductForm? Gear icon no cabeçalho?
5. **Categorias padrão:** Seeder pré-popula as 7 categorias iniciais para todo tenant novo, ou vazio e faz criar na primeira vez?
6. **Descrição/Metadata:** Campo `description` ou apenas `name`? Necessário emoji/ícone por categoria (como produto tem emoji)?

---

## Related Features

| ID | Slug | Relação | Por quê |
|---|---|---|---|
| 0001F | product-markup-pricing | **extends** | Feature-mãe do cadastro; categoria foi excluída do escopo original ("ficam para evolução"). 0025F implementa essa evolução. |
| 0004F | financeiro | **informs** | CRUD de entidade pequena tenant-scoped (customers) é o padrão a replicar. Também usa texto livre para `payables.category` — precedente de "categoria sem tabela própria". |
| 0016F | fotos-produto | **informs** | Template de extensão completa do cadastro: schema FK → data/service → form → exibição em caixa/listagem. Mesmo caminho para categorias. |
| 0020F | camada-dados-services | **informs** | Contrato da data layer (`*-data.ts` + `*-service.ts`). Suite de regressão de isolamento parametrizada; tabela nova com `tenant_id` entra automaticamente. |
| 0014F | usuarios-permissoes | **informs** | Permissão `"produtos"` existe; usar mesmo guard (`requirePermission`) que outras features de produto. |
| 0024H | produto-mobile-layout-salvar | **touches** | Estado mais recente do ProductForm: ordem dos campos, grid responsivo, z-index da barra Salvar. Mudanças no select Categoria devem preservar layout. |
| 0023H | inputs-invisiveis-login-mobile | **touches** | Corrigiu fill do select Categoria (`bg-transparent` → `bg-background`). Novo select/combobox deve manter contraste visual. |
| 0018F | rebrand-logo | **informs** | Introduziu chips de categoria no CashierScreen com cores (CATEGORY_COLORS). Cores dinâmicas exigem nova estratégia visual. |
| 0010F | mobile-responsive | **informs** | Redesign form de produto (grid responsivo) + BottomNav (z-40). Convenções mobile (safe-area, touch targets) valem para UI nova de categorias. |
| 0015F | manual-ajuda | **touches** (fraco) | Manual cobre seção Produtos. Adicionar help text/InfoButton para gestão de categorias exige atualizar `manual-data.ts`. |

---

## Implementation Anatomy

### Phase 1: Backend Infrastructure (Data + Service + RLS)

**Create:**
- `db/schema/product-categories.ts` — tabela com `id`, `tenant_id` FK, `name`, `position` (order), timestamps
- `db/migrations/NNNN_product-categories_rls.sql` — RLS policy (copiar padrão de customers)
- `lib/services/products/product-categories-data.ts` — CRUD funcs (insert/select/selectById/delete/update)
- `lib/services/products/product-categories-service.ts` — public funcs com `withUserRls` + `requirePermission`
- `lib/validation/products.ts` — adicionar schemas (create/query/id)

**Modify:**
- `db/schema/index.ts` — exportar `product_categories`
- `db/schema/products.ts` — trocar `category: text()` por `categoryId: uuid() references product_categories`? **Decisão:** manter text por enquanto ou virar FK?

### Phase 2: API Layer (Actions)

**Create:**
- `app/(app)/products/categories/actions.ts` — `create/list/delete/update` actions

### Phase 3: UI Layer

**Create:**
- `components/products/ProductCategoryPicker.tsx` — combobox (copia CustomerPicker)
- `app/(app)/products/categories/page.tsx` — listagem + create/edit forms

**Modify:**
- `components/products/ProductForm.tsx` — trocar select fixo por picker + loading
- `components/caixa/CashierScreen.tsx` — trocar chips fixos por dinâmicos

---

## Technical Assumptions

- **Multi-tenancy:** Cada tenant tem suas próprias categorias. Não há categorias globais compartilhadas. ✅ (precedente RN01/0001F barcode)
- **RLS é obrigatória:** Sem RLS policy, a suite `tenant-isolation-regression.test.ts` trava (guard iso-RN03-allpresent). ✅
- **Server actions padrão:** Todas as mutations via server actions + revalidatePath. ✅ (0004F, 0016F)
- **Categoria como string ou FK?** Hoje é string literal. Se virar FK (`products.category_id` → `product_categories.id`), quebra backward-compat. **Decisão:** Manter string até migração de dados ser validada? Ou fazer com FK desde o início?

---

## Identified Risks

1. **Cores dos chips perdem previsibilidade** — CATEGORY_COLORS em CashierScreen é um hardcoded map de nome → cores. Se usuário criar "Bebidas v2", não tem cor mapeada. Mitigation: gerar cor por hash do nome, ou armazenar cor no banco.

2. **Produto orfão se categoria é deletada** — Se categoria "Bebidas" é deletada e há produtos com `category='Bebidas'`, o que mostra no caixa? RNxx deve definir: bloquear deleção, ou cascade/nullify, ou marcar como "Sem categoria". Teste: `DELETE FROM product_categories WHERE tenant_id=X AND name='Bebidas'` com produtos existentes.

3. **Seed quebra com categorias dinâmicas** — `npm run db:setup` + `seed-testfull.ts` cria produtos com categoria fixa. Após implementar, seed precisa criar categorias antes dos produtos. Fácil de arrumar, mas é um ponto de atenção.

4. **Regressão no caixa (z-index, layout)** — 0024H ajustou z-index e grid do ProductForm. Chips de categoria no CashierScreen precisam de review visual para não ficar escondido atrás do BottomNav ou quebrar grid mobile.

5. **Permissão: quem gerencia?** — "produtos" é permissão genérica (upload de fotos também usa). Se criar/delete de categoria é "sensível", deveria pedir permissão "loja"? Questionar no spec.

---

## Planning Summary

Feature é uma **extensão pequena-média** do cadastro de produto (0001F). Padrão já existe (customers/0004F), então é replicação + integração. Complexidade principal está em:
1. Não quebrar a lista fixa atual (migração de dados).
2. Preservar visual do caixa (cores, layout, z-index).
3. Definir regras de deleção/bloqueio.

Timeline estimate: 1–2 sessões (discovery, planning, build, review). Bloqueadores: decisões em aberto (deleção, cores, UI location).

---

## Updates
- 2026-07-10: Analysis completo. Padrão 0004F confirmado. Riscos e pré-requisitos listados.

---

## Metadata
{"updated":"2026-07-10","sessions":1,"by":"discovery-agent","files_analyzed":["lib/validation/product.ts","db/schema/products.ts","components/products/ProductForm.tsx","components/caixa/CashierScreen.tsx","db/schema/customers.ts","lib/services/finance/customer-data.ts","lib/services/finance/customer-service.ts","app/(app)/financeiro/customers/actions.ts","components/financeiro/CustomerPicker.tsx","lib/auth/permissions.ts","db/migrations/0004_financeiro_rls.sql","db/__tests__/tenant-isolation-regression.test.ts"],"patterns_found":["tenant-scoped CRUD (0004F)","RLS isolation policy","server actions + revalidatePath","zod validation","permission gating"],"risks_identified":6,"decisions_pending":6}
