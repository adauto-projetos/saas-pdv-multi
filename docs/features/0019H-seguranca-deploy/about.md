---
id: 0019H
type: hotfix-about
created: 2026-06-28
updated: 2026-06-28
related: [AUDIT-2026-06-28, BRN-remediacao-auditoria]
---

# Hotfix 0019H — Segurança & Deploy (Unidade 1 da remediação)

## TL;DR

Fecha a **Unidade 1** do brainstorm de remediação ({{doc:BRN-remediacao-auditoria}}) — os 3 itens P1 da auditoria ({{doc:AUDIT-2026-06-28}}): (1) fail-fast no `SESSION_SECRET` em produção, (2) assertion de RLS que trava o boot, (3) `npm audit fix` da CVE High de `undici`. Open thread decidido: **travar o boot** (não há pipeline de CI; o `CMD` do container já condiciona o serviço ao sucesso do startup, com restart automático).

## Problema

- **P1 — `SESSION_SECRET` sem fail-fast:** `lib/auth/session.ts:14` caía num default público (`dev-insecure-secret-change-me`) se a var não estivesse setada. A chave HMAC do cookie é a única barreira contra forjar sessão → risco de account takeover total (incl. founder/super-admin) se um deploy subisse sem a var.
- **P1 — RLS sem guarda automática:** `drizzle-kit push` apaga as RLS policies; só `db:rls` as repõe. O startup já roda `db:setup` (push + apply-rls) a cada boot, mas **não havia verificação** de que as policies realmente existem — um push que falhasse parcialmente serviria com lojas se enxergando.
- **P1 — CVE High em `undici`:** `undici` 7.0.0–7.27.2 com advisory High (WebSocket DoS, SOCKS5 cross-origin), correção não-quebrante disponível.

## Root Cause

Defaults inseguros silenciosos e ausência de verificação no caminho de deploy: nada falhava cedo (no boot) quando o ambiente estava inseguro — o app servia mesmo assim.

## Solução

- **Fail-fast `SESSION_SECRET`** — `lib/auth/session.ts`: `secret()` lança erro em `NODE_ENV==="production"` se a var estiver ausente, com <32 chars, ou igual ao default de dev. Em dev mantém o default.
- **Assertion de RLS no boot** — novo `scripts/verify-prod.ts` (`npm run verify:prod`): consulta `pg_catalog` e falha (exit ≠ 0) se alguma tabela com coluna `tenant_id` estiver sem RLS habilitada **ou** sem nenhuma policy de isolamento. Também revalida `SESSION_SECRET` no boot. Wired no `Dockerfile CMD`: `db:setup && verify:prod && start`. Verifica existência de policy (não o nome) — cobre `tenant_isolation` e `tenant_member_isolation`.
- **`npm audit fix`** — `undici` → 7.28.0 (fora da faixa vulnerável). Os 6 advisories restantes (esbuild/drizzle-kit dev-only e next/postcss) exigem semver-major e foram deixados de fora, conforme a auditoria.

## Arquivos Modificados

- `lib/auth/session.ts` — guard de fail-fast no `secret()`
- `scripts/verify-prod.ts` — **novo** — assertion de RLS + SESSION_SECRET no boot
- `package.json` — script `verify:prod`; bump de `undici` no lockfile
- `package-lock.json` — `undici` 7.28.0
- `Dockerfile` — `CMD` roda `verify:prod` antes do `start`

## Validação

- `typecheck` ✅ exit 0 · `lint` ✅ exit 0 (só warnings pré-existentes) · `build` ✅ exit 0
- Smoke test `verify-prod.ts`: dev + DB local → PASS; prod + secret curto → FAIL (exit 1); detecção de policy ausente confirmada
- `undici` 7.28.0 confirmado via `npm ls undici`

## Decisão de Open Thread

**Comportamento da verificação de RLS no deploy → travar o boot.** Não há pipeline de CI (deploy é `docker build` no servidor); o `CMD` já aborta o serviço se o startup falhar, e o orquestrador reinicia. Travar o boot é a barreira mais segura e o único encaixe real.
