---
id: CHG0018
type: changelog
date: 2026-06-27
related: [0017H]
---

# CHG0018 — Super admin impersonando bypassa guards de permissão

## TL;DR

O super admin (founder) "dentro da loja" para dar suporte deixava de tomar "Permissão X necessária" em todas as áreas. O bypass de impersonação, que existia só no menu, foi estendido aos guards de permissão via flag `isImpersonating` no `AuthContext`.

## Changes

- fix(auth): guards de permissão (`hasPermission`/`requireAnyPermission`/`isOwner`) liberam acesso total para founder impersonando — {{doc:0017H}}
- feat(auth): `AuthContext` ganha campo `isImpersonating?`, resolvido server-side em `requireAuthContext`
- test(auth): cobertura do bypass de founder nos guards + asserts de `requireAuthContext` atualizados

## Breaking

none

## Migration

none

## Quick Ref

```json
{
  "id": "0017H",
  "domain": "auth / permissões",
  "touched": ["lib/auth/", "types/"],
  "patterns": ["guard-clause", "server-resolved-context"],
  "keywords": ["impersonation", "super admin", "founder", "permission guard", "tenant_members", "bypass"]
}
```
