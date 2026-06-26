---
id: CHG0013
type: changelog
date: 2026-06-25
related: [0013F]
---

## TL;DR

O founder libera/estende uma loja por N meses de calendário (1–24) numa única ação no painel super admin, com campo numérico e preview ao vivo da nova validade, substituindo o botão fixo "+30 dias" da {{doc:0011F}}. Entraram juntas duas melhorias relacionadas sem feature própria: banner sempre-visível de dias de teste para o lojista e preço do plano configurável pelo founder, exibido no signup.

## Changes

### 0013F — Liberação flexível de meses
- feat(format): `addCalendarMonths(base, months)` — soma de meses de calendário (não blocos de 30 dias) com clamp de fim-de-mês; módulo puro/isomórfico compartilhado por preview cliente e gravação servidor (RN02) — {{doc:0013F}}
- feat(validation): `releaseMonthsSchema` — inteiro 1–24, rejeita NaN/Infinity/decimais; revalidado no servidor antes de qualquer escrita (RN01)
- feat(admin): `releaseSubscriptionAction(tenantId, months)` — base = `max(validUntil, hoje)` (RN03), destrava a loja (`suspendedAt: null`, RF04), grava em transação (RF03)
- feat(admin): `release-dialog.tsx` — campo numérico default `1` (RF01) + preview ao vivo da nova validade conforme o número digitado (RF02), usando `addCalendarMonths`
- feat(db): coluna `subscription_log.months_released` (nullable) — registra quantos meses foram liberados em cada ação `renewed` (RF05)
- feat(admin): `tenant-table.tsx` passa `months` do diálogo para a action; `isPending` escopado por `pendingId` (ação numa loja não trava as outras)

### Melhorias relacionadas (sem feature própria)
- feat(layout): `SubscriptionTrialBanner` (azul, não-alarmante) sempre visível durante o teste grátis enquanto há folga (> 3 dias); o `SubscriptionWarningBanner` (âmbar) assume em ≤ 3 dias — wired em `app/(app)/layout.tsx`
- feat(db): tabela `platform_settings` — config global singleton (FORA da RLS, sem `tenant_id`) com `monthly_price_cents`; trava de linha única via `UNIQUE(singleton)` + `CHECK (singleton = true)`
- feat(platform): `settings-repository.ts` — `getMonthlyPlanPriceCents` (leitura pública filtrada por `singleton = true`) e `setMonthlyPlanPriceCents` (upsert `ON CONFLICT (singleton)`); ambos via owner db
- feat(validation): `planPriceSchema` — preço em centavos, inteiro 0–1.000.000 (R$ 10.000); revalidado no servidor
- feat(admin): `PlanPriceSettings` card no `/superadmin` + `updatePlanPriceAction` (gated por `requireFounder`)
- feat(auth): signup exibe o preço do plano (`SignupForm` recebe `monthlyPriceCents`; `0` = não exibido)
- test: 390 testes passando — `calendar-month` (clamp/fim-de-mês), `releaseMonthsSchema`, `planPriceSchema`, `release-dialog`, `tenant-table`, integração com DB

## Breaking

- `releaseSubscriptionAction` mudou de assinatura: `(tenantId)` → `(tenantId, months)`. Server action interna (sem consumidores externos); todos os call sites já atualizados nesta branch.
- Schema migration aditiva (nova tabela `platform_settings` + coluna `subscription_log.months_released`). `drizzle-kit push` derruba as RLS policies — rodar `npm run db:rls` (ou `npm run db:setup`) após aplicar. `platform_settings` é intencionalmente FORA da RLS (config global, não-tenant).

## Migration

1. Aplicar schema: `npm run db:setup` (= `db:push` + `db:rls`) — cria `platform_settings`, adiciona `subscription_log.months_released` e restaura as policies de RLS.
2. Definir o preço do plano: founder acessa `/superadmin` → card "Preço do plano mensal" → salvar. Enquanto `monthly_price_cents = 0`, o signup não exibe valor.
3. Linhas legadas de `subscription_log` ficam com `months_released = null` (sem retroação) — esperado; só novas liberações gravam o valor.
4. Rollback: reverter a migration (drop `platform_settings`, drop coluna `months_released`); reverter `releaseSubscriptionAction` para `(tenantId)` com +30 dias fixo. Sem perda de dados de assinatura.

## Quick Ref

```json
{"id":"F0013","domain":"subscription release (super admin billing)","touched":["lib/format/","lib/validation/","lib/services/platform/","lib/services/subscriptions/","app/(admin)/superadmin/","app/(auth)/signup/","app/(app)/","components/admin/","components/auth/","components/layout/","db/schema/"],"patterns":["isomorphic pure module shared client+server","two-layer validation (zod client + server safeParse)","calendar-month date math with end-of-month clamp","singleton global config outside RLS","upsert on conflict (singleton)","per-row pending state in admin table"],"keywords":["liberacao","meses","calendar-month","validUntil","founder","plan-price","platform-settings","trial-banner","superadmin"]}
```
