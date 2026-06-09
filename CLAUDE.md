# SAAS PDV.multi

PDV SaaS multi-tenant para comércios híbridos (mercado + bar + lanchonete num só lugar). Contexto de produto em docs/product/product.md (PRODUCT); perfil do founder em docs/product/owner.md (OWNER, nível beginner — explicar o porquê das decisões).

## Status

Greenfield — stack decidida, scaffolding pendente. Esta spec é a stack-alvo que `/add.plan` e `/add.build` devem seguir, não um estado descoberto do código.

## Tech Stack
{"lang":"typescript","pkg":"npm","runtime":"node"}
{"framework":{"name":"Next.js","router":"app","mode":"fullstack: server actions + route handlers"}}
{"ui":{"css":"tailwindcss","components":"shadcn/ui"}}
{"data":{"db":"PostgreSQL (Supabase)","orm":"drizzle-orm","auth":"Supabase Auth","validation":"zod"}}
{"hosting":{"app":"Vercel","db":"Supabase"},"billing":"Asaas (pós-MVP)"}

## Multi-Tenancy (CRITICAL)

> Regra inviolável: todo dado de negócio pertence a um tenant (estabelecimento). Checar ANTES de modelar ou implementar qualquer tabela.

- Toda tabela de negócio tem coluna `tenant_id` (FK obrigatória).
- Isolamento garantido por **Row Level Security (RLS)** no Supabase — política por tabela filtrando pelo tenant do usuário autenticado.
- Nunca confiar só no filtro da aplicação; a RLS é a última linha de defesa contra vazar dados entre lojas.
- Unicidade de código de barras é POR tenant, não global (ver feature 0001F, RN01).

## Architecture Contract

> Dependências e onde cada coisa mora. Consultar ANTES de implementar/revisar.

### Layers
UI (`app/`) → server actions / route handlers → services (`lib/services/`) → data (Drizzle/Supabase). Camada interna nunca importa a externa.

### Placement
| O quê | Onde |
|---|---|
| Páginas e rotas | `app/` |
| Componentes de UI | `components/` |
| Lógica de negócio | `lib/services/` |
| Schema do banco (Drizzle) | `db/schema/` |
| Cliente Supabase | `lib/supabase/` |
| Schemas de validação (zod) | `lib/validation/` |

### Conventions
| Item | Regra |
|---|---|
| Arquivos | kebab-case |
| Componentes React | PascalCase |
| Tabelas e colunas | snake_case |
| Valores monetários | inteiro em centavos — nunca float (evita erro de arredondamento em preço/markup) |

## Validation Gates

Sem comandos ainda (projeto não scaffolded). Após o scaffolding, registrar aqui `lint`, `typecheck`, `build` e `test` reais.

## Implementation Patterns

Sem código ainda. Após o primeiro build, rodar `/add.xray` para gerar a skill `project-patterns` (padrões detalhados por área, carregados sob demanda).
