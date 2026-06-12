// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedTenant,
} from "@/db/__tests__/seed";
import type { AuthContext } from "@/types/product";

import { createCustomer, listCustomers } from "./customer-service";

const suite = HAS_DB ? describe : describe.skip;

suite("customer-service (integração)", () => {
  let user = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let tenantId = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja Clientes");
    ctx = { userId: user.userId, tenantId };
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (user.userId) await deleteTestUser(user.userId);
  });

  it("RF06 — cria cliente e lista", async () => {
    const created = await createCustomer(ctx, {
      name: "João Silva",
      phone: "11999990000",
    });
    expect(created.name).toBe("João Silva");
    expect(created.phone).toBe("11999990000");

    await createCustomer(ctx, { name: "Maria Souza" });
    const all = await listCustomers(ctx, {});
    expect(all.length).toBe(2);
    // Ordem alfabética por nome.
    expect(all[0].name).toBe("João Silva");
  });

  it("RF06 — busca filtra por nome (ilike)", async () => {
    const found = await listCustomers(ctx, { search: "maria" });
    expect(found.length).toBe(1);
    expect(found[0].name).toBe("Maria Souza");
  });
});
