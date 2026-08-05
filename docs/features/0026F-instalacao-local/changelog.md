---
id: CHG0027
type: changelog
date: 2026-08-05
related: [0026F]
---

# CHG0027 — Feature 0026F: Instalação Local

## TL;DR

Entrega {{doc:0026F}}: empacota o PDV existente (zero mudança de código do app) para rodar via Docker no PC de um cliente específico, com os dados dele migrados da produção (Hetzner) para um Postgres local via dois novos scripts tsx (export/import por tenant, sem `pg_dump`), fotos de produto removidas (feature sendo descontinuada em iniciativa separada) e verificação de assinatura desligada (`valid_until=NULL`, caminho de código já existente). Dois scripts shell (`install-local.sh`/`update-local.sh`) e documentação separada por público (founder instala, cliente atualiza) completam o empacotamento; nuvem do cliente permanece ligada porém parada até decisão futura de desligamento. Review 8/10 PASSED (15/15 itens de spec, 10/10 SC01–SC10); 2 bugs de segurança/correção corrigidos na revisão (senha do Postgres não regenerável em retentativa; dado sensível documentado sem aviso).

## TOC

- [Changes](#changes)
- [Breaking](#breaking)
- [Migration](#migration)
- [Quick Ref](#quick-ref)

## Changes

- feat(scripts): `scripts/export-tenant.ts` — exporta um tenant inteiro (22 tabelas/grupos, em ordem de FK) para um único JSON via conexão owner Drizzle (bypassa RLS de propósito); `users` (sem `tenant_id`) filtrado por join com `tenant_members` — {{doc:0026F}}
- feat(scripts): `scripts/import-tenant.ts` — importa o JSON numa única transação atômica (FK ausente aborta tudo, zero estado parcial); aplica, na mesma transação, `tenants.valid_until=NULL`/`suspended_at=NULL` (desbloqueio de assinatura) e `products.image_key=NULL`/`image_url=NULL` (remoção de fotos) — {{doc:0026F}}
- feat(scripts): `scripts/install-local.sh` — primeira instalação no PC do cliente: checa Docker, aborta se `.env` já existe, gera `SESSION_SECRET`/`POSTGRES_PASSWORD` via `openssl rand -hex 32`, sobe Postgres (`docker-compose.prod.yml`), roda `db:setup` + `import-tenant.ts` + `verify:prod` dentro do container `app` (`docker compose run --rm`), depois sobe o app definitivo — {{doc:0026F}}
- feat(scripts): `scripts/update-local.sh` — atualização rodada pelo cliente: `git fetch`/checkout da tag mais recente + rebuild/restart do container `app`; nunca chama `db:setup`/`import-tenant.ts`/`verify:prod` diretamente, pois o `CMD` do `Dockerfile` já reexecuta essas etapas de forma idempotente a cada start — {{doc:0026F}}
- fix(scripts): `scripts/load-env-local.ts` — módulo de efeito colateral isolado para `config({ path: ".env.local" })`, importado como PRIMEIRO import em `export-tenant.ts`/`import-tenant.ts`; corrige hoisting de imports estáticos (ESM/CJS) que abria a conexão do banco antes do `.env.local` carregar — {{doc:0026F}}
- fix(scripts): `export-tenant.ts`/`import-tenant.ts` adicionam `process.exit(0)` explícito no caminho de sucesso — a conexão postgres-js fica aberta pra reuso e travava `install-local.sh` no meio da instalação mesmo após o trabalho terminar com sucesso — {{doc:0026F}}
- fix(docs): `SETUP.md`/`UPDATE.md` corrigem a URL de acesso pós-instalação de `http://localhost:3000` para `http://localhost` (porta mapeada é 80, não 3000, em `docker-compose.prod.yml`) — {{doc:0026F}}
- fix(scripts): `install-local.sh` roda `docker compose down -v` antes de gerar credenciais novas — a imagem oficial do Postgres só aplica `POSTGRES_PASSWORD` na primeira inicialização de um volume vazio; sem esse reset, uma retentativa após falha gerava uma senha que não batia com a já gravada no volume `pdv_pgdata` existente, quebrando o caminho de recuperação documentado no `SETUP.md` (achado na revisão de código) — {{doc:0026F}}
- fix(scripts): `install-local.sh` remove a linha `DATABASE_URL` (senha fraca de dev, hardcoded) herdada do `.env.example` ao gerar o `.env` do cliente — inerte hoje, mas era ruído/risco desnecessário num arquivo de segredos de produção (achado na revisão de código) — {{doc:0026F}}
- docs: `SETUP.md` recebe aviso explícito de que `tenant-export.json` contém PII e hash de senha e não deve ser commitado no repositório público; `.gitignore` ganha entrada `tenant-export*.json` como camada estrutural adicional (achado na revisão de código) — {{doc:0026F}}
- test: `db/__tests__/tenant-export-import.test.ts` (DB-gated, 5 casos: export escopado, import atômico com FK quebrada, fotos zeradas, assinatura desbloqueada, RLS íntegra pós-import) + `db/__tests__/local-install-scripts.test.ts` (estrutural, sem DB, 11 casos sobre o texto-fonte dos dois scripts shell + existência dos 2 docs) — {{doc:0026F}}
- docs: `docs/features/0026F-instalacao-local/SETUP.md` (founder — instalação/migração) e `UPDATE.md` (cliente — atualização), públicos e conteúdos separados por audiência — {{doc:0026F}}

## Breaking

none — nenhuma mudança de schema, endpoint ou UI; o código do app roda inalterado. As duas únicas alterações fora de `scripts/`/`docs/`/testes são `.gitignore` (aditiva) e os campos de dados do tenant migrado (`valid_until`, `suspended_at`, `image_key`, `image_url`), que só são zerados na cópia LOCAL do cliente migrado — a produção (Hetzner) não é tocada por nenhum destes scripts.

## Migration

Não há migração de schema — `db/schema/` e as policies RLS são reaproveitados como estão via `npm run db:setup` (push-only), sem alteração nesta feature. A "migração" desta entrega é operacional, executada manualmente pelo founder no PC do cliente:

1. Clonar o repositório publicamente no PC do cliente (`git clone`, pré-requisito manual).
2. Rodar `npx tsx scripts/export-tenant.ts <tenantId> tenant-export.json` contra a produção (Hetzner) para gerar o arquivo de dados do cliente.
3. Transferir o arquivo manualmente (scp/`docker cp`) para o PC do cliente — fora da pasta do repo clonado, por segurança (ver aviso em `SETUP.md`).
4. Rodar `bash scripts/install-local.sh tenant-export.json` no PC do cliente — gera credenciais, sobe Postgres, aplica schema, importa os dados (com fotos zeradas e assinatura desbloqueada), verifica RLS, sobe o app.
5. Confirmar acesso em `http://localhost`; a partir daí o cliente opera só pelo local — a nuvem desse cliente continua ligada (paga) porém parada, sem novos dados, como cópia de segurança passiva.
6. Rollback: nenhum procedimento formal — decisão explícita do founder (about.md); a nuvem parada serve como único fallback, sem plano de reativação automatizado.

## Quick Ref

```json
{
  "id": "0026F",
  "domain": "local-installation",
  "touched": [
    "scripts/",
    "db/__tests__/",
    "docs/features/0026F-instalacao-local/"
  ],
  "patterns": [
    "owner-bypass-connection",
    "fk-ordered-transactional-import",
    "atomic-data-scrub-on-import",
    "idempotent-boot-cmd-reuse",
    "fail-fast-boot-guard",
    "structural-regex-script-tests"
  ],
  "keywords": [
    "instalacao-local",
    "docker",
    "migracao-tenant",
    "export-import",
    "assinatura",
    "fotos",
    "rls"
  ]
}
```
