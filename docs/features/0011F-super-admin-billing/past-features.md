---
id: 0011F-past-features
type: feature-history
slug: super-admin-billing
created: 2026-06-22
updated: 2026-06-22
related: [0011F]
---

## TL;DR

Ranked relationships of existing features (0001F–0010F) to the 0011F epic (super admin + assinatura/billing). Strongest ties: 0004F (revenue metrics source + write-blocking), and all write-enabled features (0002F/0003F/0004F/0005F/0006F) which the `travada` read-only mode must gate. 0008F shell hosts `/admin` route + `travada` banner.

## Ranked Relationships

| Feature | Relationship | Why it matters |
|---|---|---|
| 0004F financeiro | prerequisite + blocked-by | Revenue-per-store metric source; all financeiro write actions must be blocked in `travada` |
| 0002F venda-rapida | blocked-by | Checkout must reject in `travada`; `sales` is the faturamento source for the admin dashboard |
| 0003F estoque | blocked-by | Stock mutations blocked in `travada`; movement timestamps can feed "último acesso" |
| 0005F lucro-fechamento | informs + blocked-by | Caixa session model informs last-activity; session open/close blocked in `travada` |
| 0006F comanda-mesa | blocked-by | Comanda open/lançar/fechar blocked in `travada` |
| 0008F sidebar-layout | extends | Shell hosts `/admin` (founder-only link) and the `travada` banner on tenant pages |
| 0010F mobile-responsive | informs | Decide whether `/admin` appears in mobile bottom-nav or is desktop-only |

## Cross-cutting findings

- No existing feature documents the `tenants` table or a founder/super-admin role — 0011F must introduce tenant subscription state and a global role. Verify actual schema in codebase discovery.
- `travada` read-only mode needs a single shared guard (e.g. `lib/auth/tenant-guard.ts`) called by every write server action, not scattered checks.
- Super-admin "vê todas as lojas" conflicts with per-tenant RLS — needs an admin-scoped access path (bypass role or founder-aware policy). Impersonation needs an audit log table.
- Midnight `travada` sweep is infra (cron route/job), not feature UI.

> Source: {{doc:BRN-super-admin-e-planos}}. File-name references above are hypotheses — confirmed in discovery.md.
