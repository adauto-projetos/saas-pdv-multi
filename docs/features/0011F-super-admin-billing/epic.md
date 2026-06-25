---
id: 0011F
type: feature-about
slug: super-admin-billing-epic
status: draft
created: 2026-06-22
updated: 2026-06-22
related: [BRN-super-admin-e-planos]
---

## TL;DR

Epic que introduz assinatura mensal (trial → ativa → travada) e o painel exclusivo do founder para gerir todas as lojas. Decomposta em 2 subfeatures independentes e testáveis.

## Subfeatures

| # | Slug | Objetivo | Depende de |
|---|---|---|---|---|---|
| SF01 | [assinatura-lifecycle](subfeatures/SF01-assinatura-lifecycle/about.md) | Estado de assinatura + modo travada + trial + seed founder | — | done | 0011F-SF01-done |
| SF02 | [painel-super-admin](subfeatures/SF02-painel-super-admin/about.md) | Dashboard founder + liberar/suspender lojas (rota `/superadmin`) | SF01 | done | 0011F-SF02-done |
| SF03 | [impersonate-loja](subfeatures/SF03-impersonate-loja/about.md) | Super admin entra em qualquer loja (acesso total) para suporte | SF01, SF02 | done | 0011F-SF03-done |

## Ordem de entrega

SF01 primeiro: o painel (SF02) consome colunas e lógica de assinatura criadas em SF01.

## Decisões de escopo do epic

| Decisão | Rationale | Alternativa rejeitada |
|---|---|---|
| Impersonação retomada em SF03 (era adiada) | Suporte às lojas exige agir dentro delas; founder não tem como diagnosticar sem entrar | Manter adiada; acesso direto ao banco para suporte |
| Status derivado de `valid_until`, não cron | Nunca erra; zero infra de agendamento | Cron midnight sweep |
| PIX manual + WhatsApp | Zero integração de pagamento no MVP | Asaas/Stripe |
| Suspensão manual persiste `travada` | Casos além de vencimento (inadimplência, fraude) | Só status derivado |
