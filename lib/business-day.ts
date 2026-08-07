/**
 * "Dia comercial" do sistema — sempre calculado no fuso de operação (Brasil,
 * UTC-3, sem horário de verão) via aritmética explícita sobre o instante UTC,
 * NUNCA via getters locais do runtime (`getFullYear`/`getMonth`/`getDate` ou
 * `new Date(y, m, d)`). Esses getters dependem do fuso horário do PROCESSO
 * Node, não do fuso de negócio: em produção (Docker, sem `TZ` configurada),
 * o processo roda em UTC — não em UTC-3.
 *
 * Bug real (hotfix 0027H): `listTodaySales`/`resolvePeriod`/`todayIso` usavam
 * getters locais. Como o processo roda em UTC, o "dia" virava amanhã às 21h
 * no horário do Brasil (21h BRT = 00h UTC) — 3h antes da meia-noite local.
 * Vendas do dia inteiro (00h–21h BRT) saíam do intervalo `[hoje, amanhã)` e
 * pareciam ter "sumido" no fechamento de caixa.
 *
 * A técnica correta (subtrair o offset do instante UTC antes de extrair a
 * data) já existia, isolada, em `lib/services/print/print-service.ts`
 * (RN02, sequencial de cozinha) — este módulo generaliza e centraliza, para
 * todo código que precisa de "hoje"/"início do dia"/"fim do dia" no sentido
 * de operação da loja importar daqui, nunca recalcular localmente.
 */

const BRAZIL_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Início do dia corrente (00:00 no horário do Brasil), como instante UTC real. */
export function startOfTodayBrazil(): Date {
  const shifted = new Date(Date.now() - BRAZIL_UTC_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      3,
      0,
      0,
      0,
    ),
  );
}

/** Fim do dia corrente — início do dia seguinte (horário do Brasil), exclusive. */
export function endOfTodayBrazil(): Date {
  return new Date(startOfTodayBrazil().getTime() + 24 * 60 * 60 * 1000);
}

/** Data corrente em "YYYY-MM-DD", no horário do Brasil (ex.: chave de kitchen_order_seqs, comparação com due_date). */
export function todayBrazilIso(): string {
  return new Date(Date.now() - BRAZIL_UTC_OFFSET_MS).toISOString().slice(0, 10);
}
