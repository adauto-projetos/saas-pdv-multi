// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { saleItems, sales } from "@/db/schema";
import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedTenant,
} from "@/db/__tests__/seed";
import { ConflictError, ValidationError } from "@/lib/services/errors";
import * as productService from "@/lib/services/products/product-service";
import { finalizeSale } from "@/lib/services/sales/sale-service";
import {
  CATEGORY_COLOR_SLUGS,
  createProductCategorySchema,
  createProductSchema,
  updateProductCategorySchema,
} from "@/lib/validation/product";
import { finalizeSaleSchema } from "@/lib/validation/sale";
import type { AuthContext } from "@/types/product";

import * as service from "./category-service";

const suite = HAS_DB ? describe : describe.skip;

const CONFLICT_MESSAGE = "Já existe uma categoria com esse nome";
const RESERVED_MESSAGE = '"Sem categoria" é um nome reservado';

suite("category-service (integração)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let userC = { userId: "", email: "" };
  let ctxA = {} as AuthContext;
  let ctxB = {} as AuthContext;
  let ctxC = {} as AuthContext;
  let tenantAId = "";
  let tenantBId = "";
  let tenantCId = "";

  beforeAll(async () => {
    userA = await createTestUser();
    tenantAId = await seedTenant(userA.userId, "Loja Categorias A");
    ctxA = { userId: userA.userId, tenantId: tenantAId };

    userB = await createTestUser();
    tenantBId = await seedTenant(userB.userId, "Loja Categorias B");
    ctxB = { userId: userB.userId, tenantId: tenantBId };

    // Tenant reservado ao T21 (ciclo da paleta exige contagem a partir de zero).
    userC = await createTestUser();
    tenantCId = await seedTenant(userC.userId, "Loja Categorias C");
    ctxC = { userId: userC.userId, tenantId: tenantCId };
  });

  afterAll(async () => {
    if (tenantAId) await cleanupTenant(tenantAId);
    if (tenantBId) await cleanupTenant(tenantBId);
    if (tenantCId) await cleanupTenant(tenantCId);
    if (userA.userId) await deleteTestUser(userA.userId);
    if (userB.userId) await deleteTestUser(userB.userId);
    if (userC.userId) await deleteTestUser(userC.userId);
  });

  const create = (ctx: AuthContext, data: Record<string, unknown>) =>
    service.createProductCategory(ctx, createProductCategorySchema.parse(data));

  const rename = (ctx: AuthContext, data: Record<string, unknown>) =>
    service.updateProductCategory(ctx, updateProductCategorySchema.parse(data));

  const createProduct = (ctx: AuthContext, data: Record<string, unknown>) =>
    productService.createProduct(ctx, createProductSchema.parse(data));

  it("T01/RF01 — cria categoria com nome e cor; position no fim da lista", async () => {
    const first = await create(ctxA, { name: "Vinhos", color: "roxo" });
    expect(first.name).toBe("Vinhos");
    expect(first.color).toBe("roxo");
    expect(first.position).toBe(0);

    const second = await create(ctxA, { name: "Sucos", color: "lima" });
    expect(second.position).toBe(1); // entra no fim da ordem manual (RF06)
  });

  it("T02/RF02 — renomeia categoria e a lista reflete o novo nome", async () => {
    const list = await service.listProductCategories(ctxA);
    const sucos = list.find((c) => c.name === "Sucos");
    expect(sucos).toBeDefined();

    const renamed = await rename(ctxA, { id: sucos!.id, name: "Cervejas" });
    expect(renamed.name).toBe("Cervejas");

    const after = await service.listProductCategories(ctxA);
    expect(after.some((c) => c.name === "Cervejas")).toBe(true);
    expect(after.some((c) => c.name === "Sucos")).toBe(false);
  });

  it("T11/RN01 — nome duplicado (case/acento) rejeitado com ConflictError", async () => {
    await create(ctxA, { name: "Bebidas", color: "azul" });

    // Criação: variação de caixa e de acento.
    await expect(create(ctxA, { name: "bebidas" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    await expect(create(ctxA, { name: "BÉBIDAS" })).rejects.toThrow(
      CONFLICT_MESSAGE,
    );

    // Renomeio de outra categoria para o mesmo nome normalizado.
    const list = await service.listProductCategories(ctxA);
    const cervejas = list.find((c) => c.name === "Cervejas");
    await expect(
      rename(ctxA, { id: cervejas!.id, name: "bébidas" }),
    ).rejects.toThrow(CONFLICT_MESSAGE);
  });

  it("T12/RN01 — mesmo nome em outro tenant é aceito (unicidade por tenant)", async () => {
    const created = await create(ctxB, { name: "Bebidas", color: "verde" });
    expect(created.name).toBe("Bebidas");
  });

  it("T22/RN06 — criar/renomear para o nome reservado é rejeitado", async () => {
    await expect(create(ctxA, { name: "sem categoria" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    // Acento normalizado: "SEM CATEGORÍA" → "sem categoria".
    await expect(create(ctxA, { name: "SEM CATEGORÍA" })).rejects.toThrow(
      RESERVED_MESSAGE,
    );

    const list = await service.listProductCategories(ctxA);
    const vinhos = list.find((c) => c.name === "Vinhos");
    await expect(
      rename(ctxA, { id: vinhos!.id, name: "Sem Categoria" }),
    ).rejects.toThrow(RESERVED_MESSAGE);
  });

  it("T07/RF06 — reorder da lista completa grava positions 0..n-1", async () => {
    const before = await service.listProductCategories(ctxA);
    expect(before.length).toBeGreaterThanOrEqual(3);

    const reversedIds = [...before].reverse().map((c) => c.id);
    const after = await service.reorderProductCategories(ctxA, reversedIds);

    expect(after.map((c) => c.id)).toEqual(reversedIds);
    expect(after.map((c) => c.position)).toEqual(after.map((_, i) => i));
  });

  it("T07/RF06 — reorder com ids incompletos ou estranhos → ValidationError", async () => {
    const list = await service.listProductCategories(ctxA);
    const ids = list.map((c) => c.id);

    // Lista incompleta (faltando uma categoria do tenant).
    await expect(
      service.reorderProductCategories(ctxA, ids.slice(1)),
    ).rejects.toBeInstanceOf(ValidationError);

    // Id de outro tenant no lugar de um do conjunto.
    const [foreign] = await service.listProductCategories(ctxB);
    await expect(
      service.reorderProductCategories(ctxA, [foreign.id, ...ids.slice(1)]),
    ).rejects.toThrow("Lista de categorias inválida");

    // Id repetido (mesmo tamanho, conjunto divergente).
    await expect(
      service.reorderProductCategories(ctxA, [ids[0], ids[0], ...ids.slice(2)]),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("T20/RN04 — 'Sem categoria' nunca aparece na lista; produto sem categoria tem category null", async () => {
    const list = await service.listProductCategories(ctxA);
    expect(
      list.every((c) => c.name.trim().toLowerCase() !== "sem categoria"),
    ).toBe(true);

    const product = await createProduct(ctxA, {
      name: "Produto sem categoria",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 500,
    });
    expect(product.category).toBeNull();

    const fetched = await productService.getProduct(ctxA, product.id);
    expect(fetched.category).toBeNull();
  });

  it("T03/RF03 — conta produtos vinculados e delete os move para Sem categoria", async () => {
    const category = await create(ctxA, { name: "Temporária", color: "ambar" });
    const p1 = await createProduct(ctxA, {
      name: "Produto vinculado 1",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 100,
      categoryId: category.id,
    });
    const p2 = await createProduct(ctxA, {
      name: "Produto vinculado 2",
      unit: "un",
      stockQuantity: 0,
      salePriceCents: 200,
      categoryId: category.id,
    });
    expect(p1.category?.id).toBe(category.id);

    const counted = await service.countProductsInCategory(ctxA, category.id);
    expect(counted).toEqual({ count: 2 });

    const deleted = await service.deleteProductCategory(ctxA, category.id);
    expect(deleted).toEqual({ id: category.id, movedCount: 2 });

    // FK ON DELETE SET NULL: os 2 produtos viram "Sem categoria" (null).
    const after1 = await productService.getProduct(ctxA, p1.id);
    const after2 = await productService.getProduct(ctxA, p2.id);
    expect(after1.category).toBeNull();
    expect(after2.category).toBeNull();

    const list = await service.listProductCategories(ctxA);
    expect(list.some((c) => c.id === category.id)).toBe(false);
  });

  it("T21/RN05 — cor automática cicla a paleta; 11ª repete a 1ª", async () => {
    const colors: string[] = [];
    for (let i = 0; i < 11; i++) {
      const category = await create(ctxC, { name: `Categoria ${i + 1}` });
      colors.push(category.color);
    }
    const len = CATEGORY_COLOR_SLUGS.length;
    for (let i = 0; i < 11; i++) {
      expect(colors[i]).toBe(CATEGORY_COLOR_SLUGS[i % len]);
    }
    // A paleta tem 10 cores: a 11ª repete a 1ª (cor duplicada aceita sem erro).
    expect(colors[10]).toBe(colors[0]);
  });

  it("T23/RN07 — renomear/excluir categoria não altera venda lançada", async () => {
    const category = await create(ctxA, { name: "Churrasco", color: "vermelho" });
    const product = await createProduct(ctxA, {
      name: "Espetinho",
      unit: "un",
      stockQuantity: 10,
      salePriceCents: 1500,
      categoryId: category.id,
    });

    const sale = await finalizeSale(
      ctxA,
      finalizeSaleSchema.parse({
        items: [{ productId: product.id, quantity: 2 }],
        paymentMethod: "pix",
      }),
    );
    expect(sale.totalCents).toBe(3000);

    const itemsBefore = await db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, sale.id));
    expect(itemsBefore).toHaveLength(1);
    expect(itemsBefore[0].nameSnapshot).toBe("Espetinho");

    // Rename + delete da categoria do produto vendido.
    await rename(ctxA, { id: category.id, name: "Churrasco Premium" });
    await service.deleteProductCategory(ctxA, category.id);

    // Venda e itens intactos: snapshot e totais idênticos antes/depois.
    const [saleAfter] = await db
      .select()
      .from(sales)
      .where(eq(sales.id, sale.id));
    expect(saleAfter.totalCents).toBe(3000);

    const itemsAfter = await db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, sale.id));
    expect(itemsAfter).toEqual(itemsBefore);

    // O produto (não a venda) foi movido para Sem categoria (RN04).
    const productAfter = await productService.getProduct(ctxA, product.id);
    expect(productAfter.category).toBeNull();
  });
});
