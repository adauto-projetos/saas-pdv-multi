// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedCustomer,
  seedProduct,
  seedTenant,
} from "@/db/__tests__/seed";
import {
  cashMovements,
  products,
  receivables,
  sales,
  stockMovements,
} from "@/db/schema";
import { ValidationError } from "@/lib/services/errors";
import type { FinalizeSaleInput } from "@/lib/validation/sale";
import { finalizeSaleSchema } from "@/lib/validation/sale";
import type { AuthContext } from "@/types/product";

import { finalizeSale, listTodaySales } from "./sale-service";

const suite = HAS_DB ? describe : describe.skip;

suite("sale-service (integração)", () => {
  let user = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let tenantId = "";
  let unId = "";
  let kgId = "";
  let lowId = "";
  let customerId = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja Caixa");
    ctx = { userId: user.userId, tenantId };
    customerId = await seedCustomer(tenantId, "Cliente Fiado");
    unId = await seedProduct(tenantId, {
      name: "Refri Lata",
      unit: "un",
      salePriceCents: 1000,
      stockQuantity: 10,
    });
    kgId = await seedProduct(tenantId, {
      name: "Banana",
      unit: "kg",
      salePriceCents: 590,
      stockQuantity: 20,
    });
    lowId = await seedProduct(tenantId, {
      name: "Item Raro",
      unit: "un",
      salePriceCents: 100,
      stockQuantity: 1,
    });
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (user.userId) await deleteTestUser(user.userId);
  });

  const finalize = (
    items: { productId: string; quantity: number }[],
    paymentMethod = "dinheiro",
  ) => finalizeSale(ctx, finalizeSaleSchema.parse({ items, paymentMethod }));

  it("T04/T05 — subtotal por peso (round) e total somado", async () => {
    const sale = await finalize([
      { productId: kgId, quantity: 0.75 },
      { productId: unId, quantity: 2 },
    ]);
    const kgItem = sale.items.find((i) => i.productId === kgId);
    expect(kgItem?.subtotalCents).toBe(443); // round(590 * 0.75)
    expect(sale.totalCents).toBe(2443); // 443 + 2000
  });

  it("T06/T07 — grava a venda e baixa o estoque", async () => {
    const [before] = await db
      .select()
      .from(products)
      .where(eq(products.id, unId));
    const beforeStock = Number(before.stockQuantity);

    const sale = await finalize([{ productId: unId, quantity: 3 }]);
    const saved = await db.select().from(sales).where(eq(sales.id, sale.id));
    expect(saved).toHaveLength(1);

    const [after] = await db
      .select()
      .from(products)
      .where(eq(products.id, unId));
    expect(Number(after.stockQuantity)).toBe(beforeStock - 3);
  });

  it("T08 — preço do item é snapshot do produto (servidor)", async () => {
    const sale = await finalize([{ productId: unId, quantity: 1 }]);
    expect(sale.items[0].unitPriceCents).toBe(1000);
  });

  it("T05 (0003F) — venda registra movimentação de saída com sale_id", async () => {
    const sale = await finalize([{ productId: unId, quantity: 2 }]);
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.saleId, sale.id));
    expect(movements.length).toBeGreaterThan(0);
    expect(movements[0].type).toBe("saida");
    expect(Number(movements[0].quantity)).toBeLessThan(0);
  });

  it("T11 — estoque pode ficar negativo (não bloqueia)", async () => {
    const sale = await finalize([{ productId: lowId, quantity: 5 }]); // estoque 1
    expect(sale.totalCents).toBe(500);
    const [after] = await db
      .select()
      .from(products)
      .where(eq(products.id, lowId));
    expect(Number(after.stockQuantity)).toBeLessThan(0);
  });

  it("T13/T16 — venda atribuída ao usuário e tenant do contexto", async () => {
    const sale = await finalize([{ productId: unId, quantity: 1 }]);
    expect(sale.userId).toBe(ctx.userId);
    expect(sale.tenantId).toBe(tenantId);
  });

  it("T15 — lista as vendas do dia com itens populados", async () => {
    await finalize([{ productId: unId, quantity: 1 }]);
    const list = await listTodaySales(ctx);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("totalCents");
    expect(list[0].items.length).toBeGreaterThan(0);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    expect(
      list.every((s) => new Date(s.createdAt).getTime() >= startOfDay.getTime()),
    ).toBe(true);
  });

  it("T09 — serviço rejeita carrinho vazio (RN03)", async () => {
    await expect(
      finalizeSale(ctx, { items: [], paymentMethod: "dinheiro" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("T10 — serviço rejeita quantidade ≤ 0 (RN04)", async () => {
    await expect(
      finalizeSale(ctx, {
        items: [{ productId: unId, quantity: -1 }],
        paymentMethod: "dinheiro",
      } as FinalizeSaleInput),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("0004F — venda fiado gera conta a receber (origem 'venda') com cliente", async () => {
    const sale = await finalizeSale(
      ctx,
      finalizeSaleSchema.parse({
        items: [{ productId: unId, quantity: 1 }],
        paymentMethod: "fiado",
        customerId,
      }),
    );
    expect(sale.customerId).toBe(customerId);
    const [rcv] = await db
      .select()
      .from(receivables)
      .where(eq(receivables.saleId, sale.id));
    expect(rcv).toBeDefined();
    expect(rcv.origin).toBe("venda");
    expect(rcv.customerId).toBe(customerId);
    expect(rcv.totalCents).toBe(sale.totalCents);
    // Fiado NÃO entra no caixa.
    const cash = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.saleId, sale.id));
    expect(cash.length).toBe(0);
  });

  it("0004F — venda dinheiro gera entrada de caixa (origem 'venda', +total)", async () => {
    const sale = await finalize([{ productId: unId, quantity: 2 }]); // dinheiro
    const [mv] = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.saleId, sale.id));
    expect(mv).toBeDefined();
    expect(mv.type).toBe("entrada");
    expect(mv.origin).toBe("venda");
    expect(mv.amountCents).toBe(sale.totalCents);
  });

  it("0004F — venda pix NÃO gera movimentação de caixa", async () => {
    const sale = await finalize([{ productId: unId, quantity: 1 }], "pix");
    const cash = await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.saleId, sale.id));
    expect(cash.length).toBe(0);
  });
});
