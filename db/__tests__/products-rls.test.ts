// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { withUserRls } from "@/db/rls";
import { products } from "@/db/schema";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_AUTH,
  seedTenant,
} from "./seed";

// Requer Supabase real + service-role (cria usuários auth de verdade). T25/T26
// PRECISAM rodar sob um usuário autenticado — o client service-role bypassa a RLS.
const suite = HAS_AUTH ? describe : describe.skip;

suite("products RLS isolation (RN05)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let tenantA = "";
  let tenantB = "";
  let productB = "";

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A");
    tenantB = await seedTenant(userB.userId, "Loja B");
    const [p] = await db
      .insert(products)
      .values({
        tenantId: tenantB,
        name: "Produto B",
        unit: "un",
        salePriceCents: 500,
        stockQuantity: "0",
        // Referência de foto da loja B (feature 0016F) — RN03: A não pode lê-la.
        imageKey: `${tenantB}/secret.webp`,
        imageUrl: "https://cdn.example/secret.webp",
      })
      .returning();
    productB = p.id;
  });

  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    if (userA.userId) await deleteTestUser(userA.userId);
    if (userB.userId) await deleteTestUser(userB.userId);
  });

  it("T25 — usuário A não lê produto da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx.select().from(products).where(eq(products.id, productB)),
    );
    expect(rows).toHaveLength(0);
  });

  it("T16/RN03 — usuário A não lê a referência de foto (imageKey) da loja B", async () => {
    const rows = await withUserRls(userA.userId, (tx) =>
      tx
        .select({ imageKey: products.imageKey })
        .from(products)
        .where(eq(products.id, productB)),
    );
    // RLS bloqueia a linha inteira: A nunca enxerga a chave do arquivo de B.
    expect(rows).toHaveLength(0);
  });

  it("T26 — usuário A não escreve produto da loja B", async () => {
    const updated = await withUserRls(userA.userId, (tx) =>
      tx
        .update(products)
        .set({ name: "hacked" })
        .where(eq(products.id, productB))
        .returning(),
    );
    expect(updated).toHaveLength(0);

    // Confirma que a row de B segue intacta (consulta direta, fora da RLS).
    const [still] = await db
      .select()
      .from(products)
      .where(eq(products.id, productB));
    expect(still.name).toBe("Produto B");
  });
});
