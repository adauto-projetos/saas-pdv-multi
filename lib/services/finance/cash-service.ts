import { withUserRls } from "@/db/rls";
import type {
  CashFilterInput,
  CashMovementInput,
} from "@/lib/validation/finance";
import type {
  CashBalanceDto,
  CashMovementDto,
  CashMovementType,
} from "@/types/finance";
import type { AuthContext } from "@/types/product";

import * as data from "./cash-data";

/**
 * RF01/RF02 — suprimento (entrada) ou sangria (saída) manual do caixa. O `type`
 * é decidido pela action; aqui só persistimos com origem 'manual'. `userId`/
 * `tenantId` vêm do contexto (RN06). `amountCents` é a magnitude (RN02); o sinal
 * é imposto no data layer.
 */
export async function registerCashMovement(
  ctx: AuthContext,
  input: CashMovementInput & { type: CashMovementType },
): Promise<CashMovementDto> {
  return withUserRls(ctx.userId, (tx) =>
    data.insertCashMovement(tx, ctx.tenantId, {
      amountCents: input.amountCents,
      type: input.type,
      origin: "manual",
      description: input.description,
      userId: ctx.userId,
    }),
  );
}

/** RF03/RN05 — saldo corrente do caixa (Σ ledger). */
export async function getCashBalance(
  ctx: AuthContext,
): Promise<CashBalanceDto> {
  const balanceCents = await withUserRls(ctx.userId, (tx) =>
    data.selectCashBalance(tx, ctx.tenantId),
  );
  return { balanceCents };
}

/** RF04 — extrato de movimentações do caixa, filtrável por data. */
export async function listCashMovements(
  ctx: AuthContext,
  filter: CashFilterInput,
): Promise<CashMovementDto[]> {
  return withUserRls(ctx.userId, (tx) =>
    data.selectCashMovements(tx, ctx.tenantId, {
      from: filter.from,
      to: filter.to,
    }),
  );
}
