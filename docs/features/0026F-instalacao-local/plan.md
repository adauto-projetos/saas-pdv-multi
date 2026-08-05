---
id: 0026F
type: feature-plan
related: [0026F]
created: 2026-08-04
updated: 2026-08-04
---

# Plan: 0026F — Instalação Local

## TL;DR

Empacota o PDV existente (sem alterar código do app) para rodar via Docker no PC do único cliente ativo hoje, com os dados dele migrados da produção (Hetzner) para um Postgres local. Não há schema novo, endpoint novo nem UI nova — a entrega é inteiramente operacional: dois scripts de dados (export/import por tenant), dois scripts de empacotamento (instalação/atualização) e documentação separada para founder (instala) e cliente (atualiza). Decisão técnica central: nenhuma ferramenta de dump externa (`pg_dump`) — schema é reconstruído via `db:setup` (push-only, já existente) e só os dados do tenant viajam, via dois scripts tsx que reaproveitam o stack Drizzle já usado em todo o projeto.

## TOC

- [Context](#context)
- [Architecture Decisions](#architecture-decisions)
- [Risks](#risks)
- [Validation](#validation)
- [Main Flow](#main-flow)
- [Test Specification](#test-specification-0026f)
- [Database / Data Migration](#database--data-migration-0026f)
- [Scripts & Packaging](#scripts--packaging-0026f)
- [Documentation Deliverables](#documentation-deliverables)
- [Requirements Coverage](#requirements-coverage)
- [Implementation Order](#implementation-order)
- [Quick Reference](#quick-reference)

## Context

{{doc:0026F}} (about.md) já validou o escopo de negócio com o founder: fotos removidas, verificação de assinatura removida (`valid_until=NULL`), cliente para de pagar mensalidade, corte de uso sem janela de manutenção obrigatória, nuvem fica parada (não desligada) até decisão manual futura do founder. Este plano adiciona o desenho técnico em cima disso: como migrar os dados com segurança (ordem de FK, atomicidade, checagem de integridade), como empacotar a instalação/atualização sem tocar no código do app, e como cada decisão de negócio se traduz num mecanismo técnico concreto (ex.: "remover a trava de assinatura" → `valid_until=NULL`, um caminho de código já existente).

## Architecture Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Migração de dados via scripts tsx (`export-tenant.ts`/`import-tenant.ts`), não `pg_dump` | `users` não tem `tenant_id` — precisa filtro por join com `tenant_members`, que um `--where` uniforme não expressa; reaproveita o mesmo stack Drizzle/`postgres` de todo script existente | `pg_dump --where` por tabela — não cobre o caso `users`, exigiria lógica híbrida |
| Schema local reconstruído via `npm run db:setup` (push-only), não um dump literal da estrutura de prod | Autocorrige drift, mantém `db/schema/` como fonte única da verdade (regra push-only do CLAUDE.md) | Dump literal do DDL de produção — pode carregar drift não documentado |
| Desbloqueio de assinatura via `valid_until=NULL`, não uma data futura distante | Caminho de código já existente e testado (`getTenantStatus()` só avalia expiração `if (validUntil !== null)`), zero mudança de aplicação; uma data sintética poderia um dia também vencer | Estender `valid_until` para uma data distante (ex. +10 anos) — funciona, mas é um valor sintético que ainda pode expirar e precisa ser lembrado |
| Passos de banco do `install-local.sh` rodam dentro do container `app` (`docker compose run`), não no host | Docker Desktop é o único pré-requisito citado em about.md/discovery.md — Node.js nunca foi listado como requisito do PC do cliente | Rodar `npm`/`npx` direto no host — exigiria instalar Node.js separadamente, novo pré-requisito não validado com o founder |
| Atualização via `git fetch`/checkout de tags existentes, não GitHub Releases | Reaproveita o que já existe (`scripts/deploy.sh` já cria tags num repo público, confirmado via `gh repo view`); GitHub Releases seria infraestrutura nova | GitHub Releases — mais "produto acabado", mas não é reaproveitamento, é construir algo novo fora do escopo validado |

## Risks

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| FK ausente/órfã durante o import trava a migração inteira | Baixa (schema validado antes do import) | Cliente fica sem sistema local funcionando na primeira tentativa | Constraints reais do Postgres abortam a transação atomicamente (sem estado parcial); `T01`/`T04` cobrem isso em teste antes da instalação real |
| Docker Desktop/WSL2 não instala ou não tem recursos suficientes no PC do cliente | Média (fora do controle do founder) | Instalação trava fora dos scripts, sem diagnóstico automatizado | Fora de escopo desta entrega (about.md); `SETUP.md` deve documentar o pré-requisito claramente para o founder verificar antes de ir ao cliente |
| Venda/fiado lançado na janela entre export e corte de uso local | Baixa-média (depende do horário da migração) | Dado perdido ou duplicado, exige reconciliação manual | Risco aceito explicitamente pelo founder (about.md); `SETUP.md` documenta o procedimento de reconciliação manual |
| Update script (`update-local.sh`) falha no meio (rede caindo, `git fetch` incompleto) | Baixa | Cliente fica preso numa versão parcialmente atualizada | `git fetch`/checkout é atômico por natureza (não sobrescreve working tree até checkout completo); sem rollback automático adicional nesta entrega (fora de escopo, decisão do founder) |

## Validation

Cobertura completa de contrato em `### Test Specification` abaixo (10/10 requisitos SC01–SC10, testes automatizados onde possível + verificação manual explícita onde não é). Gates finais de qualidade em `tasks.md` → `## Validation Gates` (lint, typecheck, test, build) — rodados e conferidos antes de considerar a feature pronta para revisão.

## Main Flow

1. **Founder** clona o repositório publico uma vez no PC do cliente (pré-requisito manual, fora dos scripts).
2. **Founder** roda `scripts/export-tenant.ts` contra a produção (Hetzner) → gera um JSON com os dados só desse tenant, em ordem de FK.
3. **Founder** transfere o JSON manualmente (scp/`docker cp`) para o PC do cliente.
4. **Founder** roda `scripts/install-local.sh <arquivo.json>` no PC do cliente → gera credenciais (`SESSION_SECRET`, `POSTGRES_PASSWORD`) → sobe Postgres → `db:setup` (schema + RLS) → `import-tenant.ts` (dados + zera fotos + zera trava de assinatura) → `verify:prod` (confirma RLS íntegra) → sobe o app.
5. **Cliente** passa a operar local; a nuvem desse cliente fica ligada porém parada (sem novos dados) — "corte de uso".
6. **Founder**, quando lançar correção/novidade, publica uma versão (tag via `scripts/deploy.sh`, já existente); **cliente** roda `scripts/update-local.sh` sozinho para atualizar, sem tocar nos dados.
7. **Founder** decide manualmente, no futuro, o "desligamento da nuvem" (fora do escopo desta entrega — gatilho adiado).

---

## Test Specification (0026F)

Feature é infra/ops-heavy (Docker, shell, migração de dados), não app-layer. "Teste de contrato" aqui = testes automatizados (Vitest) contra os scripts de dados `export-tenant.ts`/`import-tenant.ts` (mesmo padrão de `db/__tests__/tenant-isolation-regression.test.ts`), checks estruturais sobre o texto dos scripts shell/docs (mesmo padrão de `db/__tests__/migration-strategy.test.ts`), e verificação manual explícita para o que só existe fora do dev machine (Docker Desktop real, PC do cliente, decisão comercial).

### Contract Tests (from Scope Includes)

| ID | Test Case | Area | SC-ID | Input | Expected Output | Verify |
|----|-----------|------|-------|-------|-----------------|--------|
| db-SC03-export-scoped | Export inclui só linhas do tenant alvo, nas 22 tabelas/grupos em ordem FK (plan-database.md) | db | SC03 | 2 tenants seedados (A, B) com 1 linha semeada por tabela/grupo cada; `exportTenant(tenantB)` | JSON resultante tem contagem==1 por tabela para tenantB e zero linhas de tenantA em qualquer tabela | Comparar contagem por tabela no JSON exportado vs. seed; nenhuma linha com `tenant_id=tenantA` |
| db-SC03-import-fk-atomic | Import insere nas 22 tabelas respeitando ordem de FK numa única transação; FK ausente aborta tudo (atômico, sem estado parcial) | db | SC03 | (a) JSON válido do caso anterior, importado em schema local vazio pós `db:setup`; (b) mesmo JSON com um `sale_items` apontando para `sale_id` inexistente | (a) todas as linhas inseridas, contagem local == contagem exportada; (b) import falha (exit≠0), zero linhas do tenant persistidas em qualquer tabela (rollback via FK real do Postgres) | Contagem por tabela pós-import (a) bate com export; contagem pós-falha (b) é zero em todas as tabelas |
| db-SC05-photos-stripped | Import zera `image_key`/`image_url` de todos os produtos do tenant migrado | db | SC05 | Export com ≥1 produto tendo `image_key`/`image_url` preenchidos (simula referência R2 de produção) | Pós-import, `products.image_key IS NULL` e `products.image_url IS NULL` para todos os produtos do tenant importado | `SELECT` direto na tabela local pós `import-tenant.ts` |
| db-SC06-subscription-unlocked | Import zera `valid_until`/`suspended_at`; tenant nunca é bloqueado por assinatura vencida | db | SC06 | Export com `tenants.valid_until` no passado (vencido) e `subscription_log` com ação `renewed` | Pós-import, `valid_until IS NULL` e `suspended_at IS NULL`; `getTenantStatus()` retorna `ativa`/`testando` (nunca `travada`); `requireActiveTenant()` não lança | `SELECT tenants` pós-import + chamada direta a `getTenantStatus()`/`requireActiveTenant()` (`lib/services/subscriptions/subscription-status.ts`, `lib/auth/tenant-guard.ts`) |
| db-SC07-verifyprod-post-import | Checagem de RLS do `verify-prod.ts` passa contra o banco local pós-import | db | SC07 | Banco local pós `db:setup` + `import-tenant.ts` concluído | Para as 20 tabelas com `tenant_id`: `relrowsecurity=true` e ≥1 `pg_policy`; `SESSION_SECRET` válido não gera erro | Reexecutar a query de catálogo de `scripts/verify-prod.ts` (`verifyRlsPolicies`) contra o `DATABASE_URL` de teste; 0 problemas retornados |
| script-SC01-install-script-structure | `install-local.sh` tem os passos/guardas esperados e não toca código do app | script | SC01 | Ler o conteúdo-fonte de `scripts/install-local.sh` | Contém guarda "abort se `.env` já existe"; usa `docker-compose.prod.yml`; roda `db:setup` + `import-tenant.ts` + `verify:prod` dentro do container `app` antes do `up -d app`; não referencia arquivos em `app/`, `lib/`, `components/`, `db/schema/` | `readFileSync` + regex sobre o script-fonte (mesmo padrão de `db/__tests__/migration-strategy.test.ts`) |
| script-SC02-secrets-generated | `install-local.sh` gera `SESSION_SECRET`/`POSTGRES_PASSWORD` fortes, não hardcoded | script | SC02 | Ler o conteúdo-fonte de `scripts/install-local.sh` | Contém geração via `openssl rand -hex 32` (≥32 bytes) para os dois valores, gravados no `.env`; nenhum literal fixo (ex. default de dev) é gravado como valor | Regex sobre o script-fonte; complementado pelo guard já existente e inalterado em `lib/auth/session.ts` (`SESSION_SECRET`<32 chars ou == default falha o boot) |
| script-SC08-update-script-structure | `update-local.sh` não toca dados, só reconstrói/reinicia o app | script | SC08 | Ler o conteúdo-fonte de `scripts/update-local.sh` | Contém guarda "abort se `.env` não existe"; faz `git fetch`/checkout + `docker compose build app` + `up -d app`; NÃO chama `db:setup`/`import-tenant.ts`/`verify:prod` diretamente (Dockerfile CMD já reexecuta isso de forma idempotente) | `readFileSync` + regex sobre o texto do script |
| script-SC10-docs-exist | Documentação de instalação/migração (founder) e de atualização (cliente) existem em arquivos separados | script | SC10 | Listar arquivos em `docs/features/0026F-instalacao-local/` | Existe um doc de setup/migração (público founder) e um doc de atualização (público cliente), em arquivos distintos | `existsSync()` sobre os paths esperados (ex.: `SETUP.md`, `UPDATE.md`) |
| manual-SC01-fresh-pc-boot | Instalação real numa máquina Windows limpa com Docker Desktop | manual | SC01 | PC do cliente (ou equivalente) com Docker Desktop instalado, sem instalação prévia | `bash scripts/install-local.sh <export.json>` sobe o app em `http://localhost:3000` na primeira tentativa, sem erro, sem editar código do app | Observação direta do founder (Success Metrics: "instalação sem erro"); não automatizável — requer Docker Desktop/Windows PC reais, fora do alcance do Vitest/CI |
| manual-SC03-transfer-and-window-risk | Transferência manual do JSON exportado + janela de risco de dados aceita | manual | SC03 | Arquivo `tenant-export.json` gerado na Hetzner | Founder copia o arquivo (scp/`docker cp`) para o PC do cliente; venda/fiado lançado na janela dump→corte de uso é reconciliado manualmente, sem mecanismo automático | Checklist do founder; não automatizável por design — cópia manual e reconciliação manual são decisões explícitas do about.md, não comportamento de código |
| manual-SC04-no-billing-charge | Cliente migrado para de ser cobrado (exceção comercial) | manual | SC04 | N/A — não existe integração de billing/Asaas ativa no código (CLAUDE.md: billing pós-MVP) | Founder confirma que nenhuma cobrança/fatura é emitida a esse cliente a partir da data da migração | Confirmação manual do founder; não há gate técnico a testar, pois não existe cobrança automatizada hoje |
| manual-SC08-client-self-service-update | Cliente roda `update-local.sh` sozinho, sem suporte remoto | manual | SC08 | Cliente avisado pelo founder de nova versão disponível | Cliente executa `bash scripts/update-local.sh` na própria máquina e o app sobe atualizado, sem suporte remoto | Observação do founder na primeira atualização aplicada (Success Metrics); depende de ação humana real fora do dev machine |
| manual-SC09-cloud-paused | Nuvem do cliente continua ligada (paga) porém parada, sem novos dados | manual | SC09 | Instância Hetzner desse cliente, após o corte de uso para o local | Instância segue no ar (não desligada) mas não recebe mais vendas/dados do cliente a partir do corte de uso | Observação do founder; não há flag técnica de "modo pausado" no escopo — é acordo operacional (parar de usar a URL da nuvem), não comportamento de código |
| manual-SC10-docs-nontechnical-usable | Documentação é utilizável por usuários não técnicos (founder instala, cliente atualiza) | manual | SC10 | Docs de setup e de atualização (ver `script-SC10-docs-exist`) | Founder segue o doc de instalação sem ajuda externa; cliente segue o doc de atualização sozinho | Observação do founder (Success Metrics); clareza de prosa não é testável automaticamente, só existência estrutural (`script-SC10-docs-exist`) |

### Test File Mapping

| Area | Test File | Test IDs |
|------|-----------|----------|
| db | `db/__tests__/tenant-export-import.test.ts` (novo; `HAS_DB`-gated, mesmo padrão de `tenant-isolation-regression.test.ts`) | db-SC03-export-scoped, db-SC03-import-fk-atomic, db-SC05-photos-stripped, db-SC06-subscription-unlocked, db-SC07-verifyprod-post-import |
| script | `db/__tests__/local-install-scripts.test.ts` (novo; estrutural, sem DB, mesmo padrão de `migration-strategy.test.ts`) | script-SC01-install-script-structure, script-SC02-secrets-generated, script-SC08-update-script-structure, script-SC10-docs-exist |
| manual | N/A — runbook manual (checklist do founder, não é arquivo Vitest) | manual-SC01-fresh-pc-boot, manual-SC03-transfer-and-window-risk, manual-SC04-no-billing-charge, manual-SC08-client-self-service-update, manual-SC09-cloud-paused, manual-SC10-docs-nontechnical-usable |

---

## Database / Data Migration (0026F)

No schema change. `db/schema/` e `db/migrations/*_rls.sql` são reaproveitados como estão. Isto é só design de operação de dados.

### Migration Approach

| Step | What | How | Why |
|---|---|---|---|
| 1. Schema | Reconstrói a estrutura completa localmente (tabelas, constraints, RLS) — não é um snapshot literal de `pg_dump` | `npm run db:setup` (push-only, **inalterado**) | Mais forte que dumpar o DDL literal da prod: autocorrige drift, mantém `db/schema/` como fonte única da verdade (regra push-only do CLAUDE.md) |
| 2. Export | Só dados do tenant, 22 tabelas/grupos em ordem de FK (tabela abaixo) | Novo `scripts/export-tenant.ts` (tsx), rodado com `DATABASE_URL`→prod (dentro do container app da Hetzner, que já tem `tsx`+`postgres` — `Dockerfile:20-22`) → grava um único arquivo JSON | Sem dependência de pg_dump/psql; reaproveita exatamente o stack que todo outro script já usa |
| 3. Transferência | Founder copia o arquivo JSON da Hetzner para o PC do cliente | Manual (scp/`docker cp`) | Fora do escopo dos scripts — não existe caminho de rede assumido entre as duas máquinas |
| 4. Import | Insere linhas na mesma ordem de FK, numa transação, via conexão owner | Novo `scripts/import-tenant.ts` (tsx), rodado localmente com `DATABASE_URL`→local, **depois** do passo 1 | Conexão owner ignora RLS, mesmo padrão de `db/__tests__/seed.ts` / `scripts/seed-testfull.ts` |
| 5. Ajustes de dados | Desbloqueio de assinatura + remoção de foto, aplicados no import (não no export) | ver abaixo | Mantém o export uma cópia fiel; a decisão de negócio é aplicada uma vez, no destino |

**Por que não `pg_dump --where`:** `users` não tem `tenant_id` — precisa ser filtrada via join com `tenant_members`, que um `--where` plano aplicado uniformemente entre flags `--table` não consegue expressar. Um `SELECT` tipado por tabela (mesmo stack Drizzle/`postgres` de todo script existente) cobre tanto as tabelas com `tenant_id` direto quanto o caso `users` filtrado por join, num único script.

### Table export/import order (respeitando FK; `*` = FK opcional, ainda validada pelo Postgres quando não-nula)

| # | Table | Parents | Filter |
|---|---|---|---|
| 1 | tenants | — | `id = $tenantId` |
| 2 | users | — | `id IN (SELECT user_id FROM tenant_members WHERE tenant_id=$1)` |
| 3 | tenant_members | tenants, users | `tenant_id=$1` |
| 4 | user_permissions | tenants, users | `tenant_id=$1` |
| 5 | override_log | tenants, users | `tenant_id=$1` |
| 6 | product_categories | tenants | `tenant_id=$1` |
| 7 | products | tenants, product_categories | `tenant_id=$1` |
| 8 | customers | tenants | `tenant_id=$1` |
| 9 | cash_sessions | tenants, users | `tenant_id=$1` |
| 10 | payables | tenants, users | `tenant_id=$1` |
| 11 | kitchen_order_seqs | tenants | `tenant_id=$1` (PK composta `tenant_id,date` — sem `id`) |
| 12 | subscription_log | tenants, users | `tenant_id=$1` |
| 13 | sales | tenants, users, customers* | `tenant_id=$1` |
| 14 | sale_items | sales, tenants, products | `tenant_id=$1` |
| 15 | stock_movements | tenants, products, sales*, users | `tenant_id=$1` |
| 16 | comandas | tenants, users, sales* | `tenant_id=$1` |
| 17 | comanda_items | tenants, comandas, products* | `tenant_id=$1` |
| 18 | cash_movements | tenants, users, sales*, cash_sessions* | `tenant_id=$1` |
| 19 | receivables | tenants, customers, sales*, users | `tenant_id=$1` |
| 20 | receivable_payments | tenants, receivables, cash_movements*, users | `tenant_id=$1` |
| 21 | payable_payments | tenants, payables, cash_movements*, users | `tenant_id=$1` |
| 22 | print_logs | tenants, users (`trigger_id` polimórfico, sem FK) | `tenant_id=$1` |

Corresponde às 20 tabelas com tenant_id de `db/__tests__/tenant-isolation-regression.test.ts:20-26`, mais `tenants` + `users` (pais, não escopados por tenant_id eles mesmos).

### Subscription Unlock Mechanism

| Field | Table | Prod value | Local target | How set |
|---|---|---|---|---|
| `valid_until` | `tenants` | timestamp vencido/passado | `NULL` | Script de import: `UPDATE tenants SET valid_until=NULL WHERE id=$1` após inserir a linha |
| `suspended_at` | `tenants` | normalmente já `NULL` | `NULL` (forçado) | Mesmo statement |
| `products.image_key` / `image_url` | `products` | referências R2 | `NULL` | Script de import: `UPDATE products SET image_key=NULL, image_url=NULL WHERE tenant_id=$1` (conforme escopo do about.md — sem R2 local) |

**Por que NULL, não uma data distante:** `getTenantStatus()` (`lib/services/subscriptions/subscription-status.ts:21`) só avalia a checagem de expiração/carência dentro de `if (tenant.validUntil !== null)`. Um `valid_until` `NULL` pula esse trecho inteiramente — é o mesmo estado já usado por tenants legados/seed (comentário em `db/schema/tenants.ts:29`). É um caminho de código pré-existente e testado, não um valor sintético que poderia um dia também vencer. `requireActiveTenant()` (`lib/auth/tenant-guard.ts:21`) então sempre resolve para `testando`/`ativa` conforme `hasRenewed` (derivado das linhas de `subscription_log` migradas, ação `renewed`) — nunca `travada`. Zero mudança de código de aplicação.

### New Script(s)

| Script | Purpose | Reference (similar existing file) |
|---|---|---|
| `scripts/export-tenant.ts` | `SELECT` por tabela em ordem de FK para um tenant → um único JSON, rodado contra `DATABASE_URL` de prod | `db/__tests__/seed.ts` (referências de tabela Drizzle); `scripts/apply-rls.ts` (formato CLI tsx+dotenv) |
| `scripts/import-tenant.ts` | Lê o JSON, insere na mesma ordem de FK numa transação via `db` owner (ignora RLS); aplica os dois `UPDATE`s acima após o insert | `scripts/seed-testfull.ts` (padrão de insert em massa via conexão owner) |

Ambos são TypeScript rodado via tsx, consistente com a convenção `scripts/*.ts` existente (`verify-prod.ts`, `apply-rls.ts`, `seed-product-categories.ts` — não existe ferramenta shell/pg_dump hoje, confirmado via `scripts/*.sh` = só `deploy.sh`, um script de deploy via SSH não relacionado).

### Integrity Validation

| Check | Mechanism |
|---|---|
| Linhas órfãs/FK | Grátis, por construção: as constraints reais de FK do Postgres (do schema do passo 1) rejeitam qualquer linha cujo pai não foi exportado, abortando a transação de import atomicamente — sem estado parcial pra limpar |
| Paridade de contagem | `import-tenant.ts` registra contagem exportada vs. inserida por tabela; qualquer divergência → saída não-zero |
| RLS estruturalmente íntegra | `npm run verify:prod` (inalterado, `scripts/verify-prod.ts`) — já é o último passo de boot antes do `npm start` |
| Isolamento entre tenants | `npm test` → `db/__tests__/tenant-isolation-regression.test.ts` (inalterado) — semeia seus próprios tenants A/B descartáveis, então valida o mecanismo de RLS de forma genérica pós-`db:setup`, independente de qual tenant foi importado |

Ordem de execução na máquina local: `docker compose up -d db` → `npm run db:setup` → `npx tsx scripts/import-tenant.ts tenant-export.json` → `npm run verify:prod` → `npm test` (ou só `tenant-isolation-regression.test.ts`).

---

## Scripts & Packaging (0026F)

Sem endpoints/serviços/schema novos — só empacotamento operacional. Envolve os scripts de dados já desenhados acima (`export-tenant.ts`/`import-tenant.ts`), não redesenhados aqui.

### New Script(s)

| Script | Purpose | Calls / Order | Reference |
|---|---|---|---|
| `scripts/install-local.sh` | Primeira instalação, PC do cliente limpo | `docker info` (checa Docker) → guarda (aborta se `.env` já existe, "já instalado, use update-local.sh") → exige argumento: caminho do JSON exportado do tenant (transferido manualmente, ver seção de dados) → copia `.env.example`→`.env`, gera `SESSION_SECRET`+`POSTGRES_PASSWORD` (`openssl rand -hex 32`) → `docker compose -f docker-compose.prod.yml up -d db` (espera saudável) → `docker compose ... run --rm -v <export-file>:/tmp/import.json:ro app sh -c "npm run db:setup && npx tsx scripts/import-tenant.ts /tmp/import.json && npm run verify:prod"` → `docker compose ... up -d app` | `scripts/deploy.sh` (formato bash, `set -e`, passos com echo); `.env.example` (template) |
| `scripts/update-local.sh` | Aplica nova versão, sem tocar em dados | guarda (aborta se `.env` não existe, "rode install-local.sh primeiro") → `git fetch origin --tags && git checkout <tag>` (ou `git pull origin master`) → `docker compose -f docker-compose.prod.yml build app` → `docker compose ... up -d app`. Sem chamadas manuais a `db:setup`/`import`/`verify` — o CMD do Dockerfile já as reexecuta automaticamente no start do container (idempotente), igual ao caminho da Hetzner | `scripts/deploy.sh:26-35` (bloco Hetzner: pull→build→up, mesmo formato sem SSH) |

**Resolvido (coordenador, fase de plano):** os três passos de banco do `install-local.sh` (`db:setup` → `import-tenant.ts` → `verify:prod`) rodam **dentro** do container `app` já construído via `docker compose run`, não no host — assim Docker Desktop continua sendo o único pré-requisito (Node.js nunca foi listado como requisito do PC do cliente).

**Resolvido (coordenador, fase de plano):** founder clona o repositório manualmente como pré-requisito único (`git clone` do remoto público), depois roda `bash scripts/install-local.sh <arquivo>` de dentro dele. `install-local.sh` não se autoclona — documentar como primeiro passo do `SETUP.md`.

### Docker / Compose

- `docker-compose.prod.yml` reaproveitado **como está** — sem novo compose local. Já é genérico: sem caminhos/IPs da Hetzner, `POSTGRES_PASSWORD`/`SESSION_SECRET` parametrizados via `${VAR}` (script de install preenche o `.env`), volume nomeado `pdv_pgdata` não precisa mudar de caminho no Docker Desktop.
- Vars R2_*: deixadas em branco no `.env`. `docker compose` avisa ("variable not set") mas não falha; `lib/services/storage/r2-client.ts:60-77` só constrói o `S3Client`/lança erro no primeiro `put`/`del`, nunca no import ou no boot — confirma o achado de lazy-init do discovery.md, seguro omitir.
- `docker-compose.proxy.yml` (nginx) não é necessário — essa topologia é do proxy reverso da Hetzner; o PC do cliente usa o mapeamento direto `80:3000` já em `docker-compose.prod.yml`.
- `docker-compose.yml` (Postgres puro, senha fraca hardcoded) continua só para dev, não reaproveitado nas instalações de cliente.

### Versioning & Update Delivery

- Verificado, não assumido: não existem GitHub Releases hoje (`gh release list` → vazio, sem `.github/workflows`). `scripts/deploy.sh` só cria tags git (24 existentes, `v0.1.0`…`v0.16.0`) e empurra pra um remoto **público** (`gh repo view` → `adauto-projetos/saas-pdv-multi`, visibilidade PUBLIC).
- Mecanismo recomendado: o PC do cliente mantém um `git clone` do repositório público; `update-local.sh` faz `git fetch --tags` + checkout, reaproveitando o histórico de tags que `deploy.sh` já produz. Bate com a redação literal do about.md ("reaproveitando o processo de versionamento existente") — não com a opção aspiracional "GitHub Releases" que o discovery.md só cogitou, que seria infraestrutura nova, não reaproveitamento.

### Environment Variables

| Var | Source | Required? |
|---|---|---|
| `POSTGRES_PASSWORD` | gerado por `install-local.sh` (`openssl rand -hex 32`) | Sim |
| `SESSION_SECRET` | gerado por `install-local.sh`, ≥32 chars, nunca o default de dev (guard em `lib/auth/session.ts:21-27`) | Sim |
| `R2_ACCOUNT_ID`/`R2_BUCKET`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_PUBLIC_URL` | omitidas do `.env` | Não — lazy-init, confirmado seguro |
| `NODE_ENV` | hardcoded `production` (`docker-compose.prod.yml:34`) | Sim (já definido, sem ação) |
| `DATABASE_URL` | composta inline pelo compose a partir de `POSTGRES_PASSWORD` (`docker-compose.prod.yml:35`) | N/A — não é var de `.env` |

---

## Documentation Deliverables

| File | Audience | Content |
|---|---|---|
| `docs/features/0026F-instalacao-local/SETUP.md` | Founder (executa instalação/migração) | Passo a passo: clonar repo, gerar export na Hetzner, transferir JSON, rodar `install-local.sh`, checar `verify:prod` |
| `docs/features/0026F-instalacao-local/UPDATE.md` | Cliente (roda atualização sozinho) | Passo a passo simples: como o founder avisa, como rodar `update-local.sh` |

Referenciado por `script-SC10-docs-exist` (Test Specification acima) e por `about.md` Scope Includes (documentação separada por público).

## Requirements Coverage

| ID | Requirement | Covered? | Feature/Area | Tasks |
|----|-------------|----------|--------------|-------|
| SC01 | Instalação local via Docker, sem alterar código do app | YES | Backend/Scripts | T05 |
| SC02 | Geração de credenciais locais (SESSION_SECRET, senha do banco) | YES | Backend/Scripts | T05 |
| SC03 | Script de migração: dump completo + dados do tenant, janela de risco aceita | YES | Database + Docs | T01, T03, T04, T07 |
| SC04 | Remoção da cobrança de assinatura (exceção comercial) | YES | Docs/Operacional | T07 |
| SC05 | Remoção das referências de foto de produto na migração | YES | Database | T04 |
| SC06 | Remoção da verificação de assinatura (`valid_until`) na cópia local | YES | Database | T04 |
| SC07 | Reaproveitamento do `verify-prod.ts` p/ RLS pós-migração | YES | Database + Backend/Scripts | T05 |
| SC08 | Script de atualização rodado pelo cliente | YES | Backend/Scripts | T06, T08 |
| SC09 | Nuvem do cliente ligada porém parada (corte de uso) | YES | Docs/Operacional | T07 |
| SC10 | Documentação separada instalação (founder) / atualização (cliente) | YES | Docs | T07, T08 |

Cobertura: 10/10 (100%). Todo item de `## Scope > Includes` do about.md tem ≥1 task e ≥1 item do Acceptance Checklist (`tasks.md`) associado.

## Implementation Order

1. **Database** — `scripts/export-tenant.ts`, `scripts/import-tenant.ts` (Data Migration acima)
2. **Scripts & Packaging** — `scripts/install-local.sh`, `scripts/update-local.sh`, `docs/.../SETUP.md`, `docs/.../UPDATE.md`
3. **Tests** — `db/__tests__/tenant-export-import.test.ts`, `db/__tests__/local-install-scripts.test.ts`

Sem Frontend — nenhuma UI nova no escopo.

## Quick Reference

| Pattern | Search term |
|---|---|
| Boot verification (RLS + SESSION_SECRET) | `scripts/verify-prod.ts` |
| Push-only schema | `npm run db:setup` |
| Insert em massa via conexão owner | `scripts/seed-testfull.ts` |
| Regressão de isolamento RLS | `db/__tests__/tenant-isolation-regression.test.ts` |
| Deploy/versionamento (tag git) | `scripts/deploy.sh` |
| Status de assinatura | `lib/services/subscriptions/subscription-status.ts` |
| Guard de tenant ativo | `lib/auth/tenant-guard.ts` |
| Cliente R2 (lazy init) | `lib/services/storage/r2-client.ts` |
