import { z } from "zod";

/**
 * Forma de pagamento de uma conta (receber/pagar): dinheiro | pix | cartao.
 * `fiado` é forma de VENDA, não método de quitação de conta (RF09/RF12).
 */
export const accountPaymentMethodSchema = z.enum(["dinheiro", "pix", "cartao"]);
export type AccountPaymentMethod = z.infer<typeof accountPaymentMethodSchema>;

/** Status derivado de uma conta (RN04). */
export const accountStatusSchema = z.enum(["aberto", "parcial", "quitado"]);

// --- Caixa -----------------------------------------------------------------

/**
 * Movimentação manual de caixa (suprimento/sangria). `amountCents` é a MAGNITUDE
 * positiva (RN02); o tipo (entrada/saida) é decidido pela action, que aplica o
 * sinal no serviço. `description` é obrigatória.
 */
export const cashMovementSchema = z.object({
  amountCents: z
    .number()
    .int("Valor deve ser inteiro (centavos)")
    .positive("Valor deve ser maior que zero"),
  description: z.string().trim().min(1, "Descrição é obrigatória").max(200),
});

export const cashFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

// --- Clientes --------------------------------------------------------------

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120),
  phone: z.string().trim().max(40).optional(),
});

export const customerQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

export const customerIdSchema = z.object({
  id: z.uuid("Cliente inválido"),
});

// --- Contas a receber ------------------------------------------------------

export const createReceivableSchema = z.object({
  customerId: z.uuid("Cliente inválido"),
  totalCents: z
    .number()
    .int("Valor deve ser inteiro (centavos)")
    .min(0, "Valor não pode ser negativo"),
  description: z.string().trim().max(200).optional(),
  dueDate: z.string().trim().optional(),
});

export const receivableQuerySchema = z.object({
  status: accountStatusSchema.optional(),
  customerId: z.uuid("Cliente inválido").optional(),
});

// --- Contas a pagar --------------------------------------------------------

export const createPayableSchema = z.object({
  description: z.string().trim().min(1, "Descrição é obrigatória").max(200),
  totalCents: z
    .number()
    .int("Valor deve ser inteiro (centavos)")
    .min(0, "Valor não pode ser negativo"),
  category: z.string().trim().min(1, "Categoria é obrigatória").max(80),
  dueDate: z.string().trim().optional(),
});

export const payableQuerySchema = z.object({
  status: accountStatusSchema.optional(),
  category: z.string().trim().max(80).optional(),
});

// --- Pagamentos (receber/pagar compartilham este schema) -------------------

/**
 * Registro de recebimento/pagamento. `accountId` é a conta (receivable ou payable),
 * `amountCents` é positivo (RN02); o limite "≤ saldo devedor" (RN03) é checado no
 * SERVIÇO, pois depende do estado do banco. `method` ∈ dinheiro/pix/cartao.
 */
export const recordPaymentSchema = z.object({
  accountId: z.uuid("Conta inválida"),
  amountCents: z
    .number()
    .int("Valor deve ser inteiro (centavos)")
    .positive("Valor deve ser maior que zero"),
  method: accountPaymentMethodSchema,
});

export const accountIdSchema = z.object({
  id: z.uuid("Conta inválida"),
});

// --- Inferred input types --------------------------------------------------

export type CashMovementInput = z.infer<typeof cashMovementSchema>;
export type CashFilterInput = z.infer<typeof cashFilterSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CustomerQueryInput = z.infer<typeof customerQuerySchema>;
export type CustomerIdInput = z.infer<typeof customerIdSchema>;
export type CreateReceivableInput = z.infer<typeof createReceivableSchema>;
export type ReceivableQueryInput = z.infer<typeof receivableQuerySchema>;
export type CreatePayableInput = z.infer<typeof createPayableSchema>;
export type PayableQueryInput = z.infer<typeof payableQuerySchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type AccountIdInput = z.infer<typeof accountIdSchema>;
