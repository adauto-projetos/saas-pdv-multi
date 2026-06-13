import { z } from "zod";

import { paymentMethodSchema } from "@/lib/validation/sale";

/**
 * Schemas de validação para comandas/mesa (0006F). Espelha lib/validation/sale.ts.
 * Tenant/user NUNCA vêm do cliente — sempre do contexto de autenticação (RN10).
 */

/** RF01 — abre uma comanda com rótulo livre (ex: "Mesa 3", "João"). */
export const openComandaSchema = z.object({
  label: z.string().trim().min(1, "Informe um rótulo para a comanda"),
});

/**
 * RF02 — lança item na comanda. Observação opcional, max 200 chars (RN11).
 * quantity .finite() exclui Infinity/-Infinity/NaN (RN02).
 */
export const addComandaItemSchema = z.object({
  comandaId: z.string().uuid("Comanda inválida"),
  productId: z.string().uuid("Produto inválido"),
  quantity: z
    .number()
    .finite("Quantidade inválida")
    .positive("Quantidade deve ser maior que zero"),
  // RN11: texto livre opcional, sem formatação — não afeta cálculo.
  observation: z
    .string()
    .trim()
    .max(200, "Observação pode ter no máximo 200 caracteres")
    .nullable()
    .optional(),
});

/** RF03 — remove item de comanda aberta. */
export const removeComandaItemSchema = z.object({
  comandaId: z.string().uuid("Comanda inválida"),
  itemId: z.string().uuid("Item inválido"),
});

/** RF04 — cancela/consulta por id de comanda. */
export const comandaIdSchema = z.object({
  comandaId: z.string().uuid("Comanda inválida"),
});

/**
 * RF06 — fecha a comanda escolhendo forma de pagamento.
 * Fiado exige cliente (RN07) — mirror do finalizeSaleSchema.
 */
export const closeComandaSchema = z
  .object({
    comandaId: z.string().uuid("Comanda inválida"),
    paymentMethod: paymentMethodSchema,
    // Obrigatório apenas quando paymentMethod='fiado' (RN07) — ver refine abaixo.
    customerId: z.string().uuid("Cliente inválido").optional(),
  })
  .refine((d) => d.paymentMethod !== "fiado" || !!d.customerId, {
    message: "Cliente obrigatório para fiado",
    path: ["customerId"],
  });

/** RF08 — filtro de histórico de comandas; todos os campos opcionais. */
export const comandaFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(["aberta", "fechada", "cancelada"]).optional(),
});

// ---- Inferred types ----

export type OpenComandaInput = z.infer<typeof openComandaSchema>;
export type AddComandaItemInput = z.infer<typeof addComandaItemSchema>;
export type RemoveComandaItemInput = z.infer<typeof removeComandaItemSchema>;
export type ComandaIdInput = z.infer<typeof comandaIdSchema>;
export type CloseComandaInput = z.infer<typeof closeComandaSchema>;
export type ComandaFilterInput = z.infer<typeof comandaFilterSchema>;
