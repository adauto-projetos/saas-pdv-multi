---
id: 0020F
type: feature-about
slug: camada-dados-services
status: spec
created: 2026-06-28
updated: 2026-06-28
related: [BRN-remediacao-auditoria, AUDIT-2026-06-28, 0011F, 0014F, 0019H]
---

# Feature 0020F — Camada de Dados & Services (Unidade 2 da remediação)

## TL;DR

Unidade 2 da remediação da auditoria ({{doc:BRN-remediacao-auditoria}}): limpeza estrutural da camada de dados/services, sem mudança visível ao lojista. Cinco itens: (1) mover a persistência do super-admin para uma camada repository/service formal, (2) oficializar a estratégia de migrations como **push-only** (apagar a migration `0000` stale, aposentar `db:migrate`, documentar no CLAUDE.md), (3) adicionar índice composto em `override_log`, (4) eliminar o N+1 em `listOperators` via busca em lote, (5) criar uma suite única de regressão de isolamento `tenant_id` parametrizada sobre todas as tabelas com a coluna. Decisões fechadas no questionário do `/add.new`; implementação detalhada fica para o `/add.plan`.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Requirements](#requirements)
- [Decisions](#decisions)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

Cinco achados P2/P3 da auditoria ({{doc:AUDIT-2026-06-28}}) na camada de dados/services degradam manutenibilidade, performance e segurança sem afetar a UI.

- **Persistência do super-admin fora da camada de services** — `app/(admin)/superadmin/actions.ts:143` executa query Drizzle direta (`SELECT name FROM tenants`) e mistura lógica de transação (linhas 49–127) no código da action, violando o Architecture Contract (UI → service → data). Sinal observável: acesso a dados que pula `lib/services/`.
- **Migration `0000` stale + estratégia indefinida** — `db/migrations/0000_perfect_mikhail_rasputin.sql` existe mas nunca roda; o fluxo real é push-only (`db:setup` = `drizzle-kit push --force` + `db:rls`); o script `db:migrate` está definido mas não é usado, e a escolha não está documentada. Sinal: ambiguidade sobre qual é a fonte da verdade do schema (push vs. arquivos de migration).
- **`override_log` sem índice composto** — a tela de auditoria filtra por `tenant_id + created_at BETWEEN ? AND ?` (`lib/services/audit/audit-data.ts:214`) e também por tipo de ação, sem índice de suporte. Sinal: full scan conforme `override_log` cresce; RNF de carga <2s da auditoria sob risco.
- **N+1 em `listOperators`** — `lib/services/users/operator-service.ts:68-88` chama `selectPermissionCodes(tenantId, userId)` dentro de um `Promise.all(map)`, gerando 1+N queries (10 operadores = 10 queries extras). `permission-data.ts:18` só aceita um `userId`. Sinal: latência cresce linear com o nº de operadores.
- **Cobertura de regressão `tenant_id` incompleta** — 11 tabelas têm teste RLS (`*-rls.test.ts`); 17 tabelas com `tenant_id` não têm teste de isolamento cross-tenant. Sinal: uma tabela nova sem RLS passaria no CI sem ser detectada — hoje só o `verify-prod.ts` pegaria, e apenas em runtime no boot. A Unidade 1 ({{doc:0019H}}) já está **mergeada na master**, então essa rede de runtime existe; falta a rede de CI/test que detecta o problema antes do deploy.

**Workaround atual:** nenhum — o sistema funciona, mas acumula dívida técnica e risco silencioso de vazamento entre lojas.

## Users

Feature interna de backend; não há fluxo de usuário final. Os "usuários" são os papéis impactados pela qualidade da camada.

| Role | Goal com esta feature | Pain atual |
|---|---|---|
| Founder/super-admin | Liberar assinatura / listar lojas via código previsível e testável | Lógica de persistência espalhada entre action e banco, difícil de evoluir com segurança |
| Lojista (dono) | Auditoria carrega rápido mesmo com histórico grande de overrides | Hoje a query de auditoria roda sem índice; a latência cresce com o volume de overrides (risco latente, ainda não percebido como lentidão crítica) |
| Dev/mantenedor | Evoluir schema e services com fonte da verdade clara e rede de testes de isolamento | Estratégia de migrations ambígua; cobertura RLS parcial; N+1 escondido |

## Scope

### Includes
- Extrair a persistência do super-admin para camada repository/service formal (`lib/services/admin/admin-data.ts` + `admin-service.ts`), eliminando chamadas diretas action→Drizzle.
- Oficializar **push-only**: remover a migration `0000` stale, aposentar o script `db:migrate`, documentar a estratégia no CLAUDE.md, manter `db:setup` (push + rls) como canônico.
- Adicionar índice composto em `override_log` cobrindo `tenant_id`, `created_at` e `action_code`.
- Substituir o N+1 de `listOperators` por busca em lote: nova `selectPermissionsByUserIds(tenantId, userIds[])` genérica em `permission-data.ts`, retornando `Map<userId, PermissionCode[]>` (objetivo: 2 queries em vez de 1+N).
- Criar suite única `db/__tests__/tenant-isolation-regression.test.ts`, parametrizada sobre todas as tabelas com `tenant_id`, validando que `app_user` do tenant A não lê nem escreve dados do tenant B.
- **Corrigir RLS ausente descoberta pela suite** — se a regressão revelar uma tabela com `tenant_id` sem policy de isolamento, aplicar a policy faltante é parte desta unidade (é o ponto do contrato; uma RLS ausente é falha de segurança, não trabalho adiável).

### Does NOT Include
- **Adotar `db:migrate` / regenerar migrations versionadas** — decisão fechada por push-only (RN02); migrar arrisca o banco de prod sem ganho proporcional ao estágio do produto.
- **Verificação retroativa de baseline de prod a partir da `0000`** — não se aplica: o deploy sempre usou push-only (`db:setup`), nunca rodou `db:migrate`, então a `0000` jamais foi aplicada em prod; sua remoção é segura sem auditoria de baseline.
- **Mudança de comportamento ou UI do painel super-admin** — é refactor estrutural; o que o founder vê e faz continua idêntico (inclui preservar o padrão `owner-bypass-connection` de {{doc:0011F}}, coberto por RNF02).
- **Otimização de performance além do índice e do N+1 citados** — outros gargalos (se houver) ficam para diagnóstico próprio; esta unidade cobre só os achados P2/P3 da auditoria.

## Requirements

- **RF01:** O acesso a dados do super-admin (liberar/suspender assinatura, listar lojas, obter nome do tenant) ocorre exclusivamente via `lib/services/admin/`; nenhuma action chama Drizzle/schema diretamente.
- **RF02:** `listOperators` carrega operadores e suas permissões em no máximo 2 queries, independente do número de operadores.
- **RF03:** A suite de regressão valida, para cada tabela com `tenant_id`, que leitura e escrita cross-tenant sob o papel `app_user` são bloqueadas pela RLS.
- **RNF01:** A consulta de auditoria sobre `override_log` (`tenant_id + created_at + action_code`) usa índice — sem sequential scan no plano de execução.
- **RNF02:** Nenhuma regressão funcional: os gates `typecheck`, `lint`, `test`, `build` saem com exit 0; o comportamento observável do app é idêntico ao anterior.
- **RN01:** A estratégia oficial de evolução de schema é **push-only** (`drizzle-kit push` + `db:rls` via `db:setup`); o snapshot do Drizzle é a fonte da verdade.
- **RN02:** O script `db:migrate` e a migration `0000` stale são removidos/aposentados; nenhum caminho de deploy depende deles.
- **RN03:** A unicidade de `tenant_id` como fronteira de isolamento é inviolável — a suite de regressão é o contrato que trava qualquer tabela futura sem RLS.

## Decisions

| Decision | Rationale | Alternative rejected |
|---|---|---|
| Push-only oficial | É o fluxo que já roda em prod (`db:setup` no Dockerfile); `verify-prod.ts` (U1) já garante integridade RLS no boot | Regenerar migrations + `db:migrate` — muda o deploy e arrisca baseline conflitar com o banco de prod existente, sem ganho proporcional |
| Camada repository formal para super-admin | O resto do projeto já separa `*-data.ts` (dados) de `*-service.ts` (regras); meia-refatoração criaria inconsistência | Mover só a query violadora — deixaria o super-admin fora do padrão do resto do codebase |
| Suite de regressão única e parametrizada | Vira contrato de isolamento: tabela nova com `tenant_id` sem RLS quebra o teste; complementa o `verify-prod.ts` (runtime) no nível de CI | Testar só as 17 tabelas faltantes — mantém o padrão espalhado e não cobre tabelas futuras |
| Índice `override_log` inclui `action_code` | A tela de auditoria filtra por tipo de ação além de tenant+período; cobre o caso principal e o secundário num só índice | Índice só `(tenant_id, created_at)` — não cobre o filtro por ação |
| Batch de permissões genérico em `permission-data.ts` | `selectPermissionsByUserIds` é reutilizável em outros pontos que carregam permissões | Função ad-hoc local em `operator-service.ts` — resolve o N+1 mas não reaproveita |

## Success Metrics

| Metric | Target | Source |
|---|---|---|
| Queries em `listOperators` | ≤ 2, constante vs. nº de operadores | log/trace de queries no teste de `operator-service` |
| Plano de execução da query de auditoria | usa Index Scan (sem Seq Scan) em `override_log` | `EXPLAIN` na query de `audit-data.ts` |
| Cobertura de isolamento `tenant_id` | 100% das tabelas com `tenant_id` na suite de regressão | contagem de tabelas testadas vs. tabelas com a coluna |
| Chamadas diretas action→Drizzle no super-admin | 0 | grep por Drizzle/schema em `app/(admin)/superadmin/` |
| Gates de validação | `typecheck`/`lint`/`test`/`build` exit 0 | execução local + Docker |

## References

- {{doc:BRN-remediacao-auditoria}} — brainstorm que separou a remediação em 3 unidades; discovery comum da U2
- {{doc:AUDIT-2026-06-28}} — auditoria técnica; fonte dos 5 achados P2/P3
- {{doc:0011F}} — super-admin/billing; criou `tenant-admin-service` e o padrão owner-bypass-connection
- {{doc:0014F}} — usuários/permissões; criou `override_log`, `listOperators` e o padrão `*-data.ts`/`*-service.ts`
- {{doc:0019H}} — Unidade 1; `verify-prod.ts` valida RLS no boot (runtime), complementado aqui pela suite de regressão (CI)
- `docs/features/0020F-camada-dados-services/discovery.md` — análise de código com `file:line` de cada achado
