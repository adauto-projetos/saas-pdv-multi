// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { products, tenants } from "@/db/schema";

import { HAS_DB } from "./seed";

// Requer Supabase real (DATABASE_URL). Sem creds, o bloco é pulado.
const suite = HAS_DB ? describe : describe.skip;

suite("products CHECK constraints (RN02)", () => {
  let tenantId = "";

  afterAll(async () => {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it("T22 — rejeita sale_price_cents negativo via CHECK", async () => {
    const [tenant] = await db
      .insert(tenants)
      .values({ name: "Loja Constraint" })
      .returning({ id: tenants.id });
    tenantId = tenant.id;

    await expect(
      db.insert(products).values({
        tenantId,
        name: "Produto inválido",
        unit: "un",
        salePriceCents: -5,
        stockQuantity: "0",
      }),
    ).rejects.toThrow();
  });
});
