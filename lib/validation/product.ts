import { z } from "zod";

/** Unidade de venda: por unidade ou por peso (RF01). */
export const productUnitSchema = z.enum(["un", "kg"]);
export type ProductUnit = z.infer<typeof productUnitSchema>;

// --- Categorias de produto (0025F) ------------------------------------------

/**
 * Paleta pré-definida de cores de categoria (RF01/RN05). O banco persiste o
 * SLUG (`product_categories.color`); os hex só são resolvidos no client.
 * A ORDEM das chaves define o ciclo da cor automática (RN05:
 * `palette[count % len]`) e as 7 primeiras entradas reproduzem 1:1 as cores
 * do mapa CATEGORY_COLORS dos chips do caixa — zero mudança visual no deploy.
 * Client-safe: nenhum import server-only neste arquivo.
 */
export const CATEGORY_PALETTE = {
  azul:     { bg: "#e0f2fe", fg: "#0369a1", bd: "#bae6fd" },
  verde:    { bg: "#dcfce7", fg: "#15803d", bd: "#bbf7d0" },
  ambar:    { bg: "#fef3c7", fg: "#b45309", bd: "#fde68a" },
  laranja:  { bg: "#ffedd5", fg: "#c2410c", bd: "#fed7aa" },
  rosa:     { bg: "#fce7f3", fg: "#be185d", bd: "#fbcfe8" },
  ciano:    { bg: "#cffafe", fg: "#0e7490", bd: "#a5f3fc" },
  cinza:    { bg: "#f1f5f9", fg: "#475569", bd: "#e2e8f0" },
  roxo:     { bg: "#ede9fe", fg: "#6d28d9", bd: "#ddd6fe" },
  vermelho: { bg: "#fee2e2", fg: "#b91c1c", bd: "#fecaca" },
  lima:     { bg: "#ecfccb", fg: "#4d7c0f", bd: "#d9f99d" },
} as const;

export type CategoryColor = keyof typeof CATEGORY_PALETTE;

/** Slugs da paleta na ordem do ciclo (RN05) — fonte para o z.enum e o service. */
export const CATEGORY_COLOR_SLUGS = Object.keys(CATEGORY_PALETTE) as [
  CategoryColor,
  ...CategoryColor[],
];

/**
 * As 7 categorias padrão com que todo tenant nasce/é migrado (RN03). Fonte
 * ÚNICA consumida pelo seed script, pelo onboarding e pelos testes — nomes
 * exatos e cor 1:1 com o antigo CATEGORY_COLORS dos chips do caixa. Após o
 * seed são categorias comuns: renomeáveis, recoloríveis e excluíveis (RF02/RF03).
 */
export const DEFAULT_PRODUCT_CATEGORIES = [
  { name: "Bebidas", color: "azul", position: 0 },
  { name: "Hortifruti", color: "verde", position: 1 },
  { name: "Mercearia", color: "ambar", position: 2 },
  { name: "Lanches", color: "laranja", position: 3 },
  { name: "Doces", color: "rosa", position: 4 },
  { name: "Limpeza", color: "ciano", position: 5 },
  { name: "Outros", color: "cinza", position: 6 },
] as const satisfies readonly {
  name: string;
  color: CategoryColor;
  position: number;
}[];

/** Cor de categoria: sempre um slug da CATEGORY_PALETTE, nunca hex livre. */
export const categoryColorSchema = z.enum(CATEGORY_COLOR_SLUGS);

const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome da categoria")
  .max(50, "Nome deve ter no máximo 50 caracteres");

/**
 * RF01/RF04 — criar categoria. `color` é opcional: quando omitida, o SERVICE
 * aplica a próxima cor da paleta cíclica (RN05, depende do estado do banco).
 * RN01 (nome único) e RN06 (nome reservado) também vivem no service.
 */
export const createProductCategorySchema = z.object({
  name: categoryNameSchema,
  color: categoryColorSchema.optional(),
});

/** RF02/RF05 — renomear e/ou recolorir; campos parciais. */
export const updateProductCategorySchema = z.object({
  id: z.uuid("Categoria inválida"),
  name: categoryNameSchema.optional(),
  color: categoryColorSchema.optional(),
});

/**
 * RF06 — ordem manual. `orderedIds` é a lista COMPLETA das categorias do
 * tenant na nova ordem; a equivalência exata com o conjunto do tenant é
 * validada no service (positions 0..n-1).
 */
export const reorderProductCategoriesSchema = z.object({
  orderedIds: z
    .array(z.uuid("Categoria inválida"))
    .min(1, "Lista de categorias inválida"),
});

export const productCategoryIdSchema = z.object({
  id: z.uuid("Categoria inválida"),
});

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
  // Categoria do produto (0025F): FK para product_categories do próprio tenant.
  // "" (campo vazio de form) → undefined; null EXPLÍCITO é preservado — é como
  // o update remove a categoria (RN04: produto volta a "Sem categoria").
  // O guard de tenant do id vive no service (FK não passa pela RLS, RN02).
  categoryId: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.uuid("Categoria inválida").nullable().optional(),
  ),
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
export type CreateProductCategoryInput = z.infer<
  typeof createProductCategorySchema
>;
export type UpdateProductCategoryInput = z.infer<
  typeof updateProductCategorySchema
>;
export type ReorderProductCategoriesInput = z.infer<
  typeof reorderProductCategoriesSchema
>;
export type ProductCategoryIdInput = z.infer<typeof productCategoryIdSchema>;
