/**
 * Conversão dinheiro ↔ centavos. Regra do projeto: dinheiro trafega/armazena como
 * inteiro em centavos; formatação BRL acontece só na borda da UI.
 */

export function centsToBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/** "R$ 10,50" | "10,50" | "1.050,50" -> centavos inteiros. */
export function brlToCents(input: string): number {
  if (!input) return 0;
  const cleaned = input
    .replace(/[^\d,.-]/g, "") // tira "R$", espaços, NBSP
    .replace(/\./g, "") // separador de milhar
    .replace(",", "."); // vírgula decimal -> ponto
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}
