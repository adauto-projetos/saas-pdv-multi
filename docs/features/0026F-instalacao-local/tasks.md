# Tasks: 0026F — Instalação Local

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 8 |
| Services | test, database, backend |

## Requirements Coverage

- [x] SC01 — Instalação local via Docker no PC do cliente, sem alterar código do app
- [x] SC02 — Geração de credenciais locais (SESSION_SECRET, senha do banco) na instalação
- [x] SC03 — Script de migração de dados (estrutura completa + dados do tenant; janela de risco aceita)
- [x] SC04 — Remoção da cobrança de assinatura do cliente migrado (exceção comercial)
- [x] SC05 — Remoção das referências de foto de produto durante a migração
- [x] SC06 — Remoção da verificação de assinatura (`valid_until`) na cópia local
- [x] SC07 — Reaproveitamento de `verify-prod.ts` para confirmar RLS íntegro pós-migração
- [x] SC08 — Script de atualização que o cliente roda sozinho, reaproveitando versionamento existente
- [x] SC09 — Nuvem do cliente permanece ligada porém parada (corte de uso)
- [x] SC10 — Documentação separada de instalação/migração (founder) e atualização (cliente)

## TDD

- [x] db-SC03-export-scoped Export inclui só linhas do tenant alvo, nas 22 tabelas/grupos em ordem FK — `db/__tests__/tenant-export-import.test.ts`
- [x] db-SC03-import-fk-atomic Import insere respeitando ordem de FK numa única transação; FK ausente aborta tudo — `db/__tests__/tenant-export-import.test.ts`
- [x] db-SC05-photos-stripped Import zera `image_key`/`image_url` de todos os produtos do tenant migrado — `db/__tests__/tenant-export-import.test.ts`
- [x] db-SC06-subscription-unlocked Import zera `valid_until`/`suspended_at`; tenant nunca é bloqueado por assinatura vencida — `db/__tests__/tenant-export-import.test.ts`
- [x] db-SC07-verifyprod-post-import Checagem de RLS do `verify-prod.ts` passa contra o banco local pós-import — `db/__tests__/tenant-export-import.test.ts`
- [x] script-SC01-install-script-structure `install-local.sh` tem os passos/guardas esperados e não toca código do app — `db/__tests__/local-install-scripts.test.ts`
- [x] script-SC02-secrets-generated `install-local.sh` gera `SESSION_SECRET`/`POSTGRES_PASSWORD` fortes, não hardcoded — `db/__tests__/local-install-scripts.test.ts`
- [x] script-SC08-update-script-structure `update-local.sh` não toca dados, só reconstrói/reinicia o app — `db/__tests__/local-install-scripts.test.ts`
- [x] script-SC10-docs-exist Documentação de instalação (founder) e atualização (cliente) existem em arquivos separados — `db/__tests__/local-install-scripts.test.ts`

## Execution

- [x] T01 Write export/import test file for SC03/05/06/07
  - Service: test
  - Files: `db/__tests__/tenant-export-import.test.ts`
  - Deps: -
  - Verify: `npm test -- db/__tests__/tenant-export-import.test.ts` (expected red — scripts not yet implemented)

- [x] T02 Write install/update script structure test file
  - Service: test
  - Files: `db/__tests__/local-install-scripts.test.ts`
  - Deps: -
  - Verify: `npm test -- db/__tests__/local-install-scripts.test.ts` (expected red — scripts not yet created)

- [x] T03 Implement export-tenant.ts scoped FK-ordered export
  - Service: database
  - Files: `scripts/export-tenant.ts`
  - Deps: T01
  - Verify: `npm test -- db/__tests__/tenant-export-import.test.ts` (db-SC03-export-scoped green)

- [x] T04 Implement import-tenant.ts atomic import plus data-scrub updates
  - Service: database
  - Files: `scripts/import-tenant.ts`
  - Deps: T01, T03
  - Verify: `npm test -- db/__tests__/tenant-export-import.test.ts` (all 5 db-SC* cases green)

- [x] T05 Implement install-local.sh fresh-install orchestration script
  - Service: backend
  - Files: `scripts/install-local.sh`
  - Deps: T02, T04
  - Verify: `npm test -- db/__tests__/local-install-scripts.test.ts` (script-SC01, script-SC02 green) && `bash -n scripts/install-local.sh`

- [x] T06 Implement update-local.sh data-safe update orchestration script
  - Service: backend
  - Files: `scripts/update-local.sh`
  - Deps: T02
  - Verify: `npm test -- db/__tests__/local-install-scripts.test.ts` (script-SC08 green) && `bash -n scripts/update-local.sh`

- [x] T07 Write SETUP.md founder installation and migration runbook
  - Service: backend
  - Files: `docs/features/0026F-instalacao-local/SETUP.md`
  - Deps: T05
  - Verify: `npm test -- db/__tests__/local-install-scripts.test.ts` (script-SC10-docs-exist: SETUP.md path resolves)

- [x] T08 Write UPDATE.md client self-service update runbook
  - Service: backend
  - Files: `docs/features/0026F-instalacao-local/UPDATE.md`
  - Deps: T06
  - Verify: `npm test -- db/__tests__/local-install-scripts.test.ts` (script-SC10-docs-exist: UPDATE.md path resolves)

## Acceptance Checklist

- [x] `scripts/install-local.sh` aborta com mensagem clara se `.env` já existe ("já instalado, use update-local.sh") (SC01)
- [x] `scripts/install-local.sh` não referencia arquivos em `app/`, `lib/`, `components/` ou `db/schema/` — só empacotamento, código do app intocado (SC01)
- [x] `scripts/install-local.sh` gera `SESSION_SECRET` e `POSTGRES_PASSWORD` via `openssl rand -hex 32` e grava no `.env`; nenhum valor default/hardcoded é persistido (SC02)
- [x] `scripts/export-tenant.ts` exporta as 22 tabelas/grupos em ordem de FK, escopado a um único `tenantId`, zero linhas de outros tenants (SC03)
- [x] `scripts/import-tenant.ts` insere todas as linhas numa única transação; uma FK quebrada aborta o import inteiro, zero linhas parciais persistidas (SC03)
- [x] `SETUP.md` documenta a transferência manual do JSON exportado e o risco de janela de dados aceito (reconciliação manual, sem mecanismo automático) (SC03)
- [x] `SETUP.md`/runbook do founder registra que o cliente migrado para de ser cobrado a partir da migração — exceção comercial, sem gate técnico (SC04)
- [x] `import-tenant.ts` zera `products.image_key` e `products.image_url` para todos os produtos do tenant importado (SC05)
- [x] `import-tenant.ts` zera `tenants.valid_until` e `tenants.suspended_at` após o insert, de forma que `getTenantStatus()`/`requireActiveTenant()` nunca retornem/lancem estado travado localmente (SC06)
- [x] `scripts/install-local.sh` roda `db:setup` → `import-tenant.ts` → `verify:prod` dentro do container `app` antes de `up -d app`, reaproveitando `verify-prod.ts` inalterado para confirmar RLS íntegro (SC07)
- [x] `scripts/update-local.sh` aborta com mensagem clara se `.env` não existe ("rode install-local.sh primeiro") (SC08)
- [x] `scripts/update-local.sh` só faz `git fetch`/checkout + `docker compose build app` + `up -d app` — nunca chama `db:setup`/`import-tenant.ts`/`verify:prod` diretamente (SC08)
- [x] `UPDATE.md` documenta o fluxo de atualização rodado pelo cliente, sem etapa de suporte remoto (SC08)
- [x] `SETUP.md` documenta que a instância na nuvem do cliente continua ligada (não desativada) porém para de receber novos dados a partir do corte de uso local (SC09)
- [x] `SETUP.md` e `UPDATE.md` existem como dois arquivos distintos em `docs/features/0026F-instalacao-local/`, um por público (founder vs. cliente) (SC10)

## Validation Gates

- [x] Run `npm run lint` and fix failures in files touched by this work
- [x] Run `npm run typecheck` and fix failures in files touched by this work
- [x] Run `npm test` and fix failures in files touched by this work
- [x] Run `npm run build` and fix failures

Re-executados de forma independente pelo coordenador (não pelo implementador) em 2026-08-04, após ambas as áreas validadas: lint 0 erros/8 warnings pré-existentes, typecheck limpo, test 581/582 (1 falha pré-existente, ver Known Issues), build com sucesso.

Re-executados de novo em 2026-08-05 após teste manual ponta a ponta (`install-local.sh` rodado de verdade, com Docker, contra um tenant real de dev) ter revelado 3 bugs que nenhum teste automatizado pegou — todos corrigidos, registrados em `decisions.jsonl`/`iterations.jsonl`, e re-testados manualmente do zero até confirmar sucesso: (1) `export-tenant.ts`/`import-tenant.ts` falhavam com erro de autenticação ao rodar fora do container, sem variável de ambiente pré-exportada na mão (ordem de import em ESM/CJS fazia `config()` rodar tarde demais — corrigido com módulo `scripts/load-env-local.ts` importado primeiro); (2) `install-local.sh`/`update-local.sh`/`SETUP.md`/`UPDATE.md` diziam "acesse http://localhost:3000", mas a porta mapeada é 80, não 3000; (3) `export-tenant.ts`/`import-tenant.ts` terminavam o trabalho com sucesso mas travavam o processo (sem `process.exit(0)`), o que travava `install-local.sh` no meio da instalação. Gates re-rodados após os 3 fixes: lint/typecheck/build limpos, test 581/582 (mesma falha pré-existente).

Re-executados de forma independente pelo `/add.review` em 2026-08-05, após revisão de backend ter corrigido 2 problemas (senha do Postgres não regenerável numa retentativa pós-falha — `install-local.sh` agora roda `docker compose down -v` antes de gerar credenciais; `DATABASE_URL` de dev sobrevivendo no `.env` do cliente — removido) e mitigado 1 risco de exposição de dado sensível (`tenant-export.json` documentado como não devendo ser commitado no repositório público — aviso adicionado ao `SETUP.md` + entrada em `.gitignore`): `npm run lint` → exit 0 (8 warnings pré-existentes, arquivos não tocados por esta feature), `npm run typecheck` → exit 0, `npm test` → exit 1 (581/582 — falha isolada em `components/admin/ReleaseDialog.test.tsx`, não tocado por esta feature, ver Known Issues), `npm run build` → exit 0.

### Known Issues

- `components/admin/ReleaseDialog.test.tsx:42` — teste T67 (feature 0013F) falha por drift de data: compara uma data-alvo hardcoded (`01/01/2027`) contra um cálculo relativo (`addCalendarMonths` a partir de hoje), que já não bate mais com o calendário atual. Não tocado por esta feature (`git status` confirma: nenhum arquivo de 0013F/ReleaseDialog no diff).
