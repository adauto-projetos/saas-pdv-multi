// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedProduct,
  seedTenant,
} from "@/db/__tests__/seed";
import type { AuthContext } from "@/types/product";

import { lookupProductByBarcode, searchProducts } from "./lookup";

const suite = HAS_DB ? describe : describe.skip;

suite("sales lookup (integração)", () => {
  let user = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let tenantId = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja Lookup");
    ctx = { userId: user.userId, tenantId };
    await seedProduct(tenantId, {
      name: "Coca-Cola 350ml",
      barcode: "BARCODE-1",
      salePriceCents: 500,
    });
    await seedProduct(tenantId, {
      name: "Coca-Cola 2L",
      barcode: "BARCODE-2",
      salePriceCents: 900,
    });
    await seedProduct(tenantId, {
      name: "Água 500ml",
      barcode: "BARCODE-3",
      salePriceCents: 200,
    });
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (user.userId) await deleteTestUser(user.userId);
  });

  it("T01 — lookup por código retorna o produto", async () => {
    const product = await lookupProductByBarcode(ctx, "BARCODE-1");
    expect(product?.name).toBe("Coca-Cola 350ml");
    expect(product?.salePriceCents).toBe(500);
  });

  it("T02 — código inexistente retorna null", async () => {
    expect(await lookupProductByBarcode(ctx, "NAO-EXISTE")).toBeNull();
  });

  it("T03 — busca por nome retorna lista filtrada", async () => {
    const list = await searchProducts(ctx, "coca");
    expect(list).toHaveLength(2);
    expect(list.every((p) => p.name.toLowerCase().includes("coca"))).toBe(true);
  });
});
