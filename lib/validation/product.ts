import { z } from "zod";

/** Unidade de venda: por unidade ou por peso (RF01). */
export const productUnitSchema = z.enum(["un", "kg"]);
export type ProductUnit = z.infer<typeof productUnitSchema>;

export const PRODUCT_CATEGORIES = [
  "Bebidas",
  "Hortifruti",
  "Mercearia",
  "Lanches",
  "Doces",
  "Limpeza",
  "Outros",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

// Campos vazios de formulário ("") chegam como undefined (opcionais).
const emptyToUndefined = (v: unknown) =>
  v === "" || v === null ? undefined : v;

/**
 * Objeto base do produto (sem o refine) — reaproveitado para `partial()`/`extend()`
 * no schema de update.
 */
export const createProductObject = z.object({
  name: z.string().trim().min(1, "Informe o nome do produto"),
  barcode: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1).optional(),
  ),
  unit: productUnitSchema,
  stockQuantity: z.coerce
    .number()
    .min(0, "Estoque não pode ser negativo")
    .default(0),
  // Nível mínimo de estoque (opcional) — alerta de estoque baixo (RF06, feature 0003F).
  minStock: z.preprocess(
    emptyToUndefined,
    z.number().finite().min(0, "Mínimo não pode ser negativo").optional(),
  ),
  emoji: z.preprocess(emptyToUndefined, z.string().max(10).optional()),
  category: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
  // RN02: custo não negativo. Inteiro em centavos.
  costCents: z.preprocess(
    emptyToUndefined,
    z.number().int("Custo inválido").min(0, "Custo não pode ser negativo").optional(),
  ),
  markupPercent: z.preprocess(
    emptyToUndefined,
    z.number().min(0, "Margem inválida").max(999.99, "Margem máxima é 999,99%").optional(),
  ),
  // RN02: preço não negativo. Inteiro em centavos.
  salePriceCents: z.preprocess(
    emptyToUndefined,
    z.number().int("Preço inválido").min(0, "Preço não pode ser negativo").optional(),
  ),
});

/**
 * RN04: o markup é auxiliar — não é obrigatório para salvar. Mas é preciso ter
 * preço de venda OU custo (senão não há o que cadastrar).
 */
export const createProductSchema = createProductObject.refine(
  (d) => d.salePriceCents != null || d.costCents != null,
  {
    message: "Informe o preço de venda ou o custo do produto",
    path: ["salePriceCents"],
  },
);

export const updateProductSchema = createProductObject
  .partial()
  .extend({ id: z.uuid("Produto inválido") });

export const productIdSchema = z.object({ id: z.uuid("Produto inválido") });

export const previewCostChangeSchema = z.object({
  id: z.uuid("Produto inválido"),
  newCostCents: z
    .number()
    .int("Custo inválido")
    .min(0, "Custo não pode ser negativo"),
});

export const applyCostChangeSchema = previewCostChangeSchema.extend({
  acceptSuggestion: z.boolean(),
});

export const updateDefaultMarkupSchema = z.object({
  percent: z
    .number()
    .min(0, "Margem inválida")
    .max(999.99, "Margem máxima é 999,99%"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductIdInput = z.infer<typeof productIdSchema>;
export type PreviewCostChangeInput = z.infer<typeof previewCostChangeSchema>;
export type ApplyCostChangeInput = z.infer<typeof applyCostChangeSchema>;
export type UpdateDefaultMarkupInput = z.infer<typeof updateDefaultMarkupSchema>;
