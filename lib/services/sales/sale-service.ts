import { withUserRls } from "@/db/rls";
import { insertCashMovement } from "@/lib/services/finance/cash-data";
import { recordSaleReceivable } from "@/lib/services/finance/receivable-service";
import { ValidationError } from "@/lib/services/errors";
import { selectProductById } from "@/lib/services/products/data";
import { selectOpenSessionId } from "@/lib/services/profit/cash-session-data";
import { recordSaleExit } from "@/lib/services/stock/data";
import type { FinalizeSaleInput } from "@/lib/validation/sale";
import type { AuthContext } from "@/types/product";
import type { SaleDto } from "@/types/sale";

import * as data from "./data";

/**
 * RF06/RF07 — finaliza a venda. Em UMA transação `withUserRls` (RN01):
 * resolve cada produto pelo `productId` e usa o preço/nome/unidade DO PRODUTO
 * (snapshot — RN02; ignora qualquer preço do cliente), calcula subtotal e total
 * em centavos (RN06), insere a venda + itens (RN08: userId do contexto) e baixa
 * o estoque (RN05: pode ficar negativo). Carrinho vazio / quantidade ≤ 0 são
 * rejeitados (RN03/RN04).
 */
export async function finalizeSale(
  ctx: AuthContext,
  input: FinalizeSaleInput,
): Promise<SaleDto> {
  if (input.items.length === 0) {
    throw new ValidationError("Adicione pelo menos um item à venda");
  }

  // Mescla quantidades de itens repetidos (mesmo productId) — evita linhas e
  // baixas de estoque duplicadas se o carrinho enviar o produto mais de uma vez.
  const merged = new Map<string, number>();
  for (const item of input.items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new ValidationError("Quantidade deve ser maior que zero");
    }
    merged.set(
      item.productId,
      (merged.get(item.productId) ?? 0) + item.quantity,
    );
  }

  return withUserRls(ctx.userId, async (tx) => {
    const rows: data.SaleItemRow[] = [];
    let totalCents = 0;

    for (const [productId, quantity] of merged) {
      const product = await selectProductById(tx, ctx.tenantId, productId);
      if (!product) {
        throw new ValidationError("Produto não encontrado na venda");
      }
      const subtotalCents = Math.round(product.salePriceCents * quantity);
      totalCents += subtotalCents;
      rows.push({
        productId: product.id,
        nameSnapshot: product.name,
        unit: product.unit,
        unitPriceCents: product.salePriceCents,
        quantity,
        subtotalCents,
        // Snapshot do custo na MESMA tx da venda (RF01/RN03/RNF02); null = produto
        // sem custo cadastrado (RN04), conta 0 no lucro e dispara itemsWithoutCost.
        costCentsSnapshot: product.costCents,
      });
    }

    const customerId = input.customerId ?? null;
    const sale = await data.insertSale(
      tx,
      ctx.tenantId,
      ctx.userId,
      input.paymentMethod,
      totalCents,
      customerId,
    );
    const items = await data.insertSaleItems(tx, ctx.tenantId, sale.id, rows);

    // Retrofit estoque (0003F): registra a saída (movimento + baixa) na mesma tx.
    for (const [productId, quantity] of merged) {
      await recordSaleExit(
        tx,
        ctx.tenantId,
        ctx.userId,
        productId,
        quantity,
        sale.id,
      );
    }

    // Retrofit financeiro (0004F): na MESMA tx —
    // fiado → conta a receber (origem 'venda', RN07 garante customerId);
    // dinheiro → entrada de caixa (origem 'venda', RN08). pix/cartão não tocam caixa.
    if (input.paymentMethod === "fiado") {
      await recordSaleReceivable(tx, ctx.tenantId, ctx.userId, {
        customerId: customerId!,
        totalCents,
        saleId: sale.id,
      });
    } else if (input.paymentMethod === "dinheiro") {
      // RF05: vincula a entrada ao turno aberto (se houver) — entra no esperado
      // da gaveta no fechamento. Sem turno → sessionId null.
      const sessionId = await selectOpenSessionId(tx, ctx.tenantId);
      await insertCashMovement(tx, ctx.tenantId, {
        amountCents: totalCents,
        type: "entrada",
        origin: "venda",
        userId: ctx.userId,
        saleId: sale.id,
        sessionId,
      });
    }

    return {
      id: sale.id,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      totalCents,
      paymentMethod: input.paymentMethod,
      customerId,
      createdAt: sale.createdAt.toISOString(),
      items,
    };
  });
}

/** RF09 — vendas do dia atual (fuso do servidor). */
export async function listTodaySales(ctx: AuthContext): Promise<SaleDto[]> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return withUserRls(ctx.userId, (tx) =>
    data.selectSalesOfDay(tx, ctx.tenantId, from, to),
  );
}
