import { and, eq } from "drizzle-orm";

import { withUserRls } from "@/db/rls";
import { comandaItems, comandas, products, saleItems, sales } from "@/db/schema";
import type { AuthContext } from "@/types/product";
import type { ComandaDto, ComandaItemDto } from "@/types/comanda";
import type { SaleDto } from "@/types/sale";
import type { ProductUnit } from "@/types/product";

import {
  getNextKitchenOrderNum,
  insertPrintLog,
  selectCustomerName,
  selectTenantName,
} from "./print-data";
import { UsbPrinterDriver } from "./printer-driver";

/**
 * Serviço de impressão (0007F). NUNCA lança — toda função retorna
 * `{ success: false, error }` em caso de falha (RF05/RN04).
 *
 * Prints são side-effects FORA da tx de banco (RN04): a tx de venda/comanda
 * já commitou quando estes são chamados. Falha de impressora nunca reverte venda.
 */

// ---- helper -----------------------------------------------------------------

/**
 * Retorna a data atual em UTC-3 no formato YYYY-MM-DD (RN02).
 * O sequencial de cozinha reinicia à meia-noite local (UTC-3).
 */
function todayUtcMinus3(): string {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// ---- T06 — tryKitchenPrint / tryReceiptPrint --------------------------------

/**
 * RF01 — imprime pedido de cozinha após `addComandaItem`.
 * Gera número sequencial atômico por tenant+dia (RN02) ANTES do print.
 * Registra log de impressão (sucesso ou falha) em tx própria (RF08).
 * Nunca lança — toda falha resulta em `{ success: false }` (RF05/RN04).
 */
export async function tryKitchenPrint(
  ctx: AuthContext,
  item: ComandaItemDto,
  comanda: ComandaDto,
): Promise<{ success: boolean; orderNum?: number; error?: string }> {
  try {
    // 1. Número sequencial atômico em tx própria (RN02).
    const orderNum = await withUserRls(ctx.userId, (tx) =>
      getNextKitchenOrderNum(tx, ctx.tenantId, todayUtcMinus3()),
    );

    // 2. Driver — instanciado após commit do seq.
    const driver = new UsbPrinterDriver();

    // 3. Envia para impressora.
    await driver.printKitchenSlip({
      orderNum,
      comandaLabel: comanda.label,
      items: [
        {
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          observation: item.observation,
        },
      ],
    });

    // 4. Log de sucesso em tx própria.
    await withUserRls(ctx.userId, (tx) =>
      insertPrintLog(tx, {
        tenantId: ctx.tenantId,
        type: "cozinha",
        triggerId: item.id,
        status: "ok",
        printedBy: ctx.userId,
      }),
    );

    return { success: true, orderNum };
  } catch (err) {
    // 5. Log de falha em tx separada.
    const errorMessage = err instanceof Error ? err.message : String(err);
    try {
      await withUserRls(ctx.userId, (tx) =>
        insertPrintLog(tx, {
          tenantId: ctx.tenantId,
          type: "cozinha",
          triggerId: item.id,
          status: "falhou",
          errorMessage,
          printedBy: ctx.userId,
        }),
      );
    } catch {
      // Silencia falha do log para não mascarar o erro original.
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * RF03 — imprime cupom simples após `closeComanda` ou `finalizeSale`.
 * `tenantName` deve ser resolvido pelo caller em tx separada antes desta chamada
 * (ver plan.md — mantém tx de venda curta; RN08).
 * Nunca lança (RF05/RN04).
 */
export async function tryReceiptPrint(
  ctx: AuthContext,
  sale: SaleDto,
  tenantName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Nome do cliente para pagamento fiado (RF03 — opcional para outros métodos).
    let customerName: string | undefined;
    if (sale.paymentMethod === "fiado" && sale.customerId) {
      customerName =
        (await withUserRls(ctx.userId, (tx) =>
          selectCustomerName(tx, ctx.tenantId, sale.customerId!),
        )) ?? undefined;
    }

    // 2. Driver.
    const driver = new UsbPrinterDriver();

    // 3. Envia cupom ao hardware.
    await driver.printReceipt({
      tenantName,
      saleId: sale.id,
      items: sale.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        unitPriceCents: i.unitPriceCents,
        subtotalCents: i.subtotalCents,
      })),
      totalCents: sale.totalCents,
      paymentMethod: sale.paymentMethod,
      customerName,
      createdAt: sale.createdAt,
    });

    // 4. Log de sucesso.
    await withUserRls(ctx.userId, (tx) =>
      insertPrintLog(tx, {
        tenantId: ctx.tenantId,
        type: "cupom",
        triggerId: sale.id,
        status: "ok",
        printedBy: ctx.userId,
      }),
    );

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    try {
      await withUserRls(ctx.userId, (tx) =>
        insertPrintLog(tx, {
          tenantId: ctx.tenantId,
          type: "cupom",
          triggerId: sale.id,
          status: "falhou",
          errorMessage,
          printedBy: ctx.userId,
        }),
      );
    } catch {
      // Silencia falha do log.
    }
    return { success: false, error: errorMessage };
  }
}

// ---- T07 — reprintKitchen / reprintReceipt ----------------------------------

/**
 * RF07 — reimprime pedido de cozinha usando dados imutáveis já gravados (RN03).
 * NÃO gera novo número sequencial (RN03 — reimpressão não incrementa seq).
 * orderNum=0 indica reimpressão ao driver.
 */
export async function reprintKitchen(
  ctx: AuthContext,
  comandaItemId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Carrega item + produto (dados imutáveis — RN03).
    const itemRow = await withUserRls(ctx.userId, async (tx) => {
      const [row] = await tx
        .select({
          id: comandaItems.id,
          comandaId: comandaItems.comandaId,
          productId: comandaItems.productId,
          quantity: comandaItems.quantity,
          observation: comandaItems.observation,
          productName: products.name,
          productUnit: products.unit,
        })
        .from(comandaItems)
        .leftJoin(products, eq(comandaItems.productId, products.id))
        .where(
          and(
            eq(comandaItems.tenantId, ctx.tenantId),
            eq(comandaItems.id, comandaItemId),
          ),
        )
        .limit(1);
      return row ?? null;
    });

    if (!itemRow) {
      throw new Error("Item de comanda não encontrado");
    }

    // 2. Comanda label — SELECT da comanda pai.
    const comandaLabel = await withUserRls(ctx.userId, async (tx) => {
      const [c] = await tx
        .select({ label: comandas.label })
        .from(comandas)
        .where(
          and(
            eq(comandas.tenantId, ctx.tenantId),
            eq(comandas.id, itemRow.comandaId),
          ),
        )
        .limit(1);
      return c?.label ?? "Comanda";
    });

    // 3. Driver — orderNum=0 para reimpressão (RN03: sem novo seq).
    const driver = new UsbPrinterDriver();
    await driver.printKitchenSlip({
      orderNum: 0,
      comandaLabel,
      items: [
        {
          name: itemRow.productName ?? "(produto removido)",
          quantity: Number(itemRow.quantity),
          unit: itemRow.productUnit ?? "un",
          observation: itemRow.observation ?? null,
        },
      ],
    });

    // 4. Log de reimpressão bem-sucedida.
    await withUserRls(ctx.userId, (tx) =>
      insertPrintLog(tx, {
        tenantId: ctx.tenantId,
        type: "cozinha",
        triggerId: comandaItemId,
        status: "ok",
        printedBy: ctx.userId,
      }),
    );

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    try {
      await withUserRls(ctx.userId, (tx) =>
        insertPrintLog(tx, {
          tenantId: ctx.tenantId,
          type: "cozinha",
          triggerId: comandaItemId,
          status: "falhou",
          errorMessage,
          printedBy: ctx.userId,
        }),
      );
    } catch {
      // Silencia falha do log.
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * RF07 — reimprime cupom de venda usando SaleDto imutável (RN03).
 * Carrega a venda do banco + tenantName em tx própria, então envia ao driver.
 */
export async function reprintReceipt(
  ctx: AuthContext,
  saleId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Carrega SaleDto original (imutável — RN03).
    const saleDto = await withUserRls(ctx.userId, async (tx) => {
      const [saleRow] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.tenantId, ctx.tenantId), eq(sales.id, saleId)))
        .limit(1);
      if (!saleRow) return null;

      const itemRows = await tx
        .select()
        .from(saleItems)
        .where(
          and(
            eq(saleItems.tenantId, ctx.tenantId),
            eq(saleItems.saleId, saleId),
          ),
        );

      const dto: SaleDto = {
        id: saleRow.id,
        tenantId: saleRow.tenantId,
        userId: saleRow.userId,
        totalCents: saleRow.totalCents,
        paymentMethod: saleRow.paymentMethod as SaleDto["paymentMethod"],
        customerId: saleRow.customerId,
        createdAt: saleRow.createdAt.toISOString(),
        items: itemRows.map((i) => ({
          id: i.id,
          productId: i.productId,
          name: i.nameSnapshot,
          unit: i.unit as ProductUnit,
          unitPriceCents: i.unitPriceCents,
          quantity: Number(i.quantity),
          subtotalCents: i.subtotalCents,
        })),
      };
      return dto;
    });

    if (!saleDto) {
      throw new Error("Venda não encontrada");
    }

    // 2. Nome do tenant em tx própria (RN08).
    const tenantName = await withUserRls(ctx.userId, (tx) =>
      selectTenantName(tx, ctx.tenantId),
    );

    // 3. Nome do cliente para fiado (RF03).
    let customerName: string | undefined;
    if (saleDto.paymentMethod === "fiado" && saleDto.customerId) {
      customerName =
        (await withUserRls(ctx.userId, (tx) =>
          selectCustomerName(tx, ctx.tenantId, saleDto.customerId!),
        )) ?? undefined;
    }

    // 4. Driver.
    const driver = new UsbPrinterDriver();
    await driver.printReceipt({
      tenantName,
      saleId: saleDto.id,
      items: saleDto.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        unitPriceCents: i.unitPriceCents,
        subtotalCents: i.subtotalCents,
      })),
      totalCents: saleDto.totalCents,
      paymentMethod: saleDto.paymentMethod,
      customerName,
      createdAt: saleDto.createdAt,
    });

    // 5. Log de sucesso.
    await withUserRls(ctx.userId, (tx) =>
      insertPrintLog(tx, {
        tenantId: ctx.tenantId,
        type: "cupom",
        triggerId: saleId,
        status: "ok",
        printedBy: ctx.userId,
      }),
    );

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    try {
      await withUserRls(ctx.userId, (tx) =>
        insertPrintLog(tx, {
          tenantId: ctx.tenantId,
          type: "cupom",
          triggerId: saleId,
          status: "falhou",
          errorMessage,
          printedBy: ctx.userId,
        }),
      );
    } catch {
      // Silencia falha do log.
    }
    return { success: false, error: errorMessage };
  }
}
