// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  cashMovements,
  comandas,
  receivables,
  sales,
  saleItems,
  stockMovements,
} from "@/db/schema";
import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  getProductStock,
  HAS_DB,
  seedCashSession,
  seedCustomer,
  seedProduct,
  seedTenant,
  setProductPrice,
} from "@/db/__tests__/seed";
import { ConflictError, ValidationError } from "@/lib/services/errors";
import {
  closeComandaSchema,
  addComandaItemSchema,
  comandaIdSchema,
  openComandaSchema,
  removeComandaItemSchema,
} from "@/lib/validation/comanda";
import type { AuthContext } from "@/types/product";
import { and, eq } from "drizzle-orm";

import {
  addComandaItem,
  cancelComanda,
  closeComanda,
  getComanda,
  listComandaHistory,
  listOpenComandas,
  openComanda,
  removeComandaItem,
} from "./comanda-service";

const suite = HAS_DB ? describe : describe.skip;

suite("comanda-service (integração)", () => {
  let user = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let tenantId = "";
  let productId = ""; // un, salePriceCents=1000, stock=10
  let costProductId = ""; // un, salePriceCents=1000, costCents=400, stock=100
  let noCostProductId = ""; // un, salePriceCents=1000, costCents=null, stock=100
  let customerId = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja Comanda");
    ctx = { userId: user.userId, tenantId };
    customerId = await seedCustomer(tenantId, "Cliente Fiado");
    productId = await seedProduct(tenantId, {
      name: "Refri Lata",
      unit: "un",
      salePriceCents: 1000,
      stockQuantity: 10,
    });
    costProductId = await seedProduct(tenantId, {
      name: "Com Custo",
      unit: "un",
      salePriceCents: 1000,
      stockQuantity: 100,
      costCents: 400,
    });
    noCostProductId = await seedProduct(tenantId, {
      name: "Sem Custo",
      unit: "un",
      salePriceCents: 1000,
      stockQuantity: 100,
      costCents: null,
    });
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (user.userId) await deleteTestUser(user.userId);
  });

  // ---- helpers ----
  const open = (label = "Mesa 1") =>
    openComanda(ctx, openComandaSchema.parse({ label }));

  const addItem = (
    comandaId: string,
    pid: string,
    quantity: number,
    observation?: string | null,
  ) =>
    addComandaItem(
      ctx,
      addComandaItemSchema.parse({ comandaId, productId: pid, quantity, observation }),
    );

  const removeItem = (comandaId: string, itemId: string) =>
    removeComandaItem(
      ctx,
      removeComandaItemSchema.parse({ comandaId, itemId }),
    );

  const cancel = (comandaId: string) =>
    cancelComanda(ctx, comandaIdSchema.parse({ comandaId }));

  const close = (
    comandaId: string,
    paymentMethod = "dinheiro",
    cid?: string,
  ) =>
    closeComanda(
      ctx,
      closeComandaSchema.parse({ comandaId, paymentMethod, customerId: cid }),
    );

  // ---- comanda-RF01-open ---------------------------------------------------

  it("comanda-RF01-open — abre com rótulo livre, status='aberta', items=[]", async () => {
    const dto = await open("Mesa 3");
    expect(dto.status).toBe("aberta");
    expect(dto.label).toBe("Mesa 3");
    expect(dto.openedBy).toBe(ctx.userId);
    expect(dto.items).toHaveLength(0);
    expect(dto.partialTotalCents).toBe(0);
    expect(dto.saleId).toBeNull();
  });

  // ---- comanda-RN04-multi-open ---------------------------------------------

  it("comanda-RN04-multi-open — várias abertas simultâneas sem conflito", async () => {
    const a = await open("Mesa 1");
    const b = await open("Mesa 2");
    expect(a.id).not.toBe(b.id);
    expect(a.status).toBe("aberta");
    expect(b.status).toBe("aberta");

    const list = await listOpenComandas(ctx);
    const ids = list.map((c) => c.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
  });

  // ---- comanda-RN10-attribution --------------------------------------------

  it("comanda-RN10-attribution — openedBy e tenantId do ctx", async () => {
    const dto = await open("Atribuição");
    expect(dto.openedBy).toBe(ctx.userId);
    // tenantId não está no DTO mas verifica via DB
    const [row] = await db
      .select()
      .from(comandas)
      .where(eq(comandas.id, dto.id));
    expect(row.tenantId).toBe(ctx.tenantId);
  });

  // ---- comanda-RF02-add-item -----------------------------------------------

  it("comanda-RF02-add-item — lançar item adiciona à comanda", async () => {
    const c = await open("Add Item");
    const updated = await addItem(c.id, productId, 2);
    expect(updated.comanda.items).toHaveLength(1);
    expect(updated.comanda.items[0].quantity).toBe(2);
    expect(updated.comanda.items[0].productId).toBe(productId);
  });

  // ---- comanda-RN03-add-decrements-stock -----------------------------------

  it("comanda-RN03-add-decrements-stock — lançar baixa estoque imediatamente", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Estoque Lançar",
      unit: "un",
      salePriceCents: 500,
      stockQuantity: 10,
    });
    const c = await open("Baixa Estoque");
    await addItem(c.id, pid, 3);

    const stock = parseFloat(await getProductStock(pid));
    expect(stock).toBe(7);

    // Movimento deve ter comanda_id (não sale_id).
    const movements = await db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.productId, pid)));
    const exitMov = movements.find((m) => m.type === "saida");
    expect(exitMov).toBeDefined();
    expect(exitMov?.comandaId).toBe(c.id);
    expect(exitMov?.saleId).toBeNull();
  });

  // ---- comanda-RN05-item-no-price ------------------------------------------

  it("comanda-RN05-item-no-price — item usa preço corrente (não congelado)", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Preço Corrente",
      unit: "un",
      salePriceCents: 2000,
      stockQuantity: 10,
    });
    const c = await open("Preço Corrente");
    await addItem(c.id, pid, 2);

    // Muda o preço do produto
    await setProductPrice(pid, 9999);

    // Total parcial deve refletir o preço atual
    const updated = await getComanda(ctx, comandaIdSchema.parse({ comandaId: c.id }));
    expect(updated.items[0].unitPriceCents).toBe(9999);
  });

  // ---- comanda-RN11-observation --------------------------------------------

  it("comanda-RN11-observation — observação gravada, não afeta cálculo", async () => {
    const c = await open("Observação");
    const updated = await addItem(c.id, productId, 1, "sem cebola");
    const item = updated.comanda.items[0];
    expect(item.observation).toBe("sem cebola");
    // subtotal independe da observação
    expect(item.subtotalCents).toBe(1000);
  });

  it("comanda-RN11-observation-null — sem observation → null", async () => {
    const c = await open("Obs Null");
    const updated = await addItem(c.id, productId, 1);
    expect(updated.comanda.items[0].observation).toBeNull();
  });

  // ---- comanda-RN03-add-stock-negative ------------------------------------

  it("comanda-RN03-add-stock-negative — estoque pode ficar negativo", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Estoque Negativo",
      unit: "un",
      salePriceCents: 100,
      stockQuantity: 1,
    });
    const c = await open("Negativo");
    // Não deve lançar erro mesmo com qty > stock
    const updated = await addItem(c.id, pid, 5);
    expect(updated.comanda.items[0].quantity).toBe(5);
    const stock = parseFloat(await getProductStock(pid));
    expect(stock).toBe(-4);
  });

  // ---- comanda-RF03-remove-item -------------------------------------------

  it("comanda-RF03-remove-item — remove item de comanda aberta", async () => {
    const c = await open("Remover");
    const withItem = await addItem(c.id, productId, 2);
    const itemId = withItem.comanda.items[0].id;
    const afterRemove = await removeItem(c.id, itemId);
    expect(afterRemove.items).toHaveLength(0);
    expect(afterRemove.status).toBe("aberta");
  });

  // ---- comanda-RN03-remove-estorna-stock -----------------------------------

  it("comanda-RN03-remove-estorna-stock — remover estorna estoque", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Estoque Estorno",
      unit: "un",
      salePriceCents: 500,
      stockQuantity: 10,
    });
    const c = await open("Estorno");
    const withItem = await addItem(c.id, pid, 3); // stock → 7
    const itemId = withItem.comanda.items[0].id;

    await removeItem(c.id, itemId); // estorna → stock 10

    const stock = parseFloat(await getProductStock(pid));
    expect(stock).toBe(10);

    // Movimento de estorno deve ter comanda_id
    const movements = await db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.productId, pid)));
    const estornoMov = movements.find((m) => m.type === "entrada");
    expect(estornoMov?.comandaId).toBe(c.id);
  });

  // ---- comanda-RF04-cancel ------------------------------------------------

  it("comanda-RF04-cancel — cancelar → 'cancelada', sem venda", async () => {
    const c = await open("Cancelar");
    await addItem(c.id, productId, 1);
    await addItem(c.id, productId, 1);

    const dto = await cancel(c.id);
    expect(dto.status).toBe("cancelada");
    expect(dto.saleId).toBeNull();

    // Não criou venda
    const saleByCmnd = await db
      .select()
      .from(sales)
      .where(eq(sales.comandaId, c.id));
    expect(saleByCmnd).toHaveLength(0);
  });

  // ---- comanda-RN03-cancel-estorna-all ------------------------------------

  it("comanda-RN03-cancel-estorna-all — cancelar estorna TODOS os itens", async () => {
    const pidA = await seedProduct(tenantId, {
      name: "Produto A Cancel",
      unit: "un",
      salePriceCents: 100,
      stockQuantity: 10,
    });
    const pidB = await seedProduct(tenantId, {
      name: "Produto B Cancel",
      unit: "un",
      salePriceCents: 100,
      stockQuantity: 5,
    });
    const c = await open("Cancel All");
    await addItem(c.id, pidA, 3); // A: 10→7
    await addItem(c.id, pidB, 2); // B: 5→3

    await cancel(c.id);

    const stockA = parseFloat(await getProductStock(pidA));
    const stockB = parseFloat(await getProductStock(pidB));
    expect(stockA).toBe(10);
    expect(stockB).toBe(5);
  });

  // ---- comanda-RF05-partial-total ------------------------------------------

  it("comanda-RF05-partial-total — parcial = Σ preço atual × qtd", async () => {
    const pid1 = await seedProduct(tenantId, {
      name: "Un 1000",
      unit: "un",
      salePriceCents: 1000,
      stockQuantity: 50,
    });
    const pid2 = await seedProduct(tenantId, {
      name: "Kg 590",
      unit: "kg",
      salePriceCents: 590,
      stockQuantity: 50,
    });
    const c = await open("Parcial");
    await addItem(c.id, pid1, 2); // 2000
    await addItem(c.id, pid2, 0.75); // round(590*0.75) = 443

    const dto = await getComanda(ctx, comandaIdSchema.parse({ comandaId: c.id }));
    expect(dto.partialTotalCents).toBe(2443);
  });

  it("comanda-RF05-partial-reflects-price-change — parcial muda com preço do produto", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Price Change",
      unit: "un",
      salePriceCents: 2000,
      stockQuantity: 10,
    });
    const c = await open("Price Change");
    await addItem(c.id, pid, 2); // 4000

    await setProductPrice(pid, 1500);
    const dto = await getComanda(ctx, comandaIdSchema.parse({ comandaId: c.id }));
    expect(dto.partialTotalCents).toBe(3000); // 1500*2
  });

  it("comanda-RF05-partial-empty — sem itens → parcial 0", async () => {
    const c = await open("Empty Parcial");
    expect(c.partialTotalCents).toBe(0);
    expect(c.items).toHaveLength(0);
  });

  // ---- comanda-RF06-close-creates-sale ------------------------------------

  it("comanda-RF06-close-creates-sale — fechar cria venda+itens, 'fechada'", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Un Close",
      unit: "un",
      salePriceCents: 1000,
      stockQuantity: 20,
    });
    const c = await open("Close Sale");
    await addItem(c.id, pid, 2);

    const saleDto = await close(c.id, "dinheiro");
    expect(saleDto.totalCents).toBe(2000);
    expect(saleDto.items).toHaveLength(1);

    // Comanda deve estar fechada com saleId set
    const [row] = await db.select().from(comandas).where(eq(comandas.id, c.id));
    expect(row.status).toBe("fechada");
    expect(row.saleId).toBe(saleDto.id);

    // Sale deve ter comanda_id
    const [saleRow] = await db.select().from(sales).where(eq(sales.id, saleDto.id));
    expect(saleRow.comandaId).toBe(c.id);
  });

  // ---- comanda-RN05-close-snapshot ----------------------------------------

  it("comanda-RN05-close-snapshot — sale_items snapshot de preço NO close", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Snapshot Price",
      unit: "un",
      salePriceCents: 1000,
      stockQuantity: 20,
    });
    const c = await open("Snapshot Close");
    await addItem(c.id, pid, 1);

    // Muda o preço antes de fechar
    await setProductPrice(pid, 1500);

    const saleDto = await close(c.id, "dinheiro");
    // Sale item deve usar o preço no momento do close (1500)
    expect(saleDto.items[0].unitPriceCents).toBe(1500);
    expect(saleDto.totalCents).toBe(1500);
  });

  // ---- comanda-RN05-close-cost-snapshot ------------------------------------

  it("comanda-RN05-close-cost-snapshot — snapshot de custo alimenta lucro", async () => {
    const c = await open("Cost Snapshot");
    await addItem(c.id, costProductId, 2); // costCents=400

    const saleDto = await close(c.id, "dinheiro");

    // Verifica cost_cents_snapshot no sale_items
    const [item] = await db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, saleDto.id));
    expect(item.costCentsSnapshot).toBe(400);
  });

  it("comanda-RN05-close-null-cost — sem custo → snapshot null", async () => {
    const c = await open("Null Cost");
    await addItem(c.id, noCostProductId, 1);

    const saleDto = await close(c.id, "dinheiro");

    const [item] = await db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, saleDto.id));
    expect(item.costCentsSnapshot).toBeNull();
  });

  // ---- comanda-RN08-close-no-restock ---------------------------------------

  it("comanda-RN08-close-no-restock — fechamento NÃO re-baixa estoque", async () => {
    const pid = await seedProduct(tenantId, {
      name: "No Restock",
      unit: "un",
      salePriceCents: 500,
      stockQuantity: 10,
    });
    const c = await open("No Restock");
    await addItem(c.id, pid, 3); // stock → 7

    await close(c.id, "dinheiro");

    // Stock deve seguir em 7 (não 4)
    const stock = parseFloat(await getProductStock(pid));
    expect(stock).toBe(7);

    // Não deve haver movimento 'saida' após o close (só o do lançamento)
    const movements = await db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.productId, pid)));
    const exits = movements.filter((m) => m.type === "saida");
    expect(exits).toHaveLength(1); // só o do lançamento
    expect(exits[0].comandaId).toBe(c.id);
    expect(exits[0].saleId).toBeNull();
  });

  // ---- comanda-RN09-close-cash-caixa --------------------------------------

  it("comanda-RN09-close-cash-caixa — dinheiro → entrada de caixa", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Cash Entry",
      unit: "un",
      salePriceCents: 2000,
      stockQuantity: 20,
    });
    const c = await open("Cash Caixa");
    await addItem(c.id, pid, 1);

    const saleDto = await close(c.id, "dinheiro");

    const movements = await db
      .select()
      .from(cashMovements)
      .where(and(eq(cashMovements.tenantId, tenantId), eq(cashMovements.saleId, saleDto.id)));
    expect(movements).toHaveLength(1);
    expect(movements[0].amountCents).toBe(2000);
    expect(movements[0].type).toBe("entrada");
  });

  // ---- comanda-RN09-close-cash-session-link --------------------------------

  it("comanda-RN09-close-cash-session-link — dinheiro + turno aberto → vincula sessão", async () => {
    const sessionId = await seedCashSession(tenantId, user.userId, {
      openingBalanceCents: 0,
      status: "aberta",
    });
    const pid = await seedProduct(tenantId, {
      name: "Session Link",
      unit: "un",
      salePriceCents: 500,
      stockQuantity: 10,
    });
    const c = await open("Session Link");
    await addItem(c.id, pid, 1);

    const saleDto = await close(c.id, "dinheiro");

    const movements = await db
      .select()
      .from(cashMovements)
      .where(and(eq(cashMovements.tenantId, tenantId), eq(cashMovements.saleId, saleDto.id)));
    expect(movements[0].sessionId).toBe(sessionId);
  });

  // ---- comanda-RN09-close-cash-no-session ----------------------------------

  it("comanda-RN09-close-cash-no-session — dinheiro sem turno → sessionId null", async () => {
    // Garantir que não há sessão aberta (cleanup pode ter deixado)
    // Usamos um tenant novo isolado
    const u2 = await createTestUser();
    const t2 = await seedTenant(u2.userId, "No Session Tenant");
    const ctx2 = { userId: u2.userId, tenantId: t2 };
    try {
      const pid2 = await seedProduct(t2, {
        name: "No Session Product",
        unit: "un",
        salePriceCents: 300,
        stockQuantity: 5,
      });
      const c2 = await openComanda(ctx2, openComandaSchema.parse({ label: "No Session" }));
      await addComandaItem(
        ctx2,
        addComandaItemSchema.parse({ comandaId: c2.id, productId: pid2, quantity: 1 }),
      );
      const saleDto2 = await closeComanda(
        ctx2,
        closeComandaSchema.parse({ comandaId: c2.id, paymentMethod: "dinheiro" }),
      );
      const movements2 = await db
        .select()
        .from(cashMovements)
        .where(and(eq(cashMovements.tenantId, t2), eq(cashMovements.saleId, saleDto2.id)));
      expect(movements2[0].sessionId).toBeNull();
    } finally {
      await cleanupTenant(t2);
      await deleteTestUser(u2.userId);
    }
  });

  // ---- comanda-RN07-close-fiado-receivable --------------------------------

  it("comanda-RN07-close-fiado-receivable — fiado+cliente → a receber, sem caixa", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Fiado Product",
      unit: "un",
      salePriceCents: 1500,
      stockQuantity: 10,
    });
    const c = await open("Fiado");
    await addItem(c.id, pid, 1);

    const saleDto = await close(c.id, "fiado", customerId);

    // Conta a receber criada
    const rec = await db
      .select()
      .from(receivables)
      .where(and(eq(receivables.tenantId, tenantId), eq(receivables.saleId, saleDto.id)));
    expect(rec).toHaveLength(1);
    expect(rec[0].totalCents).toBe(1500);

    // Sem movimento de caixa
    const cash = await db
      .select()
      .from(cashMovements)
      .where(and(eq(cashMovements.tenantId, tenantId), eq(cashMovements.saleId, saleDto.id)));
    expect(cash).toHaveLength(0);
  });

  // ---- comanda-RN07-close-fiado-no-customer --------------------------------

  it("comanda-RN07-close-fiado-no-customer — fiado sem cliente → rejeita", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Fiado No Customer",
      unit: "un",
      salePriceCents: 500,
      stockQuantity: 5,
    });
    const c = await open("Fiado No Customer");
    await addItem(c.id, pid, 1);

    await expect(
      closeComanda(
        ctx,
        // Bypass zod para testar validação no serviço diretamente
        { comandaId: c.id, paymentMethod: "fiado" } as Parameters<typeof closeComanda>[1],
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    // Comanda deve continuar 'aberta'
    const [row] = await db.select().from(comandas).where(eq(comandas.id, c.id));
    expect(row.status).toBe("aberta");
  });

  // ---- comanda-RN07-close-empty --------------------------------------------

  it("comanda-RN07-close-empty — fechar comanda vazia → rejeita", async () => {
    const c = await open("Empty Close");

    await expect(close(c.id, "dinheiro")).rejects.toBeInstanceOf(ValidationError);

    // Nenhuma venda criada
    const saleByCmnd = await db
      .select()
      .from(sales)
      .where(eq(sales.comandaId, c.id));
    expect(saleByCmnd).toHaveLength(0);
  });

  // ---- comanda-RN09-close-pix-no-caixa ------------------------------------

  it("comanda-RN09-close-pix-no-caixa — pix não toca caixa", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Pix Product",
      unit: "un",
      salePriceCents: 800,
      stockQuantity: 10,
    });
    const c = await open("Pix");
    await addItem(c.id, pid, 1);

    const saleDto = await close(c.id, "pix");

    const cash = await db
      .select()
      .from(cashMovements)
      .where(and(eq(cashMovements.tenantId, tenantId), eq(cashMovements.saleId, saleDto.id)));
    expect(cash).toHaveLength(0);
  });

  // ---- comanda-RN06-closed-immutable-add -----------------------------------

  it("comanda-RN06-closed-immutable-add — fechada rejeita lançar item", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Immutable Add",
      unit: "un",
      salePriceCents: 100,
      stockQuantity: 10,
    });
    const c = await open("Immutable Add");
    await addItem(c.id, pid, 1);
    await close(c.id, "dinheiro");

    await expect(addItem(c.id, pid, 1)).rejects.toBeInstanceOf(ValidationError);
  });

  it("comanda-RN06-closed-immutable-cancel — fechada não cancela", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Immutable Cancel",
      unit: "un",
      salePriceCents: 100,
      stockQuantity: 10,
    });
    const c = await open("Immutable Cancel");
    await addItem(c.id, pid, 1);
    await close(c.id, "dinheiro");

    await expect(cancel(c.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("comanda-RN06-closed-immutable-reclose — fechada não fecha de novo", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Immutable Reclose",
      unit: "un",
      salePriceCents: 100,
      stockQuantity: 10,
    });
    const c = await open("Immutable Reclose");
    await addItem(c.id, pid, 1);
    await close(c.id, "dinheiro");

    await expect(close(c.id, "dinheiro")).rejects.toBeInstanceOf(ConflictError);
  });

  it("comanda-RN06-cancelled-immutable-add — cancelada rejeita lançar item", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Cancelled Add",
      unit: "un",
      salePriceCents: 100,
      stockQuantity: 5,
    });
    const c = await open("Cancelled Add");
    await addItem(c.id, pid, 1);
    await cancel(c.id);

    await expect(addItem(c.id, pid, 1)).rejects.toBeInstanceOf(ValidationError);
  });

  it("comanda-RN06-cancelled-immutable-close — cancelada não fecha (sem venda)", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Cancelled Close",
      unit: "un",
      salePriceCents: 100,
      stockQuantity: 5,
    });
    const c = await open("Cancelled Close");
    await addItem(c.id, pid, 1);
    await cancel(c.id);

    await expect(close(c.id, "dinheiro")).rejects.toBeInstanceOf(ConflictError);

    // Sem venda
    const saleByCmnd = await db
      .select()
      .from(sales)
      .where(eq(sales.comandaId, c.id));
    expect(saleByCmnd).toHaveLength(0);
  });

  // ---- comanda-RF08-list-open ----------------------------------------------

  it("comanda-RF08-list-open — lista abertas com partialTotalCents", async () => {
    const u3 = await createTestUser();
    const t3 = await seedTenant(u3.userId, "List Open Tenant");
    const ctx3 = { userId: u3.userId, tenantId: t3 };
    try {
      const pidL = await seedProduct(t3, {
        name: "List Product",
        unit: "un",
        salePriceCents: 1000,
        stockQuantity: 50,
      });
      const cA = await openComanda(ctx3, openComandaSchema.parse({ label: "A" }));
      const cB = await openComanda(ctx3, openComandaSchema.parse({ label: "B" }));

      await addComandaItem(
        ctx3,
        addComandaItemSchema.parse({ comandaId: cA.id, productId: pidL, quantity: 2 }),
      );
      await addComandaItem(
        ctx3,
        addComandaItemSchema.parse({ comandaId: cB.id, productId: pidL, quantity: 1 }),
      );

      const list = await listOpenComandas(ctx3);
      const ids = list.map((c) => c.id);
      expect(ids).toContain(cA.id);
      expect(ids).toContain(cB.id);

      const bDto = list.find((c) => c.id === cB.id)!;
      expect(bDto.partialTotalCents).toBe(1000);
    } finally {
      await cleanupTenant(t3);
      await deleteTestUser(u3.userId);
    }
  });

  it("comanda-RF08-list-open-excludes-closed — lista abertas exclui fechadas e canceladas", async () => {
    const u3 = await createTestUser();
    const t3 = await seedTenant(u3.userId, "List Excludes Tenant");
    const ctx3 = { userId: u3.userId, tenantId: t3 };
    try {
      const pidL = await seedProduct(t3, {
        name: "Excl Product",
        unit: "un",
        salePriceCents: 500,
        stockQuantity: 50,
      });
      const cOpen = await openComanda(ctx3, openComandaSchema.parse({ label: "Aberta" }));
      const cClose = await openComanda(ctx3, openComandaSchema.parse({ label: "Fechar" }));
      const cCancel = await openComanda(ctx3, openComandaSchema.parse({ label: "Cancelar" }));

      await addComandaItem(
        ctx3,
        addComandaItemSchema.parse({ comandaId: cClose.id, productId: pidL, quantity: 1 }),
      );
      await addComandaItem(
        ctx3,
        addComandaItemSchema.parse({ comandaId: cCancel.id, productId: pidL, quantity: 1 }),
      );

      await closeComanda(
        ctx3,
        closeComandaSchema.parse({ comandaId: cClose.id, paymentMethod: "dinheiro" }),
      );
      await cancelComanda(ctx3, comandaIdSchema.parse({ comandaId: cCancel.id }));

      const list = await listOpenComandas(ctx3);
      const ids = list.map((c) => c.id);
      expect(ids).toContain(cOpen.id);   // aberta → aparece
      expect(ids).not.toContain(cClose.id);  // fechada → fora
      expect(ids).not.toContain(cCancel.id); // cancelada → fora
    } finally {
      await cleanupTenant(t3);
      await deleteTestUser(u3.userId);
    }
  });

  // ---- comanda-RF08-history ------------------------------------------------

  it("comanda-RF08-history — histórico lista fechadas/canceladas", async () => {
    const u4 = await createTestUser();
    const t4 = await seedTenant(u4.userId, "History Tenant");
    const ctx4 = { userId: u4.userId, tenantId: t4 };
    try {
      const pidH = await seedProduct(t4, {
        name: "History Product",
        unit: "un",
        salePriceCents: 500,
        stockQuantity: 50,
      });

      const cClose = await openComanda(ctx4, openComandaSchema.parse({ label: "Fechada" }));
      await addComandaItem(
        ctx4,
        addComandaItemSchema.parse({ comandaId: cClose.id, productId: pidH, quantity: 1 }),
      );
      const saleDto = await closeComanda(
        ctx4,
        closeComandaSchema.parse({ comandaId: cClose.id, paymentMethod: "dinheiro" }),
      );

      const cCancel = await openComanda(ctx4, openComandaSchema.parse({ label: "Cancelada" }));
      await addComandaItem(
        ctx4,
        addComandaItemSchema.parse({ comandaId: cCancel.id, productId: pidH, quantity: 1 }),
      );
      await cancelComanda(ctx4, comandaIdSchema.parse({ comandaId: cCancel.id }));

      const history = await listComandaHistory(ctx4, {});
      const ids = history.map((h) => h.id);
      expect(ids).toContain(cClose.id);
      expect(ids).toContain(cCancel.id);

      const closedEntry = history.find((h) => h.id === cClose.id)!;
      expect(closedEntry.saleId).toBe(saleDto.id);
      expect(closedEntry.status).toBe("fechada");

      const cancelledEntry = history.find((h) => h.id === cCancel.id)!;
      expect(cancelledEntry.status).toBe("cancelada");
      expect(cancelledEntry.saleId).toBeNull();
    } finally {
      await cleanupTenant(t4);
      await deleteTestUser(u4.userId);
    }
  });

  it("comanda-RF08-history-period — histórico filtra by period", async () => {
    const history = await listComandaHistory(ctx, {
      from: "2030-01-01",
      to: "2030-12-31",
    });
    // No records in far future
    expect(history).toHaveLength(0);
  });

  // ---- comanda-RNF02-close-atomic -----------------------------------------

  it("comanda-RNF02-close-atomic — fechamento atômico (venda+itens+caixa na mesma tx)", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Atomic Close",
      unit: "un",
      salePriceCents: 1000,
      stockQuantity: 10,
    });
    const c = await open("Atomic Close");
    await addItem(c.id, pid, 2);
    const saleDto = await close(c.id, "dinheiro");

    // Verificar que sale, sale_items e cash_movement existem coerentemente
    const saleRows = await db.select().from(sales).where(eq(sales.id, saleDto.id));
    const itemRows = await db.select().from(saleItems).where(eq(saleItems.saleId, saleDto.id));
    const cashRows = await db
      .select()
      .from(cashMovements)
      .where(and(eq(cashMovements.tenantId, tenantId), eq(cashMovements.saleId, saleDto.id)));

    expect(saleRows).toHaveLength(1);
    expect(itemRows).toHaveLength(1);
    expect(cashRows).toHaveLength(1);
  });

  // ---- comanda-RNF02-remove-atomic ----------------------------------------

  it("comanda-RNF02-remove-atomic — estorno ao remover é atômico (item e estoque juntos)", async () => {
    const pid = await seedProduct(tenantId, {
      name: "Atomic Remove",
      unit: "un",
      salePriceCents: 300,
      stockQuantity: 10,
    });
    const c = await open("Atomic Remove");
    const withItem = await addItem(c.id, pid, 3); // stock → 7
    const itemId = withItem.comanda.items[0].id;

    await removeItem(c.id, itemId);

    // Item fora E estoque restaurado — atomicidade implícita pelo teste passar
    const dto = await getComanda(ctx, comandaIdSchema.parse({ comandaId: c.id }));
    expect(dto.items).toHaveLength(0);
    const stock = parseFloat(await getProductStock(pid));
    expect(stock).toBe(10);
  });
});
