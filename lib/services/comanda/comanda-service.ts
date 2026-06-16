import { withUserRls } from "@/db/rls";
import { insertCashMovement } from "@/lib/services/finance/cash-data";
import { recordSaleReceivable } from "@/lib/services/finance/receivable-service";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/services/errors";
import { selectProductById } from "@/lib/services/products/data";
import { selectOpenSessionId } from "@/lib/services/profit/cash-session-data";
import * as salesData from "@/lib/services/sales/data";
import { recordComandaEstorno, recordComandaExit } from "@/lib/services/stock/data";
import type {
  AddComandaItemInput,
  CloseComandaInput,
  ComandaFilterInput,
  ComandaIdInput,
  OpenComandaInput,
  RemoveComandaItemInput,
} from "@/lib/validation/comanda";
import type { AddComandaItemResult, ComandaDto, ComandaSummaryDto } from "@/types/comanda";
import type { AuthContext } from "@/types/product";
import type { SaleDto } from "@/types/sale";

import * as data from "./comanda-data";

/**
 * Serviço de comandas/mesa (0006F). Tudo sob `withUserRls` (RN01).
 * Tenant/user sempre do `ctx` (RN10). Dinheiro em centavos (RN02).
 * Lifecycle espelha cash-session-service; close espelha finalizeSale sem recordSaleExit (RN08).
 */

// ---- RF01 — abrir comanda --------------------------------------------------

/**
 * RF01 — abre uma comanda com rótulo livre. Sem conflito — RN04 permite várias
 * abertas simultâneas por tenant (diferente do turno único).
 */
export async function openComanda(
  ctx: AuthContext,
  input: OpenComandaInput,
): Promise<ComandaDto> {
  return withUserRls(ctx.userId, async (tx) => {
    const row = await data.insertComanda(tx, ctx.tenantId, ctx.userId, input.label);
    const dto = await data.selectComandaById(tx, ctx.tenantId, row.id);
    // dto nunca é null logo após o insert na mesma tx.
    return dto!;
  });
}

// ---- RF02 — lançar item ----------------------------------------------------

/**
 * RF02/RN03 — lança item e baixa estoque na mesma tx (RNF02).
 * Status 'aberta' é validado; produto existe; estoque pode ficar negativo (RN03).
 *
 * Retorna `AddComandaItemResult` com a comanda atualizada E o item inserido.
 * O caller (action) usa o item para acionar `tryKitchenPrint` pós-tx (RF01/RN04).
 */
export async function addComandaItem(
  ctx: AuthContext,
  input: AddComandaItemInput,
): Promise<AddComandaItemResult> {
  return withUserRls(ctx.userId, async (tx) => {
    // 1. Comanda deve existir e estar 'aberta'.
    const comanda = await data.selectComandaById(tx, ctx.tenantId, input.comandaId);
    if (!comanda) throw new NotFoundError("Comanda não encontrada");
    if (comanda.status !== "aberta") {
      throw new ValidationError("Comanda não está aberta");
    }

    // 2. Produto deve existir.
    const product = await selectProductById(tx, ctx.tenantId, input.productId);
    if (!product) throw new NotFoundError("Produto não encontrado");

    // 3. Insere o item (sem preço — snapshot só no fechamento, RN05).
    const insertedRow = await data.insertComandaItem(
      tx,
      ctx.tenantId,
      input.comandaId,
      input.productId,
      input.quantity,
      input.observation,
    );

    // 4. Baixa estoque imediatamente (RN03). Carimba comanda_id (não sale_id).
    // Pode ficar negativo — não bloqueia (RN03).
    await recordComandaExit(
      tx,
      ctx.tenantId,
      ctx.userId,
      input.productId,
      input.quantity,
      input.comandaId,
    );

    // 5. Recarrega com itens atualizados e preço corrente.
    const dto = await data.selectComandaById(tx, ctx.tenantId, input.comandaId);

    // 6. Monta ComandaItemDto a partir da linha inserida + produto (0007F/RF01).
    // Usado pelo caller para acionar tryKitchenPrint sem nova query ao banco.
    const newItem = {
      id: insertedRow.id,
      productId: insertedRow.productId ?? null,
      name: product.name,
      unit: product.unit,
      unitPriceCents: product.salePriceCents,
      quantity: Number(insertedRow.quantity),
      subtotalCents: Math.round(product.salePriceCents * Number(insertedRow.quantity)),
      observation: insertedRow.observation ?? null,
    };

    return { comanda: dto!, item: newItem };
  });
}

// ---- RF03 — remover item ---------------------------------------------------

/**
 * RF03/RN03 — remove item e estorna estoque na mesma tx (RNF02).
 * Comanda deve estar 'aberta'; item deve existir.
 */
export async function removeComandaItem(
  ctx: AuthContext,
  input: RemoveComandaItemInput,
): Promise<ComandaDto> {
  return withUserRls(ctx.userId, async (tx) => {
    // 1. Comanda deve existir e estar 'aberta'.
    const comanda = await data.selectComandaById(tx, ctx.tenantId, input.comandaId);
    if (!comanda) throw new NotFoundError("Comanda não encontrada");
    if (comanda.status !== "aberta") {
      throw new ValidationError("Comanda não está aberta");
    }

    // 2. Item deve existir na comanda.
    const item = comanda.items.find((i) => i.id === input.itemId);
    if (!item) throw new NotFoundError("Item não encontrado na comanda");

    // 3. Estorna estoque (+qty de volta, mesmo comanda_id).
    if (item.productId) {
      await recordComandaEstorno(
        tx,
        ctx.tenantId,
        ctx.userId,
        item.productId,
        item.quantity,
        input.comandaId,
      );
    }

    // 4. Remove o item.
    await data.deleteComandaItem(tx, ctx.tenantId, input.comandaId, input.itemId);

    // 5. Recarrega.
    const dto = await data.selectComandaById(tx, ctx.tenantId, input.comandaId);
    return dto!;
  });
}

// ---- RF04 — cancelar comanda -----------------------------------------------

/**
 * RF04/RN06 — cancela comanda aberta. Estorna estoque de TODOS os itens (RN03).
 * NÃO cria venda (RN06). Comanda deve estar 'aberta'.
 */
export async function cancelComanda(
  ctx: AuthContext,
  input: ComandaIdInput,
): Promise<ComandaDto> {
  return withUserRls(ctx.userId, async (tx) => {
    // 1. Comanda deve existir e estar 'aberta'.
    const comanda = await data.selectComandaById(tx, ctx.tenantId, input.comandaId);
    if (!comanda) throw new NotFoundError("Comanda não encontrada");
    if (comanda.status !== "aberta") {
      throw new ConflictError("Comanda não está aberta");
    }

    // 2. Estorna estoque de todos os itens (RF04/RN03).
    for (const item of comanda.items) {
      if (item.productId) {
        await recordComandaEstorno(
          tx,
          ctx.tenantId,
          ctx.userId,
          item.productId,
          item.quantity,
          input.comandaId,
        );
      }
    }

    // 3. Marca status='cancelada'. WHERE status='aberta' é guarda de corrida.
    const updated = await data.cancelComandaRow(
      tx,
      ctx.tenantId,
      input.comandaId,
      ctx.userId,
    );
    if (!updated) {
      // Corrida: a comanda deixou de estar 'aberta' entre o select e o update.
      throw new ConflictError("Comanda não está aberta");
    }

    // 4. Recarrega DTO final (sem itens, pois status='cancelada').
    const dto = await data.selectComandaById(tx, ctx.tenantId, input.comandaId);
    return dto!;
  });
}

// ---- RF06/RF07 — fechar comanda (vira venda) --------------------------------

/**
 * RF06/RF07 — fecha a comanda numa única tx (RNF02), espelhando `finalizeSale`
 * MENOS a baixa de estoque (RN08 — já foi baixado no lançamento).
 *
 * Passos:
 * 1. Valida comanda 'aberta' e ≥1 item (RN07).
 * 2. Valida fiado → customerId (RN07).
 * 3. Por item: selectProductById no close → snapshot (RN05).
 * 4. Calcula totalCents = Σ (snapshotPrice × qty).
 * 5. insertSale + insertSaleItems (com costCentsSnapshot — RF07/RN05).
 * 6. closeComandaRow (status='fechada', sale_id, closed_by/at).
 * 7. Financeiro: dinheiro→caixa (vincula sessão se houver, RN09);
 *    fiado→a receber (RN07); pix/cartão → nada.
 * 8. SEM recordSaleExit (RN08).
 */
export async function closeComanda(
  ctx: AuthContext,
  input: CloseComandaInput,
): Promise<SaleDto> {
  return withUserRls(ctx.userId, async (tx) => {
    // 1. Comanda aberta + ≥1 item.
    const comanda = await data.selectComandaById(tx, ctx.tenantId, input.comandaId);
    if (!comanda) throw new NotFoundError("Comanda não encontrada");
    if (comanda.status !== "aberta") {
      throw new ConflictError("Comanda não está aberta");
    }
    if (comanda.items.length === 0) {
      throw new ValidationError(
        "Não é possível fechar uma comanda sem itens",
      );
    }

    // 2. Fiado exige cliente (RN07 — zod garante, mas validamos aqui também).
    const customerId = input.customerId ?? null;
    if (input.paymentMethod === "fiado" && !customerId) {
      throw new ValidationError("Cliente obrigatório para fiado");
    }

    // 3+4. Snapshot de preço/custo no close (RN05) + calcula total.
    const rows: salesData.SaleItemRow[] = [];
    let totalCents = 0;

    for (const item of comanda.items) {
      if (!item.productId) {
        // Produto removido do catálogo — impossível fazer snapshot. Rejeita.
        throw new ValidationError(
          `Produto do item "${item.name}" não está mais disponível. Remova o item para fechar a comanda.`,
        );
      }
      const product = await selectProductById(tx, ctx.tenantId, item.productId);
      if (!product) {
        throw new ValidationError(
          `Produto "${item.name}" não encontrado. Remova o item para fechar a comanda.`,
        );
      }
      const subtotalCents = Math.round(product.salePriceCents * item.quantity);
      totalCents += subtotalCents;
      rows.push({
        productId: product.id,
        nameSnapshot: product.name,
        unit: product.unit,
        unitPriceCents: product.salePriceCents,
        quantity: item.quantity,
        subtotalCents,
        // Snapshot do custo na MESMA tx do fechamento (RF07/RN05).
        costCentsSnapshot: product.costCents,
      });
    }

    // 5. Cria a venda + itens. Passa comandaId como back-link (RF06).
    const sale = await salesData.insertSale(
      tx,
      ctx.tenantId,
      ctx.userId,
      input.paymentMethod,
      totalCents,
      customerId,
      input.comandaId,
    );
    const saleItems = await salesData.insertSaleItems(
      tx,
      ctx.tenantId,
      sale.id,
      rows,
    );

    // 6. Fecha a comanda (status='fechada', sale_id, closed_by/at).
    const updated = await data.closeComandaRow(
      tx,
      ctx.tenantId,
      input.comandaId,
      sale.id,
      ctx.userId,
    );
    if (!updated) {
      // Corrida: a comanda deixou de estar 'aberta' entre o select e o update.
      throw new ConflictError("Comanda não está aberta");
    }

    // 7. Financeiro — mirror de finalizeSale (0004F).
    if (input.paymentMethod === "fiado") {
      // Conta a receber (RN07 garante customerId).
      await recordSaleReceivable(tx, ctx.tenantId, ctx.userId, {
        customerId: customerId!,
        totalCents,
        saleId: sale.id,
      });
    } else if (input.paymentMethod === "dinheiro") {
      // RF07: vincula ao turno aberto se houver — entra no esperado da gaveta (RN09).
      // Sem turno → sessionId null. Sem bloqueio/aviso (RN09).
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
    // pix/cartão → nada (RN09).

    // 8. NÃO chama recordSaleExit — estoque já foi baixado no lançamento (RN08).

    return {
      id: sale.id,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      totalCents,
      paymentMethod: input.paymentMethod,
      customerId,
      createdAt: sale.createdAt.toISOString(),
      items: saleItems,
    };
  });
}

// ---- RF05 — consulta / leitura ---------------------------------------------

/**
 * RF05 — retorna a comanda com itens + total parcial ao vivo (preço corrente).
 */
export async function getComanda(
  ctx: AuthContext,
  input: ComandaIdInput,
): Promise<ComandaDto> {
  return withUserRls(ctx.userId, async (tx) => {
    const dto = await data.selectComandaById(tx, ctx.tenantId, input.comandaId);
    if (!dto) throw new NotFoundError("Comanda não encontrada");
    return dto;
  });
}

// ---- RF08 — listar abertas / histórico -------------------------------------

/**
 * RF08/RNF01 — lista comandas abertas com total parcial via JOIN (sem N+1).
 */
export async function listOpenComandas(ctx: AuthContext): Promise<ComandaDto[]> {
  return withUserRls(ctx.userId, (tx) =>
    data.selectOpenComandas(tx, ctx.tenantId),
  );
}

/**
 * RF08 — histórico de comandas fechadas/canceladas, filtrável por período/status.
 */
export async function listComandaHistory(
  ctx: AuthContext,
  filter: ComandaFilterInput,
): Promise<ComandaSummaryDto[]> {
  return withUserRls(ctx.userId, (tx) =>
    data.selectComandaHistory(tx, ctx.tenantId, filter),
  );
}
