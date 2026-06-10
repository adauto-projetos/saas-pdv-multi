import type { PriceSuggestionDto } from "@/types/product";

/**
 * RF02 — preço de venda = custo + (custo × margem%). Resultado em centavos
 * inteiros, arredondado HALF-UP ao centavo (`Math.round`). NÃO é arredondamento
 * para .99 (isso está fora do MVP — ver about.md "Does NOT Include").
 *
 * Ex.: calculateSalePrice(1000, 30)    => 1300
 *      calculateSalePrice(1000, 33.33) => Math.round(1333.3) => 1333
 */
export function calculateSalePrice(
  costCents: number,
  markupPercent: number,
): number {
  return Math.round(costCents + (costCents * markupPercent) / 100);
}

type ResolvePriceInput = {
  costCents?: number | null;
  markupPercent?: number | null;
  salePriceCents?: number | null;
};

export type ResolvedPrice = {
  salePriceCents: number;
  priceIsManual: boolean;
};

/**
 * Decide o preço final e o flag `priceIsManual` ao criar/editar (RF03/RF04/RN04):
 * - preço de venda informado explicitamente vence o cálculo → manual = true;
 * - senão, calcula a partir de custo + margem → manual = false.
 *
 * Contrato com o form: só envie `salePriceCents` quando o usuário sobrescrever o
 * preço à mão. No caminho puro de markup, envie apenas custo + margem.
 */
export function resolvePriceOnCreate(input: ResolvePriceInput): ResolvedPrice {
  if (input.salePriceCents != null) {
    return { salePriceCents: input.salePriceCents, priceIsManual: true };
  }
  // Caminho de markup: exige custo (garantido pelo refine do schema).
  const cost = input.costCents ?? 0;
  const markup = input.markupPercent ?? 0;
  return {
    salePriceCents: calculateSalePrice(cost, markup),
    priceIsManual: false,
  };
}

type SuggestSource = {
  salePriceCents: number;
  markupPercent: number | null;
  priceIsManual: boolean;
};

/**
 * RF06 — preview PURO ao mudar o custo. Constrói a sugestão de novo preço a partir
 * da margem ARMAZENADA do produto. NÃO persiste nada. Se o preço atual foi manual,
 * marca `warnManualOverride` para a UI avisar. Sem margem (preço manual/sem custo),
 * mantém o preço atual como sugestão (não há como calcular).
 */
export function suggestPriceOnCostChange(
  product: SuggestSource,
  newCostCents: number,
): PriceSuggestionDto {
  const suggestedSalePriceCents =
    product.markupPercent != null
      ? calculateSalePrice(newCostCents, product.markupPercent)
      : product.salePriceCents;

  return {
    currentSalePriceCents: product.salePriceCents,
    suggestedSalePriceCents,
    newCostCents,
    markupPercent: product.markupPercent,
    priceIsManual: product.priceIsManual,
    warnManualOverride: product.priceIsManual,
  };
}
