// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedProduct,
  seedTenant,
} from "@/db/__tests__/seed";
import { products } from "@/db/schema";
import { withUserRls } from "@/db/rls";
import { adjustProductStock } from "@/lib/services/products/data";
import { insertMovement } from "@/lib/services/stock/data";
import type { AuthContext } from "@/types/product";

import {
  listLowStock,
  listMovements,
  recordAdjustment,
  recordEntry,
  setMinStock,
} from "./stock-service";

const suite = HAS_DB ? describe : describe.skip;

async function stockOf(productId: string): Promise<number> {
  const [row] = await db.select().from(products).where(eq(products.id, productId));
  return Number(row.stockQuantity);
}

suite("stock-service (integração)", () => {
  let user = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let tenantId = "";
  let entryId = "";
  let adjId = "";
  let lowId = "";
  let nullId = "";
  let minId = "";
  let negId = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja Estoque");
    ctx = { userId: user.userId, tenantId };
    entryId = await seedProduct(tenantId, { name: "Entrada", stockQuantity: 10 });
    adjId = await seedProduct(tenantId, { name: "Ajuste", stockQuantity: 8 });
    lowId = await seedProduct(tenantId, { name: "Baixo", stockQuantity: 2 });
    nullId = await seedProduct(tenantId, { name: "SemMin", stockQuantity: 0 });
    minId = await seedProduct(tenantId, { name: "Min", stockQuantity: 50 });
    negId = await seedProduct(tenantId, { name: "Neg", stockQuantity: 1 });
    await setMinStock(ctx, { productId: lowId, minStock: 5 });
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (user.userId) await deleteTestUser(user.userId);
  });

  it("T01/T06/T07/T15 — entrada sobe estoque e grava movimento (tipo/qtd/motivo/usuário)", async () => {
    const before = await stockOf(entryId);
    const movement = await recordEntry(ctx, {
      productId: entryId,
      quantity: 10,
      reason: "compra",
    });
    expect(movement.type).toBe("entrada");
    expect(movement.quantity).toBe(10);
    expect(movement.reason).toBe("compra");
    expect(movement.userId).toBe(ctx.userId);
    expect(await stockOf(entryId)).toBe(before + 10); // delta aplicado na mesma tx
  });

  it("T16 — entrada fracionária preserva numeric(10,3)", async () => {
    const movement = await recordEntry(ctx, { productId: entryId, quantity: 0.75 });
    expect(movement.quantity).toBe(0.75);
  });

  it("T03 — ajuste acerta o estoque pela contagem", async () => {
    const movement = await recordAdjustment(ctx, {
      productId: adjId,
      countedQuantity: 5,
    });
    expect(movement.type).toBe("ajuste");
    expect(movement.quantity).toBe(-3); // 5 − 8
    expect(await stockOf(adjId)).toBe(5);
  });

  it("T08/T09 — histórico do produto e filtro por tipo", async () => {
    const all = await listMovements(ctx, { productId: entryId });
    expect(all.length).toBeGreaterThanOrEqual(2);
    const entradas = await listMovements(ctx, {
      productId: entryId,
      type: "entrada",
    });
    expect(entradas.every((m) => m.type === "entrada")).toBe(true);
  });

  it("T10 — define o nível mínimo do produto", async () => {
    const product = await setMinStock(ctx, { productId: minId, minStock: 5 });
    expect(product.minStock).toBe(5);
  });

  it("T11 — lista estoque baixo (≤ mínimo)", async () => {
    const low = await listLowStock(ctx);
    expect(low.some((p) => p.id === lowId)).toBe(true);
  });

  it("T12 — produto sem mínimo não aparece no estoque baixo", async () => {
    const low = await listLowStock(ctx);
    expect(low.some((p) => p.id === nullId)).toBe(false);
  });

  it("T13 — estoque pode ficar negativo", async () => {
    await withUserRls(ctx.userId, async (tx) => {
      await insertMovement(tx, tenantId, {
        productId: negId,
        type: "saida",
        quantity: -5,
        userId: ctx.userId,
      });
      await adjustProductStock(tx, tenantId, negId, -5);
    });
    expect(await stockOf(negId)).toBeLessThan(0);
  });
});
