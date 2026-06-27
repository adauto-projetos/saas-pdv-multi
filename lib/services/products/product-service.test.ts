// @vitest-environment node
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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

// Mocka o R2 (sem rede). image-service real: sharp processa de verdade; só o I/O
// externo de storage é falso. `put` resolve; `del` é rastreado por teste.
vi.mock("@/lib/services/storage/r2-client", () => ({
  put: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
  publicUrl: vi.fn((key: string) => `https://cdn.example/${key}`),
}));

import * as r2 from "@/lib/services/storage/r2-client";

import * as service from "./product-service";

/** PNG real (magic bytes válidos) para o pipeline sharp aceitar. */
async function realPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 200,
      height: 200,
      channels: 3,
      background: { r: 1, g: 2, b: 3 },
    },
  })
    .png()
    .toBuffer();
}

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

  // -------------------------------------------------------------------------
  // Fotos de produto (feature 0016F) — R2 mockado, sharp real.
  // -------------------------------------------------------------------------

  it("T13/RN01 — produto criado sem foto fica com imageKey/imageUrl null", async () => {
    const p = await create({
      name: "Sem foto",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 500,
    });
    expect(p.imageKey).toBeNull();
    expect(p.imageUrl).toBeNull();
  });

  it("T01/T15/RN03 — upload persiste chave na pasta da loja <slug>-<tenantId> + URL", async () => {
    vi.clearAllMocks();
    const p = await create({
      name: "Com foto",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 500,
    });
    const updated = await service.uploadProductImage(ctx, p.id, await realPng());
    expect(updated.imageKey).not.toBeNull();
    // Pasta legível + tenantId (loja semeada como "Loja A"). O tenantId no prefixo
    // garante unicidade entre lojas de mesmo nome (RN03).
    const folder = updated.imageKey!.split("/")[0];
    expect(folder).toBe(`loja-a-${tenantId}`);
    expect(updated.imageUrl).toBe(`https://cdn.example/${updated.imageKey}`);
    expect(r2.put).toHaveBeenCalledOnce();
  });

  it("T02/T14/RF06/RN02 — segundo upload sobrescreve e deleta a chave antiga", async () => {
    vi.clearAllMocks();
    const p = await create({
      name: "Troca foto",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 500,
    });
    const first = await service.uploadProductImage(ctx, p.id, await realPng());
    const second = await service.uploadProductImage(ctx, p.id, await realPng());
    expect(second.imageKey).not.toBe(first.imageKey);
    // Chave única (RN02): a antiga foi removida do R2 (RF06).
    expect(r2.del).toHaveBeenCalledWith(first.imageKey);
  });

  it("T08/T12/RF07/RF09 — deleteProduct remove a linha e o arquivo (tolera falha)", async () => {
    vi.clearAllMocks();
    const p = await create({
      name: "Excluir com foto",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 500,
    });
    const withImg = await service.uploadProductImage(ctx, p.id, await realPng());
    vi.mocked(r2.del).mockRejectedValueOnce(new Error("R2 down"));
    await expect(service.deleteProduct(ctx, p.id)).resolves.toBeUndefined();
    // del foi chamado com a chave do produto, apesar de ter falhado (RF09).
    expect(r2.del).toHaveBeenCalledWith(withImg.imageKey);
    // Produto realmente sumiu.
    await expect(service.getProduct(ctx, p.id)).rejects.toThrow();
  });

  it("deleteProduct sem foto não chama r2.del", async () => {
    vi.clearAllMocks();
    const p = await create({
      name: "Excluir sem foto",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 500,
    });
    await service.deleteProduct(ctx, p.id);
    expect(r2.del).not.toHaveBeenCalled();
  });

  it("removeProductImage zera as colunas e deleta o arquivo", async () => {
    vi.clearAllMocks();
    const p = await create({
      name: "Remover foto",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 500,
    });
    const withImg = await service.uploadProductImage(ctx, p.id, await realPng());
    const cleared = await service.removeProductImage(ctx, p.id);
    expect(cleared.imageKey).toBeNull();
    expect(cleared.imageUrl).toBeNull();
    expect(r2.del).toHaveBeenCalledWith(withImg.imageKey);
  });

  it("T09/RF08 — create/update não são afetados pelo R2 (desacoplado)", async () => {
    vi.clearAllMocks();
    const p = await create({
      name: "Desacoplado",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 500,
    });
    const updated = await service.updateProduct(
      ctx,
      updateProductSchema.parse({ id: p.id, name: "Desacoplado 2" }),
    );
    expect(updated.name).toBe("Desacoplado 2");
    // Nenhuma operação de storage foi disparada por create/update.
    expect(r2.put).not.toHaveBeenCalled();
    expect(r2.del).not.toHaveBeenCalled();
  });
});
