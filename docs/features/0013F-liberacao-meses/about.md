---
id: 0013F
type: feature-about
slug: liberacao-meses
status: draft
created: 2026-06-25
updated: 2026-06-25
related: [0011F]
---

## TL;DR

Extensão da feature {{doc:0011F}} (super admin + assinatura): o founder libera/estende a validade de uma loja por **N meses de calendário numa única ação**, digitando o número num campo livre, em vez do botão fixo de "+30 dias". Os N meses somam sobre a validade atual (acúmulo já existente), a liberação destrava a loja e a auditoria passa a registrar quantos meses foram liberados. Cobrança permanece manual (WhatsApp/PIX) — nenhuma automação de pagamento ou liberação em lote entra aqui.

## TOC

- [Problem](#problem)
- [Users](#users)
- [Scope](#scope)
- [Requirements](#requirements)
- [Success Metrics](#success-metrics)
- [References](#references)

## Problem

Hoje a liberação de validade de uma loja é fixa em +30 dias por clique, o que torna a cobrança de múltiplos meses lenta e propensa a erro.

- **Quem é afetado:** o founder (super admin), única pessoa que libera lojas após o pagamento manual.
- **O que falta:** liberar mais de um mês numa só ação. Para dar 1 ano hoje seriam 12 cliques no botão "+30 dias".
- **Sinal observável:** a liberação soma um incremento fixo de 30 dias por clique, sem parâmetro de quantidade — comportamento projetado para "um mês por vez" na {{doc:0011F}} e que esta feature parametriza (não é um bug, é uma extensão deliberada). Evidência: [actions.ts:28-30](app/(admin)/superadmin/actions.ts#L28-L30).
- **Workaround atual:** clicar "+30 dias" repetidamente, uma vez por mês pago. Sujeito a contar errado e a deixar a loja com validade abaixo do pago.

## Users

| Role | Goal com a feature | Pain atual |
|---|---|---|
| Founder (super admin) | Liberar N meses de uma vez após confirmar o pagamento por WhatsApp/PIX | Repetir o clique "+30 dias" um mês por vez; risco de errar a contagem |
| Lojista (indireto) | Ter a validade refletindo exatamente os meses que pagou | Pode receber menos tempo que o pago se o founder errar a contagem de cliques |

## Scope

### Includes
- Campo numérico livre no diálogo de liberação para o founder informar a quantidade de meses (default `1`).
- Preview da nova validade calculada ao vivo conforme o número digitado, antes de confirmar.
- Liberação por quantidade de **meses de calendário** somados sobre a validade de acúmulo atual.
- Validação em duas camadas: na tela (inteiro positivo) e como regra de negócio (teto 1–24 meses) confirmada no servidor.
- Liberação continua destravando a loja suspensa.
- O registro de auditoria da liberação passa a guardar a quantidade de meses liberados e a validade resultante.

### Does NOT Include
- Automação de pagamento (gateway/PIX automático) — cobrança permanece manual via WhatsApp `13 99130-6911`; fora do escopo por intenção declarada no brainstorm.
- Liberação em lote (várias lojas de uma vez) — o foco é uma loja por ação; em lote é outra demanda.
- Botões fixos de atalho (1/3/6/12 meses), inclusive um híbrido de botões + campo — o founder optou por **apenas** o campo livre, que cobre qualquer combinação sem engessar períodos.
- Mudança no modelo de status (ativa/testando/travada) — o status segue derivado da validade e do estado de suspensão da loja, sem alteração.
- Recuperar tempo já vencido — meses contam a partir de hoje quando a loja já passou da validade (ver RN03).

## Requirements

- **RF01:** O founder informa a quantidade de meses num campo numérico do diálogo de liberação, pré-preenchido com `1`.
- **RF02:** O diálogo exibe a nova validade calculada ao vivo conforme o número digitado, antes de confirmar.
- **RF03:** Ao confirmar, a validade da loja avança N meses de calendário a partir da base de acúmulo.
- **RF04:** A liberação destrava a loja suspensa, devolvendo-a ao estado ativo.
- **RF05:** Cada liberação fica registrada com a quantidade de meses, a validade resultante e quem a executou.
- **RN01:** A quantidade de meses é um inteiro entre `1` e `24` inclusive; valores fora do range são rejeitados na tela e revalidados no servidor.
- **RN02:** O cálculo usa meses de calendário (mesma data N meses à frente), não blocos de 30 dias; ajusta fim-de-mês quando o dia de destino não existe (ex.: 31 → último dia do mês).
- **RN03:** A base do cálculo é o maior entre a validade atual e hoje; loja vencida acumula a partir de hoje, sem recuperar o tempo perdido.
- **RNF01:** A liberação é restrita ao founder; usuários não-founder recebem erro de acesso.

## Success Metrics

| Metric | Target | Source |
|---|---|---|
| Discrepância entre meses pagos e meses creditados na loja | 0 lojas com validade menor que o pago | conferência founder × validade da loja |
| Cliques para liberar 1 ano | de 12 para 1 ação | fluxo do diálogo de liberação |
| Liberações fora do range 1–24 que chegam ao banco | 0 | validação no servidor (RN01) |
| Rastreabilidade da liberação | 100% das liberações registram meses + nova validade | registro de auditoria (RF05) |

## References

- {{doc:0011F}} — super admin + assinatura (fluxo base de liberação/cobrança que esta feature estende).
- [BRN-liberacao-meses-flexivel](../../brainstorm/2026-06-25-liberacao-meses-flexivel.md) — brainstorm que originou a feature.
- [discovery.md](discovery.md) — análise do código atual do fluxo de liberação (0011F).

---

## Addendum: Additional Deliveries

| Delivery | Description | Justification |
|----------|-------------|---------------|
| Banner de dias de teste | `SubscriptionTrialBanner` sempre visível durante o trial enquanto há folga (> 3 dias); complementa o `SubscriptionWarningBanner` (≤ 3 dias) | discovery — lojista só era avisado na reta final; melhoria de UX no mesmo fluxo de assinatura |
| Preço do plano configurável | Tabela `platform_settings` (singleton, fora da RLS) + `PlanPriceSettings` no super admin + exibição no signup | discovery — o preço estava implícito; founder pediu controle do valor exibido no signup, mesmo contexto de cobrança |

**Impact:** Ambas tocam o domínio de assinatura/cobrança; revisadas tecnicamente em review.md, sem RF/RN próprios (sem spec de feature).
