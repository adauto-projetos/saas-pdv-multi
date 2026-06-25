// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Mock do cookie de impersonação para os testes de integração via withUserRls.
// As GUCs do gate SQL são testadas diretamente (asUser), sem depender do mock.
const { mockGetImpersonatedTenantId } = vi.hoisted(() => ({
  mockGetImpersonatedTenantId: vi.fn<() => Promise<string | null>>(),
}));
vi.mock("@/lib/auth/impersonation", () => ({
  getImpersonatedTenantId: mockGetImpersonatedTenantId,
}));

import { db } from "@/db";
import { withUserRls } from "@/db/rls";
import { products, users } from "@/db/schema";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedProduct,
  seedTenant,
} from "./seed";

const suite = HAS_DB ? describe : describe.skip;

/**
 * Executa uma query sob o papel app_user com as GUCs setadas manualmente — espelha
 * o que withUserRls faz, mas permite injetar `app.impersonate_tenant_id` direto
 * para testar o gate SQL (current_app_tenants / current_app_is_founder) sem cookie.
 */
async function asUser<T>(
  userId: string,
  impersonateTenantId: string | null,
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    if (impersonateTenantId) {
      await tx.execute(
        sql`select set_config('app.impersonate_tenant_id', ${impersonateTenantId}, true)`,
      );
    }
    await tx.execute(sql`set local role app_user`);
    return fn(tx);
  });
}

suite("impersonation RLS (SF03)", () => {
  let founder = { userId: "", email: "" };
  let nonFounder = { userId: "", email: "" };
  let ownerB = { userId: "", email: "" };
  let ownerC = { userId: "", email: "" };
  let tenantB = "";
  let tenantC = "";
  let productB = "";
  let productC = "";

  beforeAll(async () => {
    founder = await createTestUser();
    nonFounder = await createTestUser();
    ownerB = await createTestUser();
    ownerC = await createTestUser();
    await db.update(users).set({ isFounder: true }).where(eq(users.id, founder.userId));

    // founder e nonFounder NÃO são membros de nenhuma loja.
    tenantB = await seedTenant(ownerB.userId, "Loja B");
    tenantC = await seedTenant(ownerC.userId, "Loja C");
    productB = await seedProduct(tenantB, { name: "Produto B" });
    productC = await seedProduct(tenantC, { name: "Produto C" });
  });

  afterAll(async () => {
    vi.resetAllMocks();
    if (tenantB) await cleanupTenant(tenantB);
    if (tenantC) await cleanupTenant(tenantC);
    if (founder.userId) await deleteTestUser(founder.userId);
    if (nonFounder.userId) await deleteTestUser(nonFounder.userId);
    if (ownerB.userId) await deleteTestUser(ownerB.userId);
    if (ownerC.userId) await deleteTestUser(ownerC.userId);
  });

  it("T01 — founder impersonando lê produtos da loja-alvo (RF07)", async () => {
    const rows = await asUser(founder.userId, tenantB, (tx) =>
      tx.select().from(products).where(eq(products.id, productB)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Produto B");
  });

  it("T02 — founder impersonando ESCREVE na loja-alvo (acesso total)", async () => {
    const updated = await asUser(founder.userId, tenantB, (tx) =>
      tx
        .update(products)
        .set({ name: "Editado pelo admin" })
        .where(eq(products.id, productB))
        .returning(),
    );
    expect(updated).toHaveLength(1);

    const [still] = await db.select().from(products).where(eq(products.id, productB));
    expect(still.name).toBe("Editado pelo admin");
  });

  it("T03 — NÃO-founder com GUC forjada não acessa a loja (RN03, gate SQL)", async () => {
    const rows = await asUser(nonFounder.userId, tenantB, (tx) =>
      tx.select().from(products).where(eq(products.id, productB)),
    );
    expect(rows).toHaveLength(0);
  });

  it("T04 — founder impersonando loja B não enxerga loja C (isolamento)", async () => {
    const rows = await asUser(founder.userId, tenantB, (tx) =>
      tx.select().from(products).where(eq(products.id, productC)),
    );
    expect(rows).toHaveLength(0);
  });

  it("T05 — founder SEM impersonar não vê nenhuma loja (sem membership)", async () => {
    const rows = await asUser(founder.userId, null, (tx) =>
      tx.select().from(products),
    );
    expect(rows).toHaveLength(0);
  });

  it("T06 — withUserRls injeta impersonação quando cookie + founder (RF10)", async () => {
    mockGetImpersonatedTenantId.mockResolvedValue(tenantB);
    const rows = await withUserRls(founder.userId, (tx) =>
      tx.select().from(products).where(eq(products.id, productB)),
    );
    expect(rows).toHaveLength(1);
  });

  it("T07 — withUserRls ignora cookie de impersonação para não-founder (RN01)", async () => {
    mockGetImpersonatedTenantId.mockResolvedValue(tenantB);
    const rows = await withUserRls(nonFounder.userId, (tx) =>
      tx.select().from(products).where(eq(products.id, productB)),
    );
    expect(rows).toHaveLength(0);
  });
});
