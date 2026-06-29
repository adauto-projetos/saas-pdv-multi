# SAAS PDV.multi

PDV SaaS multi-tenant para comércios híbridos (mercado + bar + lanchonete num só lugar). Contexto de produto em docs/product/product.md (PRODUCT); perfil do founder em docs/product/owner.md (OWNER, nível beginner — explicar o porquê das decisões).

## Status

Scaffolded — feature 0001F implementada e verificada local (Next 16 + React 19 + Tailwind v4 + Drizzle + Postgres em Docker). Dev local: `docker compose up -d` (Postgres) → `.env.local` (ver `.env.example`) → `npm run db:setup` → `npm run dev`.

## Tech Stack
{"lang":"typescript","pkg":"npm","runtime":"node"}
{"framework":{"name":"Next.js 16","router":"app","mode":"fullstack: server actions + route handlers"}}
{"ui":{"css":"tailwindcss v4","components":"shadcn/ui (estilo base-nova, sobre Base UI @base-ui/react — NÃO Radix)"}}
{"data":{"db":"PostgreSQL (Docker local)","orm":"drizzle-orm (postgres-js)","auth":"local (cookie httpOnly assinado + bcrypt)","validation":"zod v4"}}
{"hosting":{"app":"Vercel (futuro)","db":"Postgres self-hosted/managed"},"billing":"Asaas (pós-MVP)"}

## Multi-Tenancy (CRITICAL)

> Regra inviolável: todo dado de negócio pertence a um tenant (estabelecimento). Checar ANTES de modelar ou implementar qualquer tabela.

- Toda tabela de negócio tem coluna `tenant_id` (FK obrigatória).
- Isolamento garantido por **Row Level Security (RLS)** no Postgres — política por tabela filtrando pelo tenant do usuário da sessão. O acesso roda sob o papel `app_user` via `withUserRls` (`db/rls.ts`), que injeta o id na GUC `app.current_user_id` lida por `current_app_user()`. Conexão `postgres` (dono) bypassa RLS — só onboarding/login/seed.
- Nunca confiar só no filtro da aplicação; a RLS é a última linha de defesa contra vazar dados entre lojas.
- Unicidade de código de barras é POR tenant, não global (ver feature 0001F, RN01).

## Architecture Contract

> Dependências e onde cada coisa mora. Consultar ANTES de implementar/revisar.

### Layers
UI (`app/`) → server actions / route handlers → services (`lib/services/`) → data (Drizzle/Postgres). Camada interna nunca importa a externa.

### Placement
| O quê | Onde |
|---|---|
| Páginas e rotas | `app/` |
| Componentes de UI | `components/` |
| Lógica de negócio | `lib/services/` |
| Schema do banco (Drizzle) | `db/schema/` |
| Cliente DB + RLS | `db/` (`index.ts`, `rls.ts`) |
| Auth/sessão (cookie + bcrypt) | `lib/auth/` |
| Schemas de validação (zod) | `lib/validation/` |

### Conventions
| Item | Regra |
|---|---|
| Arquivos | kebab-case |
| Componentes React | PascalCase |
| Tabelas e colunas | snake_case |
| Valores monetários | inteiro em centavos — nunca float (evita erro de arredondamento em preço/markup) |

## Validation Gates

Rodar antes de concluir qualquer feature. Todos devem sair com exit 0.

```json
{"typecheck":"npm run typecheck","lint":"npm run lint","test":"npm test","build":"npm run build"}
```

- `test` roda Vitest. Testes que tocam o banco (RLS, constraints, integração) são **pulados** sem `DATABASE_URL` no `.env.local` — com o Postgres do Docker no ar, rodam de verdade (34 passam).
- Banco: `docker compose up -d` (sobe o Postgres) → `npm run db:setup` (= `db:push --force` + `db:rls`). Exige `.env.local` (ver `.env.example`).
- **Push-only** é a estratégia oficial de evolução de schema (RN01): o snapshot Drizzle (`db/schema/`) é a fonte da verdade; `db:setup` é o caminho canônico; não existe `db:migrate`. Os arquivos `*_rls.sql` em `db/migrations/` são policies RLS aplicadas separadamente por `scripts/apply-rls.ts` — não são migrations Drizzle.
- ⚠️ `drizzle-kit push` **derruba as RLS policies** (não as conhece). SEMPRE rode `npm run db:rls` depois de um `db:push` avulso — ou use `npm run db:setup`.

## Implementation Patterns

Sem código ainda. Após o primeiro build, rodar `/add.xray` para gerar a skill `project-patterns` (padrões detalhados por área, carregados sob demanda).
