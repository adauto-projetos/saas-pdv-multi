// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedProduct,
  seedTenant,
} from "@/db/__tests__/seed";
import { products } from "@/db/schema";
import { db } from "@/db";
import { registerCashMovement } from "@/lib/services/finance/cash-service";
import { createPayable } from "@/lib/services/finance/payable-service";
import { finalizeSale } from "@/lib/services/sales/sale-service";
import { finalizeSaleSchema } from "@/lib/validation/sale";
import type { AuthContext } from "@/types/product";

import { getProfitByPeriod } from "./profit-service";

const suite = HAS_DB ? describe : describe.skip;

suite("profit-service (integração)", () => {
  let user = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let tenantId = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja Lucro");
    ctx = { userId: user.userId, tenantId };
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (user.userId) await deleteTestUser(user.userId);
  });

  const sell = (
    productId: string,
    quantity: number,
    paymentMethod = "dinheiro",
  ) =>
    finalizeSale(
      ctx,
      finalizeSaleSchema.parse({
        items: [{ productId, quantity }],
        paymentMethod,
      }),
    );

  it("profit-RF02-summary / profit-RNF01-shape: faturamento/custo/lucro/margem%", async () => {
    // Tenant dedicado para isolar a agregação deste teste.
    const u = await createTestUser();
    const t = await seedTenant(u.userId, "Loja RF02");
    const c = { userId: u.userId, tenantId: t } as AuthContext;
    const p = await seedProduct(t, {
      name: "P RF02",
      salePriceCents: 1000,
      stockQuantity: 100,
      costCents: 400,
    });
    await finalizeSale(
      c,
      finalizeSaleSchema.parse({
        items: [{ productId: p, quantity: 2 }],
        paymentMethod: "dinheiro",
      }),
    );
    const profit = await getProfitByPeriod(c, {});
    expect(profit.revenueCents).toBe(2000);
    expect(profit.costCents).toBe(800);
    expect(profit.profitCents).toBe(1200);
    expect(profit.marginPercent).toBe(60); // round(1200/2000*100)
    expect(profit.salesCount).toBeGreaterThanOrEqual(1);

    await cleanupTenant(t);
    await deleteTestUser(u.userId);
  });

  it("profit-RF02-default-today: sem filtro agrega só hoje", async () => {
    const productId = await seedProduct(tenantId, {
      name: "Hoje",
      salePriceCents: 500,
      stockQuantity: 100,
      costCents: 100,
    });
    await sell(productId, 1);
    const profit = await getProfitByPeriod(ctx, {});
    expect(profit.revenueCents).toBeGreaterThanOrEqual(500);
  });

  it("profit-RF03-items-without-cost / RN04-null-counts-zero: item sem custo sinalizado", async () => {
    const u = await createTestUser();
    const t = await seedTenant(u.userId, "Loja RF03");
    const c = { userId: u.userId, tenantId: t } as AuthContext;
    const p = await seedProduct(t, {
      name: "Sem Custo",
      salePriceCents: 1000,
      stockQuantity: 100,
      costCents: null,
    });
    await finalizeSale(
      c,
      finalizeSaleSchema.parse({
        items: [{ productId: p, quantity: 1 }],
        paymentMethod: "dinheiro",
      }),
    );
    const profit = await getProfitByPeriod(c, {});
    expect(profit.itemsWithoutCost).toBeGreaterThanOrEqual(1);
    expect(profit.revenueCents).toBe(1000); // venda nunca omitida
    expect(profit.costCents).toBe(0); // sem custo conta 0

    await cleanupTenant(t);
    await deleteTestUser(u.userId);
  });

  it("profit-RN02-negative: lucro pode ser negativo (prejuízo)", async () => {
    const u = await createTestUser();
    const t = await seedTenant(u.userId, "Loja Neg");
    const c = { userId: u.userId, tenantId: t } as AuthContext;
    const p = await seedProduct(t, {
      name: "Prejuizo",
      salePriceCents: 500,
      stockQuantity: 100,
      costCents: 800,
    });
    await finalizeSale(
      c,
      finalizeSaleSchema.parse({
        items: [{ productId: p, quantity: 1 }],
        paymentMethod: "dinheiro",
      }),
    );
    const profit = await getProfitByPeriod(c, {});
    expect(profit.profitCents).toBe(-300); // 500 − 800

    await cleanupTenant(t);
    await deleteTestUser(u.userId);
  });

  it("profit-RN02-cents: valores inteiros em centavos (kg)", async () => {
    const u = await createTestUser();
    const t = await seedTenant(u.userId, "Loja Cents");
    const c = { userId: u.userId, tenantId: t } as AuthContext;
    const p = await seedProduct(t, {
      name: "Banana",
      unit: "kg",
      salePriceCents: 590,
      stockQuantity: 100,
      costCents: 200,
    });
    await finalizeSale(
      c,
      finalizeSaleSchema.parse({
        items: [{ productId: p, quantity: 0.75 }],
        paymentMethod: "dinheiro",
      }),
    );
    const profit = await getProfitByPeriod(c, {});
    expect(Number.isInteger(profit.revenueCents)).toBe(true);
    expect(Number.isInteger(profit.costCents)).toBe(true);

    await cleanupTenant(t);
    await deleteTestUser(u.userId);
  });

  it("profit-RN03-snapshot-immutable: editar custo NÃO muda lucro passado", async () => {
    const u = await createTestUser();
    const t = await seedTenant(u.userId, "Loja Imut");
    const c = { userId: u.userId, tenantId: t } as AuthContext;
    const p = await seedProduct(t, {
      name: "Imutavel",
      salePriceCents: 1000,
      stockQuantity: 100,
      costCents: 400,
    });
    await finalizeSale(
      c,
      finalizeSaleSchema.parse({
        items: [{ productId: p, quantity: 2 }],
        paymentMethod: "dinheiro",
      }),
    );
    const before = await getProfitByPeriod(c, {});
    expect(before.costCents).toBe(800);
    // Edita o custo do produto depois da venda.
    await db
      .update(products)
      .set({ costCents: 900 })
      .where(eq(products.id, p));
    const after = await getProfitByPeriod(c, {});
    expect(after.costCents).toBe(800); // snapshot congelado

    await cleanupTenant(t);
    await deleteTestUser(u.userId);
  });

  it("profit-RN05-not-sangria: lucro NÃO desconta sangria", async () => {
    const u = await createTestUser();
    const t = await seedTenant(u.userId, "Loja Sangria");
    const c = { userId: u.userId, tenantId: t } as AuthContext;
    const p = await seedProduct(t, {
      name: "Prod Sangria",
      salePriceCents: 1000,
      stockQuantity: 100,
      costCents: 400,
    });
    await finalizeSale(
      c,
      finalizeSaleSchema.parse({
        items: [{ productId: p, quantity: 2 }],
        paymentMethod: "dinheiro",
      }),
    );
    await registerCashMovement(c, {
      amountCents: 1000,
      description: "Sangria",
      type: "saida",
    });
    const profit = await getProfitByPeriod(c, {});
    expect(profit.profitCents).toBe(1200); // sangria ignorada

    await cleanupTenant(t);
    await deleteTestUser(u.userId);
  });

  it("profit-RN05-not-payable: lucro NÃO desconta conta a pagar", async () => {
    const u = await createTestUser();
    const t = await seedTenant(u.userId, "Loja Payable");
    const c = { userId: u.userId, tenantId: t } as AuthContext;
    const p = await seedProduct(t, {
      name: "Prod Payable",
      salePriceCents: 1200,
      stockQuantity: 100,
      costCents: 0,
    });
    await finalizeSale(
      c,
      finalizeSaleSchema.parse({
        items: [{ productId: p, quantity: 1 }],
        paymentMethod: "dinheiro",
      }),
    );
    await createPayable(c, {
      description: "Aluguel",
      totalCents: 5000,
      category: "fixo",
    });
    const profit = await getProfitByPeriod(c, {});
    expect(profit.profitCents).toBe(1200); // payable não afeta

    await cleanupTenant(t);
    await deleteTestUser(u.userId);
  });

  it("profit-RNF01-zero-revenue: margem%=0 quando faturamento 0", async () => {
    const u = await createTestUser();
    const t = await seedTenant(u.userId, "Loja Zero");
    const c = { userId: u.userId, tenantId: t } as AuthContext;
    const profit = await getProfitByPeriod(c, {});
    expect(profit.revenueCents).toBe(0);
    expect(profit.profitCents).toBe(0);
    expect(profit.marginPercent).toBe(0);
    expect(profit.salesCount).toBe(0);

    await cleanupTenant(t);
    await deleteTestUser(u.userId);
  });
});
