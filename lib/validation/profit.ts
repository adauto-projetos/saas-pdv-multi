import { z } from "zod";

/**
 * Schemas de validação do lucro e do fechamento de caixa (0005F). Dinheiro em
 * centavos inteiros (RN02). `from`/`to` são strings opcionais — datas inválidas
 * são ignoradas no data layer (mesmo padrão de `cashFilterSchema`).
 */

/** Abertura de turno: saldo inicial (fundo de troco) — inteiro ≥ 0 (RN02/RF04). */
export const openSessionSchema = z.object({
  openingBalanceCents: z
    .number()
    .int("Valor deve ser inteiro (centavos)")
    .min(0, "Valor não pode ser negativo"),
});

/** Fechamento de turno: contagem real da gaveta — inteiro ≥ 0 (RN02/RF06). */
export const closeSessionSchema = z.object({
  countedCents: z
    .number()
    .int("Valor deve ser inteiro (centavos)")
    .min(0, "Valor não pode ser negativo"),
});

/** Filtro de período do lucro / histórico de sessões — from/to opcionais (RF02/RF07). */
export const profitFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

// --- Inferred input types --------------------------------------------------

export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;
export type ProfitFilterInput = z.infer<typeof profitFilterSchema>;
