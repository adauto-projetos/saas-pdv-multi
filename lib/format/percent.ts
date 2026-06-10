/** Formata/parseia percentual de margem (markup). É percentual, NÃO centavos. */

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function parsePercent(input: string): number {
  if (!input) return 0;
  const cleaned = input
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isNaN(value) ? 0 : value;
}
