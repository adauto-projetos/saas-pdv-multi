import type { PaymentMethod } from "@/lib/validation/sale";
import type { ProductUnit } from "@/types/product";

export type { PaymentMethod };

export type SaleItemDto = {
  id: string;
  productId: string | null;
  name: string;
  unit: ProductUnit;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
};

export type SaleDto = {
  id: string;
  tenantId: string;
  userId: string;
  totalCents: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
  items: SaleItemDto[];
};
