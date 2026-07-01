# Security Report

**Generated on:** 2026-06-29
**Score:** 8.5/10
**Status:** 🟢 (forte para o estágio MVP+; isolamento multi-tenant sólido, riscos residuais de baixo impacto)

---

## Summary

O controle de segurança central deste projeto — **isolamento multi-tenant** — está **bem implementado e em profundidade**: RLS nativa do Postgres (papel `app_user` sem bypass) sob `withUserRls`, `tenant_id` sempre resolvido no servidor (`requireAuthContext`, nunca do cliente), e um *guard* de boot (`verify-prod.ts`) que **aborta o container** se qualquer tabela com `tenant_id` ficar sem RLS/policy. A sessão é um cookie httpOnly assinado por HMAC-SHA256 com **fail-fast em produção** quando `SESSION_SECRET` está ausente/fraco/igual ao default de dev — **a regressão do audit de 2026-06-28 está corrigida** (verificado em `lib/auth/session.ts:21-29` e `scripts/verify-prod.ts:27-36`). Senhas via bcrypt; erros de domínio mapeados para mensagens seguras (sem vazar stack/DB); nenhum segredo hardcoded; só `.env.example` versionado.

Não há vulnerabilidade Crítica nem High de aplicação. Os achados são de severidade Medium/Low: o data layer de super-admin/auditoria/operadores roda na conexão **owner (bypass RLS)** confiando apenas no filtro de aplicação `tenant_id` (consciente por design, mas sem o backstop do banco), ausência de `middleware` de borda (proteção é por-action/por-layout), e ausência de rate-limiting no login. As 6 vulnerabilidades de dependência (todas moderate, dev/build) já constam no infra-report.

---

## Analysis Context

Baseado em `context-discovery.md` e `infrastructure-report.md`:
- **Tenant Identifier:** `tenantId` (TS) / `tenant_id` (DB, `uuid`), resolvido server-side em `requireAuthContext()` a partir de `tenant_members` — **nunca** do input do cliente (RN05).
- **Auth:** Local — cookie httpOnly `pdv_session` assinado HMAC-SHA256 (`SESSION_SECRET`) + bcrypt. **Sem Supabase, sem JWT.**
- **Isolamento:** RLS Postgres via `withUserRls` (papel `app_user`, NOLOGIN, sem bypass). Conexão owner (`db/index.ts`) bypassa RLS — reservada a login/onboarding/seed/DDL e ao painel cross-tenant do founder.
- **Boundary:** Monólito fullstack — UI → Server Actions / Route Handlers → services → data. **Sem Supabase no cliente; cliente nunca toca Drizzle.** (Os checks de "frontend querando Supabase" do skill são N/A.)
- **Módulos analisados:** auth/session, impersonação, permissões, tenant-guard, products (+upload R2), sales, stock, finance, profit, comanda, print, tenants/onboarding, usuarios, permissions/override, subscriptions, admin (super-admin), platform, audit, storage.

---

## Análise dos controles centrais

| Controle | Status | Evidência |
|---|---|---|
| Sessão HMAC + fail-fast do `SESSION_SECRET` em prod | ✅ | `lib/auth/session.ts:16-31`; reforço no boot `scripts/verify-prod.ts:27-36` |
| `timingSafeEqual` na verificação do MAC | ✅ | `lib/auth/session.ts:47-49` |
| Cookie flags (`httpOnly`, `secure` em prod, `sameSite=lax`, `path=/`) | ✅ | `lib/auth/session.ts:55-61`; impersonação idem `lib/auth/impersonation.ts:30-36` |
| `tenant_id` nunca vem do cliente | ✅ | `lib/auth.ts:18-38` (resolvido de `tenant_members`) |
| RLS ativa via `app_user` (sem bypass) por transação | ✅ | `db/rls.ts:31-42`; papel NOLOGIN `db/migrations/0001_rls.sql:14-19` |
| `SET LOCAL`/`set_config(...,true)` (não vazam no pool) | ✅ | `db/rls.ts:33-40` |
| Impersonação com dupla checagem founder (app + SQL) | ✅ | `db/rls.ts:50-55`, `db/migrations/0009_impersonation_rls.sql:22-39` |
| Guards por-action (`requireAuthContext` → `requirePermission` → serviço sob RLS) | ✅ | `app/(app)/products/actions.ts:42-50`; padrão consistente |
| Super-admin gated por `requireFounder()` em toda action | ✅ | `app/(admin)/superadmin/actions.ts` (todas), `impersonation-actions.ts:18` |
| Erros sem vazar stack/DB ao cliente | ✅ | `lib/services/errors.ts:90-105` |
| Senhas com bcrypt | ✅ | `lib/auth/password.ts` |
| Sem segredo hardcoded / sem log de segredo | ✅ | varredura limpa; só `.env.example` versionado |
| Sem `dangerouslySetInnerHTML` / XSS sink | ✅ | varredura sem ocorrências |
| Upload R2 autentica + escopa por tenant antes de processar | ✅ | `app/api/products/[id]/upload/route.ts:29-39`, `lib/services/products/product-service.ts:104-124` |

### RLS — cobertura (revisão estática das policies)

| Tabela (com `tenant_id`) | RLS ENABLE | Policy de isolamento | Forma |
|---|---|---|---|
| products, sales, sale_items, stock_movements, customers, cash_movements, receivables, receivable_payments, payables, payable_payments, cash_sessions, comandas, comanda_items, print_logs, kitchen_order_seqs | ✅ | `tenant_isolation` | `tenant_id IN (SELECT current_app_tenants())` — `db/migrations/0009_impersonation_rls.sql:59-90` (reaplica em loop) |
| subscription_log | ✅ | `tenant_isolation` (reaplicado em 0009) | append-only via GRANT SELECT,INSERT — `0008_subscription_rls.sql:12`, reaplicado `0009:78` |
| override_log | ✅ | `tenant_isolation` | `0011_override_rls.sql:15-21` |
| tenants | ✅ | `tenant_self_read` + `tenant_self_update` via `current_app_tenants()` | `0009:44-53` |
| tenant_members | ✅ | `tenant_member_isolation` (não-recursiva: `user_id = current_app_user()`) | `0001_rls.sql:71-76` |
| users | ✅ | `user_self_read` (só SELECT da própria linha) | `0001_rls.sql:38-41` |

**Observações sobre a cobertura:**
- `0009_impersonation_rls.sql` é o último arquivo aplicado por `apply-rls.ts` (ordem alfabética) e **reescreve `tenant_isolation` em todas as business tables** para usar `current_app_tenants()` — incluindo `subscription_log`. Cobertura consistente.
- `current_app_tenants()` é `STABLE` (não `SECURITY DEFINER`) e roda sob a RLS do próprio `app_user`; `current_app_is_founder()` lê `users.is_founder` via a policy `user_self_read`. A impersonação só entra no conjunto se `current_app_is_founder()` for verdadeiro **no banco** — um cookie de impersonação forjado por um não-founder **não** concede acesso (defesa em profundidade real, não só na app). Verificado em `0009:32-39`.
- `verify-prod.ts:46-74` valida em runtime (boot) que **toda** tabela com coluna `tenant_id` tem `relrowsecurity=true` E ao menos uma policy — fecha o footgun do `drizzle-kit push` que derruba policies. Esse é o mitigante operacional do hazard descrito no context-discovery (linha 62).

---

## Análise por módulo

### auth / session / impersonação
**Path:** `lib/auth/`, `app/(auth)/actions.ts`, `app/(admin)/superadmin/impersonation-actions.ts`

| Check | Status | Detalhes |
|---|---|---|
| Auth guard | ✅ | `requireAuthContext` / `getAuthUser`; layouts redirecionam sem sessão |
| Tenant validation | ✅ | `tenantId` server-resolved; impersonação dupla-checada |
| Boundary | ✅ | cookie httpOnly; MAC com `timingSafeEqual` |
| Secrets | ✅ | `SESSION_SECRET` fail-fast em prod |

**Issues:** 1 (SEC-003 login sem rate-limit), 1 (SEC-004 enumeração no signup).

### products + upload R2
**Path:** `lib/services/products/`, `app/api/products/[id]/upload/route.ts`, `lib/services/storage/`

| Check | Status | Detalhes |
|---|---|---|
| Auth/authz | ✅ | route handler chama `requireAuthContext` (401) + `requirePermission(ctx,"produtos")` (403) antes de ler o corpo |
| Tenant scoping | ✅ | `selectProductById(tx, ctx.tenantId, id)` sob RLS confirma posse antes de gravar; chave R2 prefixada por `tenantId` |
| Validação de conteúdo | ✅ | MIME tratado como falsificável; validação real por `sharp`; Zod no `formData` |
| Secrets | ✅ | credenciais R2 só de env, init preguiçosa |

**Issues:** 0. (Ver SEC-006: não há limite de tamanho explícito no route — `sharp` mitiga, mas vale um cap.)

### super-admin / admin / platform
**Path:** `app/(admin)/superadmin/`, `lib/services/admin/`, `lib/services/platform/`

| Check | Status | Detalhes |
|---|---|---|
| Auth guard | ✅ | `requireFounder()` em toda action; layout `(admin)` recusa não-founder |
| Tenant validation | ⚠️ por design | owner db (bypass RLS) cross-tenant — correto para o founder; gate é `requireFounder` |
| Confirmação destrutiva | ✅ | `deleteTenantAction` exige nome digitado == nome da loja (`actions.ts:85`) |
| Raw SQL | ✅ | `listAllTenantsWithStats` usa `sql` template parametrizado (sem interpolação de input) |

**Issues:** 0 (gating correto).

### audit / usuarios (operadores) / permissions
**Path:** `lib/services/audit/`, `lib/services/users/`, `lib/services/permissions/`

| Check | Status | Detalhes |
|---|---|---|
| Auth/authz | ✅ | actions exigem permissão (`gerenciar_usuarios` etc.) |
| Tenant validation | ⚠️ por design | owner db + filtro `tenant_id = ctx.tenantId` explícito em TODA query (sem RLS de backstop) |
| Raw SQL | ✅ | `selectOverrides` usa bindings parametrizados (`${tenantId}`, `${d.toISOString()}::timestamptz`) — sem injeção |

**Issues:** 1 (SEC-001 — owner-db sem backstop RLS, abrange estes módulos).

### demais services de negócio (sales, stock, finance, profit, comanda, print)
**Path:** `lib/services/*/`

| Check | Status | Detalhes |
|---|---|---|
| Padrão data layer | ✅ | recebem `tx` de `withUserRls` (RLS ativa) + filtro `tenant_id` aditivo (ex.: `products/data.ts`) |
| Boundary | ✅ | cliente nunca importa Drizzle; tudo via Server Action |

**Issues:** 0.

---

## Consolidated Issues

### 🔴 Critical
Nenhum.

### 🟠 High
Nenhum.

### 🟡 Medium

#### [SEC-001] Leituras/escritas cross-member na conexão owner (bypass de RLS), confiando só no filtro de aplicação
**Arquivos:** `lib/services/audit/audit-data.ts` (todas as queries, ex.: linhas 43-55, 220-238); `lib/services/users/operator-data.ts:25-166`; `lib/services/permissions/*-data.ts`; `lib/services/admin/*`.
**Código (exemplo):**
```ts
// audit-data.ts:43 — owner db, RLS NÃO se aplica
return db.select({...}).from(tenantMembers)
  .innerJoin(users, eq(users.id, tenantMembers.userId))
  .where(eq(tenantMembers.tenantId, tenantId)); // único controle: este filtro
```
**Motivo do design:** a policy `tenant_member_isolation` é não-recursiva (`user_id = current_app_user()`), então sob `withUserRls` um usuário só enxergaria a própria linha em `tenant_members` — inviável para listar operadores/auditar a loja. A solução adotada foi rodar no owner db com filtro explícito por `tenant_id`.
**Impacto:** nesses caminhos a RLS — "última linha de defesa" do projeto — **não atua**. O isolamento depende inteiramente de cada query lembrar do filtro `tenant_id = ctx.tenantId`. Um futuro `WHERE` esquecido (ou um novo método sem o filtro) vaza dados entre lojas sem rede de proteção. `ctx.tenantId` é server-resolved, então o risco é de *regressão de código*, não de manipulação direta pelo cliente hoje.
**Fix:** (a) garantir teste de isolamento por método nessas data layers; (b) avaliar uma policy de leitura por-tenant para `tenant_members`/auditoria que permita `withUserRls` (ex.: `tenant_id IN (SELECT current_app_tenants())` para SELECT de membros da própria loja), eliminando o bypass; (c) centralizar o filtro `tenant_id` num helper para reduzir a superfície de esquecimento.

#### [SEC-002] Ausência de `middleware` de borda — proteção de rota é por-layout/por-action
**Evidência:** não existe `middleware.ts` (glob vazio). A autenticação de página vem dos layouts (`app/(app)/layout.tsx:25-26`, `app/(admin)/layout.tsx:20-31`) e a autorização, de cada action.
**Impacto:** funciona porque toda action revalida (`requireAuthContext`/`requirePermission`) e toda página autenticada está sob um layout que redireciona. Mas não há um gate único: uma futura rota/handler criado fora desses layouts (ex.: novo `app/api/.../route.ts`) **não herda** proteção automática — precisa lembrar de chamar os guards (como o upload faz corretamente). É um risco de consistência, não uma falha atual.
**Fix:** considerar um `middleware.ts` que exija o cookie de sessão em `(app)`/`(admin)`/`api` como rede de segurança de borda (sem substituir os guards de action), e/ou um teste que falhe se um route handler novo não chamar `requireAuthContext`.

#### [SEC-003] Login sem rate-limiting / lockout
**Arquivo:** `app/(auth)/actions.ts:13-26`.
**Impacto:** `loginAction` faz `getUserByEmail` + `verifyPassword` sem qualquer limitação de tentativas. Permite brute-force/credential-stuffing online contra senhas fracas. bcrypt(cost 10) atenua a taxa, mas não impede tentativas distribuídas.
**Fix:** rate-limit por IP+email (ex.: contador em DB/Redis ou cabeçalho do proxy), backoff progressivo e, idealmente, captcha após N falhas.

### 🟢 Low / Informational

#### [SEC-004] Enumeração de e-mail no cadastro
**Arquivo:** `app/(auth)/actions.ts:35-37,48-50` — `"Já existe uma conta com esse e-mail."`
**Impacto:** revela se um e-mail já tem conta (vetor leve de enumeração). O *login* já usa mensagem genérica (`"E-mail ou senha inválidos."` — correto). Aceitável para um produto onde o cadastro é auto-serviço, mas registrado.
**Fix (opcional):** mensagem neutra + confirmação por e-mail, se/quando o atrito for aceitável.

#### [SEC-005] Cookie de impersonação não é assinado
**Arquivo:** `lib/auth/impersonation.ts:28-37` — `pdv_impersonate` guarda o `tenant_id` cru.
**Impacto:** **não explorável** hoje: o efeito do cookie é gated por `current_app_is_founder()` no banco (`db/rls.ts:50-55`, `0009:32-39`) — um não-founder que injete qualquer `tenant_id` não ganha acesso. É httpOnly, então JS do cliente não o lê. Registrado por completude: assiná-lo (como o `pdv_session`) seria defesa-em-profundidade extra e evitaria depender só da checagem de founder.
**Fix (opcional):** assinar o cookie de impersonação com o mesmo HMAC da sessão.

#### [SEC-006] Upload R2 sem limite de tamanho explícito no route handler
**Arquivo:** `app/api/products/[id]/upload/route.ts:42-59`.
**Impacto:** o handler lê todo o `formData`/`arrayBuffer` antes do `sharp`. `sharp` rejeita não-imagens e o Zod valida, mas não há um cap de bytes antes de bufferizar — um upload muito grande consome memória/CPU. Baixo risco (rota autenticada + permissão), mas vale um teto.
**Fix:** validar `file.size` no schema Zod (`uploadProductImageSchema`) e/ou rejeitar acima de N MB antes do `arrayBuffer()`.

#### [SEC-007] Dependências: 6 vulnerabilidades moderate (0 high/critical)
Já detalhado no `infrastructure-report.md` (INF-006): `esbuild`/`drizzle-kit` (dev) e `postcss`/`next` (build/SSR de CSS). Sem impacto runtime de produção. Rodar `npm audit fix` e acompanhar bumps.

---

## RLS Analysis

### Status: Configurada e verificada estaticamente + guard de boot em runtime

| Tabela | RLS Enabled | Policy | Status |
|---|---|---|---|
| products / sales / sale_items / stock_movements / customers / cash_movements / receivables / receivable_payments / payables / payable_payments / cash_sessions / comandas / comanda_items / print_logs / kitchen_order_seqs | ✅ | `tenant_isolation` (via `current_app_tenants()`) | ✅ |
| subscription_log | ✅ | `tenant_isolation` (append-only) | ✅ |
| override_log | ✅ | `tenant_isolation` | ✅ |
| tenants | ✅ | `tenant_self_read` / `tenant_self_update` | ✅ |
| tenant_members | ✅ | `tenant_member_isolation` (não-recursiva) | ✅ (ver SEC-001) |
| users | ✅ | `user_self_read` (só SELECT próprio) | ✅ |

**Limitação:** verificação estática das policies `.sql` + leitura do guard `verify-prod.ts`. Sem `DATABASE_URL`/Postgres no ar nesta sessão, **não** executei as policies contra um banco vivo. Para validar em runtime: `docker compose up -d` → `npm run db:setup` → `npm test` (os testes de RLS em `db/__tests__/` rodam de verdade com o banco no ar).

---

## Fix Checklist

### Multi-tenancy / RLS
- [ ] [SEC-001] Cobrir cada método das data layers owner-db (audit/operator/permissions/admin) com teste de isolamento por tenant; avaliar policy de leitura por-tenant que permita migrar para `withUserRls`.
- [ ] [SEC-002] Adicionar `middleware.ts` de borda (cookie de sessão) como rede de segurança, sem remover os guards de action.

### Auth
- [ ] [SEC-003] Rate-limit + backoff no `loginAction`.
- [ ] [SEC-004] (opcional) Neutralizar mensagem de cadastro.
- [ ] [SEC-005] (opcional) Assinar o cookie `pdv_impersonate`.

### Upload / deps
- [ ] [SEC-006] Cap de tamanho no upload R2 antes de bufferizar.
- [ ] [SEC-007] `npm audit fix` + acompanhar Next/drizzle-kit.

---

## Priority Recommendations

1. **[SEC-001] Reduzir a superfície do bypass de RLS** nas data layers owner-db — é o único ponto onde a "última linha de defesa" do projeto não atua. Testes de isolamento por método + (idealmente) migrar leituras para `withUserRls`.
2. **[SEC-003] Rate-limit no login** — endpoint público sem qualquer limitação.
3. **[SEC-002] Middleware de borda** como rede de segurança para futuros route handlers.
4. **[SEC-005/006] Hardening incremental** — assinar cookie de impersonação, cap de upload.

---

## Scoring

Base 10. Deduções (escala adaptada ao projeto — sem Supabase no cliente, sem endpoint sem tenant validation, sem segredo exposto):
- Owner-db sem backstop de RLS em vários módulos (SEC-001): −1.0
- Sem middleware de borda (SEC-002): −0.25
- Login sem rate-limit (SEC-003): −0.25
- Itens Low (SEC-004/005/006): −0.25 no total
- Deps moderate (SEC-007): 0 (informacional, já no infra-report)

**Score = 10 − 1.75 ≈ 8.5 / 10** 🟢

Pontos fortes que sustentam a nota alta: RLS real (não só filtro de app) com dupla-checagem de impersonação no banco, `tenant_id` nunca vindo do cliente, `SESSION_SECRET` fail-fast (regressão anterior corrigida), HMAC com `timingSafeEqual`, erros sem vazamento, bcrypt, e um guard de boot que recusa subir inseguro.

---

*Document generated by the security-analyzer subagent.*
