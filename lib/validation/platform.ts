import { z } from "zod";

/**
 * Schemas de validação da config global da plataforma (preço do plano).
 * O preço trafega em centavos (inteiro) — regra do projeto para dinheiro.
 */

/**
 * Preço do plano mensal: inteiro em centavos, de 0 (não definido) até R$ 10.000.
 * Revalidado no servidor (defesa em profundidade) além do MoneyInput do cliente.
 */
export const planPriceSchema = z.object({
  priceCents: z
    .number()
    .finite("Preço inválido")
    .int("O preço deve ser um valor em centavos (inteiro)")
    .min(0, "O preço não pode ser negativo")
    .max(1_000_000, "Preço acima do limite (R$ 10.000)"),
});

export type PlanPriceInput = z.infer<typeof planPriceSchema>;
