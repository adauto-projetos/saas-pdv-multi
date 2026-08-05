# Review: 0026F-instalacao-local

> **Date:** 2026-08-05 | **Branch:** feature/0026F-instalacao-local

## Quality Gate Report

| Gate | Status | Details |
|------|--------|---------|
| Build | ✅ PASSED | `npm run build` — exit 0, 0 erros |
| Spec Compliance | ✅ PASSED | 15/15 itens do Acceptance Checklist COMPLIANT (100%); 10/10 SC01–SC10 cobertos |
| Code Review Score | ✅ PASSED | 8/10 (threshold: ≥ 7) |
| Product Validation | ✅ PASSED | RF/RN: 10/10 (SC01–SC10); sem prerequisito faltante |
| Validation Gates | ✅ PASSED | ver tabela abaixo |

| **Overall** | **✅ PASSED** | **Pronto para merge** |

> Reviewed at: 2026-08-05
> Reviewed by: /add.review (model: claude-sonnet-5)

### Validation Gates (re-executados nesta revisão)

| Gate | Command | Exit Code | Notes |
|---|---|---|---|
| Lint | `npm run lint` | 0 | 8 warnings pré-existentes (arquivos não tocados por esta feature) |
| Typecheck | `npm run typecheck` | 0 | limpo |
| Test | `npm test` | 1 | 581/582 — falha isolada em `components/admin/ReleaseDialog.test.tsx` (0013F, drift de data), não tocado por esta feature → UNTOUCHED_FAILURE, tick mantido `[x]` |
| Build | `npm run build` | 0 | limpo |

---

## Spec Compliance Audit

**Fonte:** `plan.md` (contratos) × `tasks.md` → `## Acceptance Checklist` (15 itens) × `about.md` (RF/RN via SC01–SC10).

| Item | Type | Expected | Found at | Status |
|---|---|---|---|---|
| `.env` guard (SC01) | Script | Aborta se `.env` já existe, orienta `update-local.sh` | `scripts/install-local.sh:37-40` | COMPLIANT |
| Sem toque em código do app (SC01) | Script | Não referencia `app/`, `lib/`, `components/`, `db/schema/` | `scripts/install-local.sh` (verificado via regex negativo, testado) | COMPLIANT |
| Geração de credenciais (SC02) | Script | `openssl rand -hex 32` p/ `SESSION_SECRET` e `POSTGRES_PASSWORD`, sem default hardcoded persistido | `scripts/install-local.sh:62-73` | COMPLIANT |
| Export escopado por tenant (SC03) | DB | 22 tabelas/grupos em ordem de FK, zero linhas de outro tenant | `scripts/export-tenant.ts:113-230`; testado em `db-SC03-export-scoped` | COMPLIANT |
| Import atômico (SC03) | DB | Uma transação; FK ausente aborta tudo, zero estado parcial | `scripts/import-tenant.ts:92-195`; testado em `db-SC03-import-fk-atomic` | COMPLIANT |
| Transferência manual + risco de janela (SC03) | Docs | Documenta transferência manual e reconciliação manual | `SETUP.md` passos 2–3 | COMPLIANT |
| Sem cobrança pós-migração (SC04) | Docs | Registra exceção comercial, sem gate técnico | `SETUP.md` "Antes de começar" | COMPLIANT |
| Fotos removidas (SC05) | DB | `image_key`/`image_url` = NULL para todos os produtos do tenant | `scripts/import-tenant.ts:186-189`; testado em `db-SC05-photos-stripped` | COMPLIANT |
| Assinatura desbloqueada (SC06) | DB | `valid_until`/`suspended_at` = NULL; `getTenantStatus()`/`requireActiveTenant()` nunca travam | `scripts/import-tenant.ts:182-185`; verificado contra `lib/services/subscriptions/subscription-status.ts:11-28` e `lib/auth/tenant-guard.ts:21-27`; testado em `db-SC06-subscription-unlocked` | COMPLIANT |
| RLS íntegra pós-migração (SC07) | Script+DB | `db:setup` → `import-tenant.ts` → `verify:prod` dentro do container `app`, antes de `up -d app` | `scripts/install-local.sh:88-96`; testado em `db-SC07-verifyprod-post-import` | COMPLIANT |
| Guard de update (SC08) | Script | Aborta se `.env` não existe, orienta `install-local.sh` | `scripts/update-local.sh:12-16` | COMPLIANT |
| Update não toca dados (SC08) | Script | Só `git fetch`/checkout + `build app` + `up -d app`; nunca chama `db:setup`/`import-tenant.ts`/`verify:prod` | `scripts/update-local.sh:18-35` (reaproveita reexecução idempotente do `Dockerfile` CMD) | COMPLIANT |
| Doc de atualização (SC08) | Docs | Fluxo rodado pelo cliente, sem suporte remoto | `UPDATE.md` | COMPLIANT |
| Nuvem parada, não desligada (SC09) | Docs | Documenta corte de uso sem desativar a instância | `SETUP.md` "Corte de uso" | COMPLIANT |
| Docs separados por público (SC10) | Docs | `SETUP.md` (founder) e `UPDATE.md` (cliente) distintos | Confirmado `existsSync`; testado em `script-SC10-docs-exist` | COMPLIANT |

**Resumo:** 15/15 COMPLIANT (100%). Nenhum STALE_TICK. Todos os RF/RN (SC01–SC10) cobertos por ≥1 item do Acceptance Checklist.

**SPEC_AUDIT_STATUS = COMPLIANT**

---

## Code Review Summary

Escopo: 100% backend/database/scripts — sem arquivos frontend no diff, reviewer de frontend não foi despachado.

**Reviewer despachado:** Backend (via `reviewer-agent`), 9 arquivos revisados integralmente + contexto de suporte (schema, `subscription-status.ts`, `tenant-guard.ts`, `Dockerfile`, `docker-compose.prod.yml`, suíte de regressão RLS existente).

### Issues encontrados e corrigidos (2)

| # | Severidade | Arquivo:Linha | Problema | Correção |
|---|---|---|---|---|
| 1 | Importante | `scripts/install-local.sh` (antigo passo 4) | A imagem oficial do Postgres só aplica `POSTGRES_PASSWORD` na primeira inicialização de um volume vazio. Uma retentativa após falha (ex.: `import-tenant.ts` falhando) gerava uma senha nova que não batia com a já gravada no volume `pdv_pgdata` existente — quebrando exatamente o caminho de recuperação que o `SETUP.md` documenta ("apague o `.env` e rode de novo") | Adicionado `docker compose down -v` (no-op em máquina limpa, reset seguro numa retentativa) antes da geração de credenciais |
| 2 | Menor | `scripts/install-local.sh` (`cp .env.example .env`) | O `DATABASE_URL` de dev (senha fraca "postgres", hardcoded) do `.env.example` sobrevivia, sem uso, no `.env` de produção do cliente — contradiz o objetivo declarado do próprio script ("nunca hardcoded") | Adicionado `sed -i '/^DATABASE_URL=/d' .env` junto às remoções já existentes |

### Risco mitigado (1)

| # | Severidade | Onde | Risco | Mitigação |
|---|---|---|---|---|
| 3 | Importante | `docs/features/0026F-instalacao-local/SETUP.md` | `export-tenant.ts` inclui `users.passwordHash` (bcrypt) e PII de clientes no `tenant-export.json`; o repositório do sistema é **público** no GitHub (`plan.md`, confirmado via `gh repo view`), e o passo 3 original do `SETUP.md` orientava colocar esse arquivo dentro da pasta `pdv` clonada, sem aviso | `SETUP.md` atualizado com aviso explícito (não commitar, manter fora da pasta clonada, apagar após a instalação); `.gitignore` recebeu `tenant-export*.json` como camada estrutural adicional (fora do escopo dos 9 arquivos do reviewer — aplicado pelo coordenador) |

### Categorias sem achados

Patterns, Architecture, Database (correção de ordem de FK e do JSON reviver verificadas e corretas), Code Quality, Contracts (ambos os arquivos de teste verificados como semanticamente corretos, não apenas estruturalmente presentes; suíte DB-gated rodada ao vivo: 5/5 passaram, incluindo o caso de FK corrompida).

**Score Backend: 8/10**
**Score Overall: 8/10**

### Arquivos modificados durante a revisão

- `scripts/install-local.sh` — reset de estado (`down -v`) antes de gerar credenciais; remoção do `DATABASE_URL` de dev residual; renumeração dos comentários de passo.
- `docs/features/0026F-instalacao-local/SETUP.md` — aviso de dado sensível sobre `tenant-export.json` + correção da instrução do passo 3.
- `.gitignore` — adicionado `tenant-export*.json` (aplicado pelo coordenador, fora do escopo do reviewer de backend).
- `docs/features/0026F-instalacao-local/tasks.md` — registro desta re-execução de gates.
- `docs/features/0026F-instalacao-local/iterations.jsonl` — iteração de correção registrada.

---

## Product Validation

| RF/RN | Status | Evidência |
|---|---|---|
| SC01 — Instalação via Docker sem alterar código do app | ✅ PASSED | `install-local.sh`, testado estruturalmente |
| SC02 — Credenciais locais geradas | ✅ PASSED | `openssl rand -hex 32`, testado |
| SC03 — Migração de dados (estrutura + dados do tenant) | ✅ PASSED | `export-tenant.ts`/`import-tenant.ts`, testado (DB + estrutural) |
| SC04 — Sem cobrança pós-migração | ✅ PASSED | Documentado (operacional, sem gate técnico — não há billing ativo no código) |
| SC05 — Fotos removidas | ✅ PASSED | `import-tenant.ts`, testado |
| SC06 — Assinatura desbloqueada | ✅ PASSED | `import-tenant.ts`, testado contra `subscription-status.ts`/`tenant-guard.ts` reais |
| SC07 — RLS íntegra pós-migração | ✅ PASSED | `verify-prod.ts` reaproveitado inalterado, testado |
| SC08 — Update pelo cliente | ✅ PASSED | `update-local.sh`, testado |
| SC09 — Nuvem parada, não desligada | ✅ PASSED | Documentado (operacional, sem flag técnica no escopo) |
| SC10 — Docs separados | ✅ PASSED | `SETUP.md`/`UPDATE.md`, testado |

**Product Status: PASSED** — 10/10 RF/RN implementados; nenhum prerequisito faltante (0019H, 0020F, 0016F, 0011F todos confirmados intactos e reaproveitados sem alteração).

### Nota de escopo (não bloqueante)

Um teste manual ponta a ponta anterior a esta revisão (registrado em `tasks.md`/`decisions.jsonl`, 2026-08-05) já havia revelado e corrigido 3 bugs que nenhum teste automatizado pegou (ordem de import ESM/CJS quebrando `DATABASE_URL`, porta 3000 vs. 80 na documentação, processo travando sem `process.exit(0)`). Esta revisão de código encontrou uma quarta classe de bug (mismatch de senha do Postgres em retentativa) que também só teria surgido num teste manual real — reforça que o "manual-SC01-fresh-pc-boot" do Test Specification (plan.md) continua sendo o teste de maior valor para esta feature antes da instalação real no cliente.
