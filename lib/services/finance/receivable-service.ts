import type { RlsTx } from "@/db/rls";
import { withUserRls } from "@/db/rls";
import { NotFoundError, ValidationError } from "@/lib/services/errors";
import type {
  CreateReceivableInput,
  RecordPaymentInput,
} from "@/lib/validation/finance";
import type { CustomerOwedDto, ReceivableDto } from "@/types/finance";
import type { AuthContext } from "@/types/product";

import { insertCashMovement } from "./cash-data";
import * as data from "./receivable-data";

/** RF08 — cria conta a receber avulsa. tenant/user do contexto (RN06). */
export async function createReceivable(
  ctx: AuthContext,
  input: CreateReceivableInput,
): Promise<ReceivableDto> {
  return withUserRls(ctx.userId, async (tx) => {
    const row = await data.insertReceivable(tx, ctx.tenantId, ctx.userId, {
      customerId: input.customerId,
      totalCents: input.totalCents,
      origin: "avulsa",
      description: input.description,
      dueDate: input.dueDate,
    });
    const loaded = await data.selectReceivableWithPaid(tx, ctx.tenantId, row.id);
    // loaded nunca é null logo após o insert na mesma tx.
    return data.receivableDtoFrom(loaded!);
  });
}

/**
 * RF09 — registra recebimento (RNF02): UMA transação que carrega a conta + Σ pago,
 * valida o limite (RN03, ANTES de qualquer insert), insere o pagamento e — só se
 * `method='dinheiro'` (RN08) — gera a entrada de caixa (origem 'recebimento') e
 * faz o back-link. Retorna o DTO re-derivado.
 */
export async function recordReceivablePayment(
  ctx: AuthContext,
  input: RecordPaymentInput,
): Promise<ReceivableDto> {
  return withUserRls(ctx.userId, async (tx) => {
    const loaded = await data.selectReceivableWithPaid(
      tx,
      ctx.tenantId,
      input.accountId,
    );
    if (!loaded) throw new NotFoundError("Conta a receber não encontrada");

    const remaining = loaded.receivable.totalCents - loaded.paidCents;
    if (input.amountCents > remaining) {
      throw new ValidationError(
        "Valor do recebimento excede o saldo devedor da conta",
      );
    }

    const payment = await data.insertReceivablePayment(
      tx,
      ctx.tenantId,
      ctx.userId,
      {
        receivableId: input.accountId,
        amountCents: input.amountCents,
        method: input.method,
      },
    );

    if (input.method === "dinheiro") {
      const movement = await insertCashMovement(tx, ctx.tenantId, {
        amountCents: input.amountCents,
        type: "entrada",
        origin: "recebimento",
        userId: ctx.userId,
        receivablePaymentId: payment.id,
      });
      await data.updateReceivablePaymentCashLink(
        tx,
        ctx.tenantId,
        payment.id,
        movement.id,
      );
    }

    const reloaded = await data.selectReceivableWithPaid(
      tx,
      ctx.tenantId,
      input.accountId,
    );
    return data.receivableDtoFrom(reloaded!);
  });
}

/** RF08/RF14 — lista contas a receber, filtrável por status/cliente. */
export async function listReceivables(
  ctx: AuthContext,
  filter: { status?: ReceivableDto["status"]; customerId?: string },
): Promise<ReceivableDto[]> {
  return withUserRls(ctx.userId, (tx) =>
    data.selectReceivables(tx, ctx.tenantId, {
      status: filter.status,
      customerId: filter.customerId,
    }),
  );
}

/** RF10 — total em aberto de um cliente. */
export async function getCustomerOwedTotal(
  ctx: AuthContext,
  customerId: string,
): Promise<CustomerOwedDto> {
  const result = await withUserRls(ctx.userId, (tx) =>
    data.selectCustomerOwedTotal(tx, ctx.tenantId, customerId),
  );
  if (!result) throw new NotFoundError("Cliente não encontrado");
  return { customerId, name: result.name, totalOwedCents: result.totalOwedCents };
}

/**
 * RF07 — gera a conta a receber de uma venda fiado. Vinculada à transação do
 * chamador (`finalizeSale`): usa a tx recebida, SEM abrir novo withUserRls —
 * mantém a atomicidade da venda. `origin='venda'`.
 */
export async function recordSaleReceivable(
  tx: RlsTx,
  tenantId: string,
  userId: string,
  data_: { customerId: string; totalCents: number; saleId: string },
): Promise<void> {
  await data.insertReceivable(tx, tenantId, userId, {
    customerId: data_.customerId,
    totalCents: data_.totalCents,
    origin: "venda",
    saleId: data_.saleId,
  });
}
