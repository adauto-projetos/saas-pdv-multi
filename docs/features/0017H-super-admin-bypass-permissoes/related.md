---
id: 0017H-related
type: hotfix-related
created: 2026-06-27
updated: 2026-06-27
related: [0017H]
---

# 0017H — Relacionados

## TL;DR

Fix toca a camada de auth/permissões compartilhada por 0011F (impersonação) e 0014F (permissões de operador).

## TOC

- [Impacted Files](#impacted-files)
- [Impacted Docs](#impacted-docs)
- [Follow-ups](#follow-ups)

## Impacted Files

- [types/product.ts:50](../../../types/product.ts#L50) — campo `isImpersonating?` no `AuthContext`.
- [lib/auth.ts:22](../../../lib/auth.ts#L22) — `requireAuthContext` seta `isImpersonating`.
- [lib/auth/permissions.ts:28](../../../lib/auth/permissions.ts#L28) — short-circuit em `hasPermission`.
- [lib/auth/permissions.ts:86](../../../lib/auth/permissions.ts#L86) — short-circuit em `requireAnyPermission`.
- [lib/auth/permissions.ts:123](../../../lib/auth/permissions.ts#L123) — short-circuit em `isOwner`.
- [lib/auth.test.ts](../../../lib/auth.test.ts) — asserts atualizados para o novo campo.
- [lib/auth/permissions.test.ts](../../../lib/auth/permissions.test.ts) — bloco de teste do bypass de founder.

## Impacted Docs

- {{doc:0011F}} — impersonação do super admin; agora o contexto carrega `isImpersonating`.
- {{doc:0014F}} — guards de permissão agora reconhecem o founder impersonando.

## Follow-ups

- [ ] Validar repro manual em runtime (super admin dentro da loja vê produtos/caixa/financeiro).
- [ ] Considerar registrar em auditoria as ações do super admin impersonando (rastreabilidade de suporte).
