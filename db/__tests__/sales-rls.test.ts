// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withUserRls } from "@/db/rls";
import { sales } from "@/db/schema";
import { finalizeSale } from "@/lib/services/sales/sale-service";
import { finalizeSaleSchema } from "@/lib/validation/sale";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedProduct,
  seedTenant,
} from "./seed";

const suite = HAS_DB ? describe : describe.skip;

suite("sales RLS isolation (RN01)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let tenantA = "";
  let tenantB = "";
  let saleBId = "";

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A");
    tenantB = await seedTenant(userB.userId, "Loja B");

    const productB = await seedProduct(tenantB, {
      name: "Produto B",
      salePriceCents: 500,
      stockQuantity: 10,
    });
    const sale = await finalizeSale(
      { userId: userB.userId, tenantId: tenantB },
      finalizeSaleSchema.parse({
        items: [{ productId: productB, quantity: 1 }],
        paymentMethod: "dinheiro",
      }),
    );
    saleBId = sale.id;
  });

  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    if (userA.userId) await deleteTestUser(userA.userId);
    if (userB.userId) await deleteTestUser(userB.userId);
  });

  it("T14 — usuário A não enxerga a venda da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(sales).where(eq(sales.id, saleBId)),
    );
    expect(rows).toHaveLength(0);
  });
});
