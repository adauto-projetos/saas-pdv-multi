import { z } from "zod";

/** Forma de pagamento: rótulo de lista fixa, sem integração. `fiado` (0004F) gera
 * conta a receber e exige cliente (RN07). */
export const paymentMethodSchema = z.enum(["dinheiro", "pix", "cartao", "fiado"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/**
 * Item enviado pelo cliente: SÓ produto + quantidade. O preço NÃO vem do cliente —
 * o servidor resolve do produto (snapshot, RN02). Quantidade > 0 (RN04).
 */
export const saleItemInputSchema = z.object({
  productId: z.uuid("Produto inválido"),
  // .finite() exclui Infinity/-Infinity/NaN (RN04).
  quantity: z.number().finite().positive("Quantidade deve ser maior que zero"),
});

export const finalizeSaleSchema = z
  .object({
    // Carrinho não pode estar vazio (RN03).
    items: z.array(saleItemInputSchema).min(1, "Adicione pelo menos um item"),
    paymentMethod: paymentMethodSchema,
    // Obrigatório apenas quando paymentMethod='fiado' (RN07) — ver refine abaixo.
    customerId: z.uuid("Cliente inválido").optional(),
  })
  .refine((d) => d.paymentMethod !== "fiado" || !!d.customerId, {
    message: "Selecione um cliente para venda fiado",
    path: ["customerId"],
  });

export type SaleItemInput = z.infer<typeof saleItemInputSchema>;
export type FinalizeSaleInput = z.infer<typeof finalizeSaleSchema>;
