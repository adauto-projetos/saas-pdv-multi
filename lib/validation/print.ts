import { z } from "zod";

/** Schema de validação para reimpressão de pedido de cozinha (RF07). */
export const reprintKitchenSchema = z.object({
  comandaItemId: z.string().uuid(),
});

/** Schema de validação para reimpressão de cupom de venda (RF07). */
export const reprintReceiptSchema = z.object({
  saleId: z.string().uuid(),
});

export type ReprintKitchenInput = z.infer<typeof reprintKitchenSchema>;
export type ReprintReceiptInput = z.infer<typeof reprintReceiptSchema>;
