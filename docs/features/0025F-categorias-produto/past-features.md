---
id: 0025F-past-features
type: past-features
created: 2026-07-10
updated: 2026-07-10
related: [0025F]
---

## TL;DR

- 10 de 23 features passadas se relacionam com 0025F (categorias de produto); as demais 13 foram descartadas.
- Núcleo: **0001F** (cadastro de produto — que **excluiu "Categoria" do escopo de propósito**: "Categoria, descrição, foto, fornecedor — não bloqueiam vender; ficam para evolução do cadastro", about.md:72). 0025F é exatamente essa evolução.
- A lista fixa de categorias (Sem categoria, Bebidas, Hortifruti, Mercearia, Lanches, Doces, Limpeza, Outros) **não está documentada em nenhum changelog** — nenhuma feature a introduziu formalmente. Os docs só citam as superfícies onde ela aparece: o `<select>` Categoria em `components/products/ProductForm.tsx` (linha ~168 em 0023H; reordenado em 0024H) e os "chips de categoria" em `components/caixa/CashierScreen.tsx` (0018F discovery.md:42).
- Hotfixes recentes **0023H** e **0024H** mexeram diretamente no select Categoria e no layout mobile do `ProductForm` — qualquer mudança no campo precisa preservar essas correções (fill `bg-background`, grid `grid-cols-1 sm:grid-cols-2`, barra Salvar `bottom-16 z-50 lg:bottom-0`).
- Padrões a seguir: **0020F** (camada `*-data.ts`/`*-service.ts`, actions sem Drizzle, suite de regressão de isolamento que trava tabela nova sem RLS), **0004F** (CRUD de entidade pequena tenant-scoped: `customers` + `CustomerPicker`; e `payables.category` como text livre), **0014F** (permissão `produtos` gating do módulo).

## Related Features

| ID | slug | relação | por quê | arquivos/áreas citados no changelog |
|---|---|---|---|---|
| 0001F | product-markup-pricing | **extends** + depends-on | Feature-mãe do cadastro de produto; excluiu Categoria do escopo ("ficam para evolução do cadastro"). 0025F estende create/listar/editar produto | `db/schema/products.ts`, `lib/services/products/` (`product-service.ts`, `markup.ts`), `app/(app)/products/actions.ts`, `components/products/ProductForm.tsx` |
| 0024H | produto-mobile-layout-salvar | **touches** | Estado mais recente do `ProductForm`: ordem Foto → Emoji → Nome → **Categoria** → Código/Unidade → Estoque; grid responsivo e barra Salvar elevada (`bottom-16 z-50`, `z-40` do BottomNav) — mudanças no campo Categoria não podem regredir isso. Também reordenou a grade do caixa (mais vendidos) | `components/products/ProductForm.tsx:125-175,273`, `components/caixa/CashierScreen.tsx`, `lib/services/sales/data.ts`, `lib/services/products/product-service.ts` (`listProductsForCaixa`), `app/(app)/products/actions.ts` |
| 0023H | inputs-invisiveis-login-mobile | **touches** | Corrigiu o fill do `<select>` Categoria (`bg-transparent` → `bg-background`, ProductForm.tsx:168) — um novo select/combobox de categoria deve manter o mesmo contraste | `components/ui/input.tsx`, `components/products/ProductForm.tsx:168,210`, `components/products/EmojiPicker.tsx` |
| 0016F | fotos-produto | **touches** + informs | Última extensão end-to-end do cadastro de produto (colunas nullable em `products` + service + form + exibição no caixa/listagem) — template do caminho completo que 0025F vai percorrer | `db/schema/products.ts` (`image_key`/`image_url`), `lib/services/products/` (`image-service.ts`, `product-service.ts`), `components/products/ProductForm.tsx`/`NewProductForm`/`EditProductForm`, `CashierScreen`, `ProductsTable` |
| 0002F | venda-rapida-mercado | **touches** | Dona da tela `/caixa` (`CashierScreen`) onde os chips de categoria filtram a grade de produtos — categorias dinâmicas precisam alimentar essa superfície | `components/caixa/` (`CashierScreen`, `ProductSearch`, `Cart`), `lib/services/sales/`, `app/(app)/caixa/actions.ts` |
| 0020F | camada-dados-services | **informs** | Contrato oficial da camada de dados: `*-data.ts` + `*-service.ts`, actions sem import de Drizzle/schema; suite `tenant-isolation-regression.test.ts` parametrizada sobre as 19 tabelas com `tenant_id` + guard `iso-RN03-allpresent` — uma tabela nova `product_categories` sem RLS quebra o teste | `lib/services/admin/`, `db/__tests__/tenant-isolation-regression.test.ts`, estratégia push-only (`db:setup`) |
| 0004F | financeiro | **informs** | Dois precedentes: `payables.category` (text NOT NULL, filtro por categoria — categoria como texto livre, sem tabela própria) e CRUD de entidade pequena tenant-scoped (`customers` + `CustomerPicker`) — o modelo mais próximo de "cadastro auxiliar" do projeto | `db/schema/` (`customers`, `payables` com `category` text), `lib/services/finance/`, `components/financeiro/` (`CustomerPicker`) |
| 0014F | usuarios-permissoes | **informs** | Autorização por código de módulo (`requirePermission`) — a permissão `produtos` já gate o cadastro (0016F usa no upload); gerenciar categorias deve ficar sob a mesma permissão | `lib/auth/permissions.ts`, `user_permissions`, menu filtrado por permissão |
| 0010F | mobile-responsive | **informs** | Introduziu o redesign do form de produto (grid `grid-cols-2`, commit `cfa9bfa` citado em 0024H) e o `BottomNav` (`z-40`) — convenções mobile (touch targets 44px, `px-4 md:px-7`, safe-area) valem para qualquer tela nova de gestão de categorias | `components/layout/BottomNav.tsx`, `components/caixa/CashierScreen.tsx`, rotas `/products`, `/products/new`, `/products/[id]/edit` |
| 0015F | manual-ajuda | **touches** (fraco) | Manual data-driven cobre a seção Produtos — nova gestão de categorias exige atualizar `manual-data.ts` e eventuais `InfoButton`/`HelpTip` | `components/manual/manual-data.ts`, `ManualContent.tsx` |

## Keywords & Evidence

- **"categoria" fora do escopo original do cadastro** — 0001F `about.md:72` (Does NOT Include): "Categoria, descrição, foto, fornecedor — não bloqueiam vender; ficam para evolução do cadastro." → 0025F é a evolução prevista.
- **select Categoria no form de produto** — 0023H `about.md:31`: "`components/products/ProductForm.tsx:168` e `:210` — `<select>` Categoria/Unidade: `bg-transparent` → `bg-background`". É a referência de arquivo/linha mais precisa nos docs para onde a lista fixa é renderizada.
- **posição atual do campo Categoria** — 0024H `changelog.md`: "campos do form reordenados a pedido do owner — Foto → Emoji → Nome → Categoria → Código de barras/Unidade → Estoque"; `about.md:31`: "campo Emoji deixou de ser pareado com Categoria (agora linha própria)".
- **chips de categoria no caixa** — 0018F `discovery.md:42`: "`components/caixa/CashierScreen.tsx` — fundo branco, chips de categoria; sem header dedicado próprio." → a lista fixa também alimenta o filtro da tela `/caixa`.
- **lista fixa não documentada** — nenhum changelog/about de 0001F–0024H registra a introdução da constante com os valores "Sem categoria, Bebidas, Hortifruti, Mercearia, Lanches, Doces, Limpeza, Outros"; grep por `categoria|Hortifruti|Mercearia|Sem categoria` em `docs/features/` não retorna nenhuma definição de lista — só as superfícies de UI acima. Provável origem no redesign 0009F/0010F sem doc próprio (0009F ficou em `discovery`, sem changelog).
- **precedente de categoria como texto** — 0004F `plan.md:148`: "`payables` ... `category` text NOT NULL"; `plan.md:96-102`: filtros `listPayables({status,category})` — categoria de despesa é string livre, sem tabela de domínio.
- **regressão de isolamento cobre tabela nova** — 0020F `changelog.md`: "suite única de regressão de isolamento `tenant_id` parametrizada sobre as 19 tabelas com a coluna ... guard `iso-RN03-allpresent` (schema-derived) trava qualquer tabela futura sem RLS" → `product_categories` nova precisa de policy RLS + entra automaticamente na suite.
- **extensão anterior do cadastro como template** — 0016F `changelog.md`: "colunas `image_key`/`image_url` (nullable) em `db/schema/products.ts` + mapper em `data.ts`; RLS protege a linha do produto" — mesmo caminho schema → service → form → caixa/listagem que uma FK `category_id` percorreria.
- **mobile do form é território sensível** — 0024H `about.md`: "nenhuma feature (0001F, 0010F, 0016F) documentou uma estratégia de grid responsivo para os pares de campos do form" e "`z-index: auto` perde para qualquer `z-index` numérico ... o `BottomNav` sempre pintava por cima da barra de salvar".

## Not Related

- **0003F estoque** — mexeu no ProductForm só para `min_stock`; domínio (movimentações) sem interseção com categorias. Padrão de "threading de campo novo" já coberto por 0016F.
- **0005F lucro-fechamento** — agregação de lucro e turno de caixa; não toca cadastro de produto.
- **0006F comanda-mesa** — lifecycle de comanda; consome produtos mas não o campo categoria.
- **0007F impressao** — impressora térmica/cupom; sem relação com categorias.
- **0008F sidebar-layout** — shell de navegação puro, sem página de produto.
- **0009F page-redesign** — restyle visual (ficou em `discovery`, nunca implementada como feature); nenhum doc dela cita categorias.
- **0011F super-admin-billing** — assinatura/painel do founder; fora do domínio.
- **0013F liberacao-meses** — liberação de assinatura; fora do domínio.
- **0017H super-admin-bypass-permissoes** — guard de impersonação; fora do domínio.
- **0018F rebrand-logo** — rebrand visual; só entra como evidência (discovery cita os chips de categoria do caixa e adicionou o `EmojiPicker` ao ProductForm) — não como dependência.
- **0019H seguranca-deploy** — hardening de boot/deploy; fora do domínio.
- **0021C doc-convencoes** — chore de documentação/naming; sem código de produto.
- **0022C xray-patterns** — chore de docs (skill `project-patterns`); sem código de produto.
