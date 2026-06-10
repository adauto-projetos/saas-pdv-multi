import type { MovementType } from "@/lib/validation/stock";

export type { MovementType };

export type StockMovementDto = {
  id: string;
  productId: string;
  type: MovementType;
  /** Delta assinado aplicado ao estoque (entrada +, saída −, ajuste ±). */
  quantity: number;
  reason: string | null;
  saleId: string | null;
  userId: string;
  createdAt: string;
};
