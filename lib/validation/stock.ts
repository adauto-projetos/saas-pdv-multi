import { z } from "zod";

/** Tipo de movimentação de estoque. */
export const movementTypeSchema = z.enum(["entrada", "saida", "ajuste"]);
export type MovementType = z.infer<typeof movementTypeSchema>;

/** Entrada: quantidade positiva (RN03). */
export const stockEntrySchema = z.object({
  productId: z.uuid("Produto inválido"),
  quantity: z.number().finite().positive("Quantidade deve ser maior que zero"),
  reason: z.string().trim().max(200).optional(),
});

/** Ajuste por contagem: a contagem real é ≥ 0; a diferença pode ser ± (RN03). */
export const stockAdjustmentSchema = z.object({
  productId: z.uuid("Produto inválido"),
  countedQuantity: z
    .number()
    .finite()
    .min(0, "A contagem não pode ser negativa"),
  reason: z.string().trim().max(200).optional(),
});

/** Nível mínimo: ≥ 0 ou null (sem alerta) (RN06). */
export const minStockSchema = z.object({
  productId: z.uuid("Produto inválido"),
  minStock: z.number().finite().min(0).nullable(),
});

export const movementFilterSchema = z.object({
  productId: z.uuid("Produto inválido"),
  type: movementTypeSchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type StockEntryInput = z.infer<typeof stockEntrySchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
export type MinStockInput = z.infer<typeof minStockSchema>;
export type MovementFilterInput = z.infer<typeof movementFilterSchema>;
