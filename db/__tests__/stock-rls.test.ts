// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withUserRls } from "@/db/rls";
import { stockMovements } from "@/db/schema";
import { recordEntry } from "@/lib/services/stock/stock-service";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedProduct,
  seedTenant,
} from "./seed";

const suite = HAS_DB ? describe : describe.skip;

suite("stock_movements RLS isolation (RN01)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let tenantA = "";
  let tenantB = "";
  let movementBId = "";

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A");
    tenantB = await seedTenant(userB.userId, "Loja B");
    const productB = await seedProduct(tenantB, {
      name: "Produto B",
      stockQuantity: 10,
    });
    const movement = await recordEntry(
      { userId: userB.userId, tenantId: tenantB },
      { productId: productB, quantity: 5, reason: "compra" },
    );
    movementBId = movement.id;
  });

  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    if (userA.userId) await deleteTestUser(userA.userId);
    if (userB.userId) await deleteTestUser(userB.userId);
  });

  it("T14 — usuário A não enxerga a movimentação da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(stockMovements).where(eq(stockMovements.id, movementBId)),
    );
    expect(rows).toHaveLength(0);
  });
});
