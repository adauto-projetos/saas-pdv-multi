// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_AUTH,
  seedTenant,
} from "@/db/__tests__/seed";
import { ConflictError } from "@/lib/services/errors";
import {
  applyCostChangeSchema,
  createProductSchema,
  updateProductSchema,
} from "@/lib/validation/product";
import type { AuthContext } from "@/types/product";

import * as service from "./product-service";

// Integração: exige Supabase real + service-role. Pulado sem creds.
const suite = HAS_AUTH ? describe : describe.skip;

suite("product-service (integração)", () => {
  let user = { userId: "", email: "" };
  let user2 = { userId: "", email: "" };
  let ctx = {} as AuthContext;
  let ctx2 = {} as AuthContext;
  let tenantId = "";
  let tenant2Id = "";

  beforeAll(async () => {
    user = await createTestUser();
    tenantId = await seedTenant(user.userId, "Loja A", "30.00");
    ctx = { userId: user.userId, tenantId };

    user2 = await createTestUser();
    tenant2Id = await seedTenant(user2.userId, "Loja B");
    ctx2 = { userId: user2.userId, tenantId: tenant2Id };
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (tenant2Id) await cleanupTenant(tenant2Id);
    if (user.userId) await deleteTestUser(user.userId);
    if (user2.userId) await deleteTestUser(user2.userId);
  });

  const create = (data: Record<string, unknown>) =>
    service.createProduct(ctx, createProductSchema.parse(data));

  it("T07 — cria sem custo, com preço direto (costCents null, manual)", async () => {
    const p = await create({
      name: "Sem custo",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 500,
    });
    expect(p.costCents).toBeNull();
    expect(p.salePriceCents).toBe(500);
    expect(p.priceIsManual).toBe(true);
  });

  it("T23 — markup não obrigatório (caminho só preço)", async () => {
    const p = await create({
      name: "Price only",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 900,
    });
    expect(p.salePriceCents).toBe(900);
  });

  it("T27 — tenantId vem do contexto de auth, não do input", async () => {
    const p = await create({
      name: "Tenant check",
      unit: "un",
      stockQuantity: 0,
      costCents: 1000,
      markupPercent: 30,
    });
    expect(p.tenantId).toBe(tenantId);
  });

  it("T11/T12 — applyCostChange aceito (custo+preço) e cancelado (só custo)", async () => {
    const p = await create({
      name: "Cost change",
      unit: "un",
      stockQuantity: 0,
      costCents: 1000,
      markupPercent: 30,
    });
    expect(p.salePriceCents).toBe(1300);

    const accepted = await service.applyCostChange(
      ctx,
      applyCostChangeSchema.parse({
        id: p.id,
        newCostCents: 2000,
        acceptSuggestion: true,
      }),
    );
    expect(accepted.costCents).toBe(2000);
    expect(accepted.salePriceCents).toBe(2600);
    expect(accepted.priceIsManual).toBe(false);

    const canceled = await service.applyCostChange(
      ctx,
      applyCostChangeSchema.parse({
        id: p.id,
        newCostCents: 3000,
        acceptSuggestion: false,
      }),
    );
    expect(canceled.costCents).toBe(3000);
    expect(canceled.salePriceCents).toBe(2600); // preço inalterado ao cancelar
  });

  it("T15 — lista produtos incluindo estoque (read-only)", async () => {
    const list = await service.listProducts(ctx);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("stockQuantity");
  });

  it("T16 — edita campos de produto existente", async () => {
    const p = await create({
      name: "Antigo",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 100,
    });
    const updated = await service.updateProduct(
      ctx,
      updateProductSchema.parse({ id: p.id, name: "Novo" }),
    );
    expect(updated.name).toBe("Novo");
  });

  it("T18 — código de barras duplicado na mesma loja => ConflictError", async () => {
    await create({
      name: "Dup 1",
      barcode: "DUP-123",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 100,
    });
    await expect(
      create({
        name: "Dup 2",
        barcode: "DUP-123",
        unit: "un",
        stockQuantity: 0,
        salePriceCents: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("T19 — mesmo código em lojas diferentes => ambos persistem", async () => {
    const a = await create({
      name: "Bar A",
      barcode: "SHARED-1",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 100,
    });
    const b = await service.createProduct(
      ctx2,
      createProductSchema.parse({
        name: "Bar B",
        barcode: "SHARED-1",
        unit: "un",
        stockQuantity: 0,
        salePriceCents: 100,
      }),
    );
    expect(a.barcode).toBe("SHARED-1");
    expect(b.barcode).toBe("SHARED-1");
  });
});
