import { withUserRls } from "@/db/rls";
import { NotFoundError, ValidationError } from "@/lib/services/errors";
import type {
  CreatePayableInput,
  RecordPaymentInput,
} from "@/lib/validation/finance";
import type { PayableDto } from "@/types/finance";
import type { AuthContext } from "@/types/product";

import { insertCashMovement } from "./cash-data";
import * as data from "./payable-data";

/** RF11 — cria conta a pagar. tenant/user do contexto (RN06); categoria obrigatória. */
export async function createPayable(
  ctx: AuthContext,
  input: CreatePayableInput,
): Promise<PayableDto> {
  return withUserRls(ctx.userId, async (tx) => {
    const row = await data.insertPayable(tx, ctx.tenantId, ctx.userId, {
      description: input.description,
      totalCents: input.totalCents,
      category: input.category,
      dueDate: input.dueDate,
    });
    const loaded = await data.selectPayableWithPaid(tx, ctx.tenantId, row.id);
    return data.payableDtoFrom(loaded!);
  });
}

/**
 * RF12 — registra pagamento (RNF02): carrega conta + Σ pago, valida limite (RN03,
 * ANTES de inserir), insere o pagamento e — só se `method='dinheiro'` (RN08) —
 * gera a SAÍDA de caixa (origem 'pagamento') + back-link. DTO re-derivado.
 */
export async function recordPayablePayment(
  ctx: AuthContext,
  input: RecordPaymentInput,
): Promise<PayableDto> {
  return withUserRls(ctx.userId, async (tx) => {
    const loaded = await data.selectPayableWithPaid(
      tx,
      ctx.tenantId,
      input.accountId,
    );
    if (!loaded) throw new NotFoundError("Conta a pagar não encontrada");

    const remaining = loaded.payable.totalCents - loaded.paidCents;
    if (input.amountCents > remaining) {
      throw new ValidationError(
        "Valor do pagamento excede o saldo devedor da conta",
      );
    }

    const payment = await data.insertPayablePayment(
      tx,
      ctx.tenantId,
      ctx.userId,
      {
        payableId: input.accountId,
        amountCents: input.amountCents,
        method: input.method,
      },
    );

    if (input.method === "dinheiro") {
      const movement = await insertCashMovement(tx, ctx.tenantId, {
        amountCents: input.amountCents,
        type: "saida",
        origin: "pagamento",
        userId: ctx.userId,
        payablePaymentId: payment.id,
      });
      await data.updatePayablePaymentCashLink(
        tx,
        ctx.tenantId,
        payment.id,
        movement.id,
      );
    }

    const reloaded = await data.selectPayableWithPaid(
      tx,
      ctx.tenantId,
      input.accountId,
    );
    return data.payableDtoFrom(reloaded!);
  });
}

/** RF11/RF14 — lista contas a pagar, filtrável por status/categoria. */
export async function listPayables(
  ctx: AuthContext,
  filter: { status?: PayableDto["status"]; category?: string },
): Promise<PayableDto[]> {
  return withUserRls(ctx.userId, (tx) =>
    data.selectPayables(tx, ctx.tenantId, {
      status: filter.status,
      category: filter.category,
    }),
  );
}
