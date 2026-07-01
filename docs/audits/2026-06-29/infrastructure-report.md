# Infrastructure Report

**Generated on:** 2026-06-29
**Score:** 7.5/10
**Status:** 🟡 (sólido para o estágio MVP+, com riscos pontuais de operação/secrets)

---

## Summary

A infraestrutura está bem cuidada para um MVP+ em produção: `.env.example` documenta as vars principais, o boot de produção tem um *guard* (`verify-prod.ts`) que aborta se `SESSION_SECRET` estiver fraco ou se as RLS policies sumirem, e o Docker está organizado em topologias mutuamente exclusivas com healthchecks. Os riscos relevantes são operacionais: o script de deploy embute IP/host e caminho de chave SSH no repositório, duas variáveis de ambiente usadas em código (`FOUNDER_EMAIL`, `PRINTER_DEVICE`) não estão documentadas no `.env.example`, não há pipeline de CI (validação 100% manual / no boot do container), e o nginx do proxy serve tudo em HTTP puro (TLS terminado fora do repo, não verificável aqui). `npm audit` reporta 6 vulnerabilidades **moderadas** (zero high/critical), todas em dev-deps (drizzle-kit/esbuild) ou transitive de build (postcss/next).

**Nota sobre o skill:** este skill foi escrito assumindo Supabase + MCP Supabase. Este projeto **não usa Supabase** — auth é local (cookie HMAC + bcrypt) e o Postgres é self-hosted (Docker/Hetzner). Os checks de MCP Supabase e das vars `SUPABASE_*` são **N/A** e estão marcados como tal abaixo.

---

## Tools Status

| Tool | Status | Impact |
|------|--------|--------|
| MCP Supabase | ➖ N/A | Projeto não usa Supabase; RLS é Postgres nativo via `withUserRls` |
| `.env.example` | ✅ | Vars principais documentadas (2 vars secundárias faltando — ver INF-002) |
| Docker Compose | ✅ | 3 arquivos: dev, prod, proxy — bem comentados e isolados |
| `npm audit` | ✅ | 6 moderadas, 0 high/critical |
| `package-lock.json` | ✅ | Presente (deps reproduzíveis; `npm ci` no Dockerfile) |
| CI/CD pipeline | ❌ | Sem `.github/workflows` — sem gate automatizado (ver INF-004) |

---

## MCP Supabase

### Status: N/A — projeto não usa Supabase

Este projeto implementa **auth local** (cookie httpOnly assinado por HMAC-SHA256 + bcrypt, `lib/auth/session.ts`) e **Postgres self-hosted** (Docker local em dev, Hetzner em prod). O isolamento multi-tenant é por **RLS nativo do Postgres** aplicado por `scripts/apply-rls.ts` (lendo `db/migrations/*_rls.sql`), não por Supabase.

A análise de RLS, que o skill delegaria ao MCP Supabase, aqui pode ser feita diretamente:
- **Aplicação das policies:** `scripts/apply-rls.ts` (`npm run db:rls`).
- **Verificação em runtime:** `scripts/verify-prod.ts` roda no boot e **aborta o container** se qualquer tabela com coluna `tenant_id` estiver sem RLS habilitada ou sem policy — substitui funcionalmente o que o MCP faria sob demanda, mas de forma contínua.

Nenhuma configuração de MCP é necessária ou recomendada para este projeto.

---

## Environment Variables

### Documentadas em `.env.example`

| Variável | Categoria | Sensível | Obs. |
|----------|-----------|----------|------|
| `DATABASE_URL` | Database | ✅ | Default local hardcoded `postgres:postgres`; prod monta dinamicamente |
| `POSTGRES_PASSWORD` | Database | ✅ | Comentada; obrigatória só em prod (injetada no `docker-compose.prod.yml`) |
| `SESSION_SECRET` | Auth | ✅ | Guard de boot exige ≥32 chars e ≠ default de dev |
| `R2_ACCOUNT_ID` | Storage | ✅ | Cloudflare R2 (feature 0016F) |
| `R2_BUCKET` | Storage | ❌ | Nome do bucket |
| `R2_ACCESS_KEY_ID` | Storage | ✅ | |
| `R2_SECRET_ACCESS_KEY` | Storage | ✅ | |
| `R2_PUBLIC_URL` | Storage | ❌ | URL pública do bucket |

### Usadas em código mas **NÃO** documentadas no `.env.example`

| Variável | Onde | Categoria | Sensível |
|----------|------|-----------|----------|
| `FOUNDER_EMAIL` | `db/seeds/founder.ts:4` | Seed/operação | ❌ (PII leve) |
| `PRINTER_DEVICE` | `lib/services/print/printer-driver.ts:67` | Hardware/impressão | ❌ |

`NODE_ENV` também é lida em vários pontos, mas é gerenciada pelo runtime/Docker (não precisa estar no `.env.example`).

### Manuseio de segredos (positivos)

- `.gitignore` ignora todos os `.env*` exceto `.env.example` (linhas 33-36). ✅
- `.dockerignore` exclui `.env.local`/`.env*.local` da imagem (linhas 5-6) — segredos não vazam para o build. ✅
- `.env.example` contém apenas placeholders, nenhum segredo real. ✅
- `r2-check.ts` mascara segredos no log (`mask()`); não imprime valores completos. ✅
- Nenhum segredo hardcoded encontrado em código de aplicação (varredura de `process.env.*` e literais).

---

## Dependencies

### Vulnerabilidades encontradas (`npm audit` — 6 moderadas, 0 high/critical)

| Pacote | Severidade | Tipo | Descrição |
|--------|-----------|------|-----------|
| `esbuild` | 🟡 Moderada | dev (transitive) | Dev-server aceita requests de qualquer site e lê a resposta (GHSA esbuild). Só afeta o servidor de dev do esbuild. |
| `@esbuild-kit/core-utils` | 🟡 Moderada | dev (transitive) | Via `esbuild` |
| `@esbuild-kit/esm-loader` | 🟡 Moderada | dev (transitive) | Via `@esbuild-kit/core-utils` |
| `drizzle-kit` | 🟡 Moderada | dev | Puxa `@esbuild-kit/esm-loader`. Usado em `db:push`/`db:setup`. |
| `postcss` | 🟡 Moderada | build (transitive) | XSS via `</style>` não escapado no CSS stringify |
| `next` | 🟡 Moderada | runtime (transitive) | Via `postcss` |

### Avaliação

Nenhuma vulnerabilidade **high** ou **critical**. As do `esbuild`/`drizzle-kit` só impactam ambiente de desenvolvimento (não rodam em produção). As de `postcss`/`next` são de build-time/SSR de CSS — baixo risco prático aqui, mas resolvidas em updates do Next.

### Recomendação

```bash
npm audit fix          # tenta resolver sem breaking changes
# Se persistir em drizzle-kit, avaliar bump de major (validar db:push/db:setup depois)
```

---

## Local Environment (Docker)

### `docker-compose.yml` (dev)

| Serviço | Imagem | Porta | Descrição |
|---------|--------|-------|-----------|
| `db` | `postgres:16` | 5432 | Postgres local; volume `pdv_pgdata`; healthcheck `pg_isready` |

### `docker-compose.prod.yml` (Hetzner, sem reverse proxy)

| Serviço | Imagem | Porta | Descrição |
|---------|--------|-------|-----------|
| `db` | `postgres:16-alpine` | (interna) | Senha via `${POSTGRES_PASSWORD}`; volume `pdv_pgdata`; healthcheck |
| `app` | build local (Dockerfile) | `80:3000` | `depends_on db service_healthy`; env R2_* + SESSION_SECRET injetadas |

### `docker-compose.proxy.yml` (nginx, topologia alternativa)

| Serviço | Imagem | Porta | Descrição |
|---------|--------|-------|-----------|
| `nginx` | `nginx:alpine` | `80:80` | Rede externa `proxy-net`; monta `./nginx/nginx.conf` read-only |

**Pontos fortes:**
- As três topologias estão **bem documentadas** com avisos de conflito de porta 80 (mutuamente exclusivas).
- Healthchecks no Postgres com `depends_on: condition: service_healthy` no prod — o app não sobe antes do banco.
- Dockerfile multi-stage (`builder`/`runner`), `npm ci` para builds reproduzíveis.
- Boot de prod faz `db:setup && verify:prod && start` — schema+RLS aplicados e verificados antes de servir; se a verificação falhar, o boot é abortado (não serve inseguro).
- Versão do Postgres consistente (16) entre dev e prod.

**Observações:**
- Inconsistência menor: dev usa `postgres:16`, prod usa `postgres:16-alpine`. Diferença de variante (não de major) — aceitável, mas vale alinhar para paridade dev/prod.
- `nginx.conf` serve PDV + dois outros domínios (`rpmcontrol`) no **mesmo arquivo**, tudo em `listen 80` sem TLS. A terminação HTTPS (Let's Encrypt/Cloudflare) ocorre fora deste repo e **não é verificável** aqui.

---

## Issues Found

### 🔴 Critical

Nenhum.

---

### 🟠 High

#### [INF-001] Script de deploy embute IP do servidor e caminho da chave SSH no repositório
**Arquivo:** `scripts/deploy.sh:8-9`
```bash
SERVER="root@37.27.220.149"
KEY="/tmp/pdv_deploy"
```
**Impacto:** IP do host de produção e o usuário `root` ficam versionados no Git (repo público-capaz). Deploy como `root` direto via SSH é o cenário de maior blast-radius; um vazamento da chave em `/tmp/pdv_deploy` (local previsível, world-traversable em alguns sistemas) compromete o servidor inteiro. Além disso `StrictHostKeyChecking=no` desabilita verificação de host (risco de MITM no primeiro contato).
**Fix:** Mover `SERVER`/`KEY` para variáveis de ambiente ou um `.env.deploy` ignorado; usar usuário de deploy não-root; guardar a chave fora de `/tmp` com permissão `600`; preferir `accept-new` a `no` para host key checking.

---

### 🟡 Medium

#### [INF-002] Duas env vars usadas em código não estão no `.env.example`
**Arquivos:** `db/seeds/founder.ts:4` (`FOUNDER_EMAIL`), `lib/services/print/printer-driver.ts:67` (`PRINTER_DEVICE`)
**Impacto:** Quem roda o seed do founder ou tenta habilitar impressão USB não descobre essas vars pelo template; falha só em runtime (`throw new Error("FOUNDER_EMAIL ... is not set")`). Quebra o contrato "tudo que o código lê está no `.env.example`".
**Fix:** Documentar ambas no `.env.example` (mesmo que comentadas/opcionais), explicando quando são necessárias.

#### [INF-003] Sem pipeline de CI — validation gates rodam só manualmente
**Evidência:** Não existe `.github/workflows/` (nem outro CI). Os gates (`lint`, `typecheck`, `test`, `build`) estão definidos em `package.json` e no CLAUDE.md, mas a execução é 100% manual. `verify-prod.ts` comenta explicitamente "não existe pipeline de CI".
**Impacto:** Regressões (typecheck, testes de RLS, build) só são pegas se o dev lembrar de rodar localmente. O `verify-prod` no boot é uma boa rede de segurança para RLS/secret, mas não cobre lint/types/testes antes do merge.
**Fix:** Adicionar um workflow mínimo (GitHub Actions) rodando os 4 gates em PR; opcionalmente subir o Postgres de serviço para os testes de RLS.

#### [INF-004] `db:setup` usa `drizzle-kit push --force` no boot de produção
**Arquivos:** `package.json:20` (`db:setup`), `Dockerfile:31` (CMD), `scripts/deploy.sh:31-32`
**Impacto:** O boot de prod executa `drizzle-kit push --force`, que aplica o schema sem revisão de diff e **derruba as RLS policies** (documentado no CLAUDE.md). A sequência `db:setup && verify:prod` mitiga (reaplica RLS e aborta se faltar), mas `push --force` num banco com dados em produção pode causar operações destrutivas de coluna/tipo sem migração revisável. É a estratégia "push-only" oficial do projeto (RN01), portanto **decisão consciente** — registrado como risco, não como defeito.
**Fix (se/quando crescer):** Considerar gerar e revisar migrations (`db:generate`) para mudanças destrutivas em prod, mantendo push-only para dev. Garantir backup do volume `pdv_pgdata` antes de cada deploy que altere schema.

#### [INF-005] `nginx.conf` serve apenas HTTP (porta 80) e mistura múltiplos domínios
**Arquivo:** `nginx/nginx.conf`
**Impacto:** Nenhum `listen 443`/TLS no arquivo; o proxy encaminha PDV + `app.rpmcontrol.com.br` + `api.rpmcontrol.com.br` em HTTP puro. A terminação TLS deve estar em outra camada (Cloudflare/outro proxy) — não verificável neste repo. Se não houver TLS upstream, cookies de sessão (`secure: true` em prod) não chegariam pelo navegador via HTTP. Misturar domínios de outro produto no mesmo proxy aumenta o acoplamento operacional.
**Fix:** Confirmar onde o TLS é terminado e documentar; idealmente separar o vhost do PDV e garantir redirect 80→443.

---

### 🟢 Low / Informational

#### [INF-006] `npm audit`: 6 vulnerabilidades moderadas (0 high/critical)
Todas em dev-deps (esbuild/drizzle-kit) ou transitive de build (postcss/next). Baixo risco em produção. Rodar `npm audit fix` e acompanhar updates do Next/drizzle-kit. (Detalhe na seção *Dependencies*.)

#### [INF-007] Variante de imagem Postgres difere entre dev e prod
`postgres:16` (dev) vs `postgres:16-alpine` (prod). Mesmo major; alinhar para paridade.

---

## Recommendations

1. **[INF-001] Remover credenciais/host de deploy do Git** e adotar usuário não-root + chave fora de `/tmp` — maior redução de risco com menor esforço.
2. **[INF-002] Documentar `FOUNDER_EMAIL` e `PRINTER_DEVICE`** no `.env.example`.
3. **[INF-003] Adicionar CI mínimo** (Actions) com os 4 validation gates em PR.
4. **[INF-004/005] Documentar a estratégia de schema em prod e a terminação TLS**; garantir backup do volume antes de deploys que alteram schema.
5. **[INF-006] `npm audit fix`** e acompanhar o bump de drizzle-kit/next.

---

## Analysis Limitations

| Análise | Motivo | Como habilitar |
|---------|--------|----------------|
| Verificação de RLS ao vivo | Sem `DATABASE_URL`/Postgres no ar nesta sessão de auditoria | Subir `docker compose up -d` + `npm run db:rls`; ou inspecionar `scripts/verify-prod.ts` (já cobre isso no boot) |
| Terminação TLS / certificados | Configurada fora do repo (Cloudflare/proxy externo) | Inspecionar o host Hetzner (`/opt/pdv`) e o DNS/Cloudflare |
| Segredos reais de produção | Ficam só no ambiente do host (corretamente fora do Git) | Inspeção no servidor `/opt/pdv/.env` |
| MCP Supabase | N/A — projeto não usa Supabase | Não aplicável |

---

*Document generated by the infrastructure-check subagent*
