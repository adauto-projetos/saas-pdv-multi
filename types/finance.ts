import type { PaymentMethod } from "@/lib/validation/sale";

export type { PaymentMethod };

/** Status derivado do saldo: aberto (nada pago), parcial, quitado (RN04). */
export type AccountStatus = "aberto" | "parcial" | "quitado";

/** Tipo de movimentação de caixa (ledger assinado). */
export type CashMovementType = "entrada" | "saida";

/** Origem da movimentação de caixa. */
export type CashOrigin = "venda" | "recebimento" | "pagamento" | "manual";

/** Origem de uma conta a receber. */
export type ReceivableOrigin = "venda" | "avulsa";

export type CustomerDto = {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
};

/** Total em aberto (Σ saldo de contas abertas/parciais) de um cliente (RF10). */
export type CustomerOwedDto = {
  customerId: string;
  name: string;
  totalOwedCents: number;
};

/** Movimentação de caixa — `amountCents` é o delta assinado (entrada +, saída −). */
export type CashMovementDto = {
  id: string;
  amountCents: number;
  type: CashMovementType;
  description: string | null;
  origin: CashOrigin;
  saleId: string | null;
  receivablePaymentId: string | null;
  payablePaymentId: string | null;
  userId: string;
  createdAt: string;
};

export type CashBalanceDto = {
  balanceCents: number;
};

export type ReceivableDto = {
  id: string;
  customerId: string;
  customerName: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  status: AccountStatus;
  origin: ReceivableOrigin;
  saleId: string | null;
  dueDate: string | null;
  overdue: boolean;
  createdAt: string;
};

export type PayableDto = {
  id: string;
  description: string;
  category: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  status: AccountStatus;
  dueDate: string | null;
  overdue: boolean;
  createdAt: string;
};

export type PaymentDto = {
  id: string;
  accountId: string;
  amountCents: number;
  method: PaymentMethod;
  cashMovementId: string | null;
  createdAt: string;
};
