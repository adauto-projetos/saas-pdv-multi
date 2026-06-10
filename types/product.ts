import type { ProductUnit } from "@/lib/validation/product";

export type { ProductUnit };

/**
 * Forma de resposta de um produto (nunca expõe a row crua do banco).
 * Dinheiro em centavos inteiros; markup/estoque como number (coeridos do numeric).
 * Datas como string ISO.
 */
export type ProductDto = {
  id: string;
  tenantId: string;
  name: string;
  barcode: string | null;
  unit: ProductUnit;
  costCents: number | null;
  markupPercent: number | null;
  salePriceCents: number;
  priceIsManual: boolean;
  stockQuantity: number;
  minStock: number | null;
  createdAt: string;
  updatedAt: string;
};

/** Sugestão de preço da RF06 (preview) — não persiste nada. */
export type PriceSuggestionDto = {
  currentSalePriceCents: number;
  suggestedSalePriceCents: number;
  newCostCents: number;
  markupPercent: number | null;
  priceIsManual: boolean;
  /** true quando o preço atual foi definido à mão (RF03) — exibe aviso na RF06. */
  warnManualOverride: boolean;
};

export type TenantSettingsDto = {
  tenantId: string;
  defaultMarkupPercent: number;
};

/** Contexto de autenticação resolvido da sessão — tenantId NUNCA vem do input (RN05). */
export type AuthContext = {
  userId: string;
  tenantId: string;
};
