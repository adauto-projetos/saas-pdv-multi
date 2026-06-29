---
id: CHG0020
type: changelog
date: 2026-06-28
related: [0019H]
---

# CHG0020 — Hotfix 0019H: Segurança & Deploy (Unidade 1)

## TL;DR

Fecha a Unidade 1 da remediação da auditoria ({{doc:0019H}}): os 3 P1 de segurança/deploy. Defaults inseguros silenciosos passam a falhar cedo (no boot) — `SESSION_SECRET` ausente/fraco trava o start em produção, assertion de RLS aborta o container se alguma tabela com `tenant_id` estiver sem isolamento, e a CVE High de `undici` foi corrigida. Decisão: travar o boot (sem CI; o `CMD` já condiciona o serviço ao startup, com restart automático). Sem breaking changes.

## Changes

- fix(auth): fail-fast no `secret()` — erro em `NODE_ENV=production` se `SESSION_SECRET` estiver ausente, com <32 chars, ou igual ao default de dev; mantém default só em dev (`lib/auth/session.ts`) — {{doc:0019H}}
- feat(deploy): novo `scripts/verify-prod.ts` (`npm run verify:prod`) — assertion via `pg_catalog` que falha (exit ≠ 0) se tabela com `tenant_id` estiver sem RLS habilitada ou sem policy de isolamento; revalida `SESSION_SECRET` no boot. Verifica existência de policy, não o nome (cobre `tenant_isolation` e `tenant_member_isolation`) — {{doc:0019H}}
- chore(deploy): `Dockerfile CMD` roda `db:setup && verify:prod && start` — boot trava antes de servir se a verificação falhar — {{doc:0019H}}
- fix(deps): `npm audit fix` — `undici` → 7.28.0 (fora da faixa vulnerável 7.0.0–7.27.2, advisory High: WebSocket DoS, SOCKS5 cross-origin) — {{doc:0019H}}
- chore(scripts): script `verify:prod` adicionado em `package.json`

## Breaking

none — mudanças internas de hardening de boot. Em produção, um deploy sem `SESSION_SECRET` válido ou com RLS quebrada agora aborta o start em vez de servir inseguro; isso é o comportamento pretendido (fail-fast), não uma quebra de contrato de API. Os 6 advisories restantes (esbuild/drizzle-kit dev-only, next/postcss) exigem semver-major e ficaram fora de escopo conforme a auditoria.

## Migration

Nenhuma migração de dados ou de API. Pré-requisito de deploy em produção:

1. Garantir `SESSION_SECRET` no ambiente do container com ≥32 chars e diferente de `dev-insecure-secret-change-me` — caso contrário o boot aborta.
2. Rebuild da imagem (o novo `CMD` passa a rodar `verify:prod` no startup).
3. Rollback: reverter o commit do hotfix restaura o `CMD` anterior e o default de `secret()`; nenhum estado de banco é alterado por este hotfix.

## Quick Ref

```json
{
  "id": "H0019",
  "domain": "seguranca-deploy",
  "touched": [
    "lib/auth/",
    "scripts/",
    "Dockerfile",
    "package.json"
  ],
  "patterns": [
    "fail-fast-boot-guard",
    "rls-assertion-on-startup",
    "secure-by-default-no-silent-fallback"
  ],
  "keywords": [
    "SESSION_SECRET",
    "RLS",
    "fail-fast",
    "verify-prod",
    "undici-CVE",
    "boot-assertion",
    "multi-tenant"
  ]
}
```
