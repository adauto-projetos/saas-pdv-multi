---
id: 0017H
type: hotfix-about
severity: high
created: 2026-06-27
updated: 2026-06-27
related: [0011F, 0014F]
---

# 0017H — Super admin impersonando barra em todas as permissões

## TL;DR

O super admin (founder) que "entra" numa loja para dar suporte tomava "Permissão X
necessária" em tudo (Produtos, Caixa, Financeiro). O bypass de impersonação existia
só no menu, não nos guards de action. Replicado o bypass nos guards via flag
`isImpersonating` no `AuthContext`.

## TOC

- [Symptom](#symptom)
- [Root Cause](#root-cause)
- [Fix](#fix)
- [Verification](#verification)

## Symptom

- **when** — founder logado sem loja própria, com cookie de impersonação ativo ("dentro da loja X como super admin").
- **where** — toda Server Action gateada por `requirePermission`/`requireAnyPermission` (produtos, caixa, financeiro, estoque, comandas, usuários, settings, lucro).
- **impact** — Produtos não carrega ("Não foi possível carregar os produtos"); Caixa não lê turno/saldo; Financeiro/Caixa extrato e Histórico de turnos bloqueados. Super admin não consegue dar suporte dentro da loja.
- **detection** — relato do founder (screenshots das telas de Produtos, Financeiro e Caixa com erros de permissão).

## Root Cause

O founder impersonando não tem vínculo em `tenant_members` da loja-alvo, e os guards de permissão só liberam acesso a membros (`owner` ou operador com o código).

1. **Trigger** — founder sem loja própria entra numa loja via cookie de impersonação (0011F/SF03); `requireAuthContext` resolve o `tenantId` da loja-alvo, mas o `userId` continua sendo o do founder.
2. **Faulty path/state** — [lib/auth/permissions.ts:40](../../../lib/auth/permissions.ts#L40): `hasPermission`/`requireAnyPermission`/`isOwner` consultam `tenant_members` por `(tenantId, userId)`. Founder não é membro da loja-alvo → `member` é `undefined` → acesso negado em tudo.
3. **Why safeguards missed it** — o bypass de impersonação foi implementado só na camada de menu ([app/(app)/layout.tsx:59](../../../app/(app)/layout.tsx#L59), `canSeeAll = nav.isOwner || impersonating`), nunca nos guards de action. A interação entre 0011F (impersonação) e 0014F (permissões) não tinha teste cobrindo founder impersonando contra `requirePermission`; os testes de permissão cobriam só owner e operador.

## Fix

- [types/product.ts](../../../types/product.ts) — `AuthContext` ganha `isImpersonating?: boolean` (fonte da verdade do bypass, vinda do servidor).
- [lib/auth.ts:22-35](../../../lib/auth.ts#L22) — `requireAuthContext` marca `isImpersonating: true` quando resolve o tenant pelo caminho de impersonação de founder; `false` no caminho normal.
- [lib/auth/permissions.ts](../../../lib/auth/permissions.ts) — `hasPermission`, `requireAnyPermission` e `isOwner` dão short-circuit (acesso total) quando `ctx.isImpersonating`. `requirePermission` herda via `hasPermission`. Espelha o `canSeeAll` do menu.

## Verification

- [x] Teste unitário do bypass nos guards (sem DB) — [lib/auth/permissions.test.ts](../../../lib/auth/permissions.test.ts).
- [x] Testes de `requireAuthContext` atualizados para o novo campo — [lib/auth.test.ts](../../../lib/auth.test.ts).
- [x] Gate completo: typecheck, lint (0 erros), 489 testes, build — todos verdes.
- [ ] Repro manual: super admin entra na loja e abre Produtos/Caixa/Financeiro sem erro de permissão (validar em runtime).
