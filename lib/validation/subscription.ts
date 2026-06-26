import { z } from "zod";

/**
 * Schemas de validação da assinatura/super admin (0013F).
 * A quantidade de meses NUNCA é confiada do cliente — revalidada no servidor (RN01).
 */

/**
 * RN01 — liberação por N meses de calendário: inteiro entre 1 e 24 inclusive.
 * `.finite()` rejeita Infinity/-Infinity; `.int()` rejeita decimais (1.5) e NaN;
 * `.min/.max` aplicam o range. Mensagens em pt-BR (padrão lib/validation/comanda.ts).
 */
export const releaseMonthsSchema = z.object({
  months: z
    .number()
    .finite("Quantidade de meses inválida")
    .int("A quantidade de meses deve ser um número inteiro")
    .min(1, "Libere ao menos 1 mês")
    .max(24, "No máximo 24 meses por liberação"),
});

export type ReleaseMonthsInput = z.infer<typeof releaseMonthsSchema>;
