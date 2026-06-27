// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedOperator,
  seedTenant,
} from "@/db/__tests__/seed";
import { UnauthorizedError } from "@/lib/services/errors";

import {
  hasPermission,
  isOwner,
  requireAnyPermission,
  requirePermission,
} from "./permissions";

const suite = HAS_DB ? describe : describe.skip;

suite("requirePermission / hasPermission (RF09)", () => {
  let owner = { userId: "", email: "" };
  let tenantId = "";
  let opWithVendas = { userId: "", email: "" };

  beforeAll(async () => {
    owner = await createTestUser();
    tenantId = await seedTenant(owner.userId, "Loja Guard");
    opWithVendas = await seedOperator(tenantId, { permissions: ["vendas"] });
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (owner.userId) await deleteTestUser(owner.userId);
    if (opWithVendas.userId) await deleteTestUser(opWithVendas.userId);
  });

  it("owner passa em qualquer permissão (RF09)", async () => {
    const ctx = { userId: owner.userId, tenantId };
    expect(await hasPermission(ctx, "loja")).toBe(true);
    expect(await hasPermission(ctx, "gerenciar_usuarios")).toBe(true);
    await expect(requirePermission(ctx, "financeiro")).resolves.toBeUndefined();
    expect(await isOwner(ctx)).toBe(true);
  });

  it("operador com 'vendas' passa em vendas e falha em loja", async () => {
    const ctx = { userId: opWithVendas.userId, tenantId };
    expect(await hasPermission(ctx, "vendas")).toBe(true);
    expect(await hasPermission(ctx, "loja")).toBe(false);
    expect(await isOwner(ctx)).toBe(false);
  });

  it("requirePermission lança UnauthorizedError sem o código (RF09)", async () => {
    const ctx = { userId: opWithVendas.userId, tenantId };
    await expect(requirePermission(ctx, "loja")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("requireAnyPermission passa se possui ao menos um dos códigos", async () => {
    const ctx = { userId: opWithVendas.userId, tenantId };
    // Tem 'vendas' (não 'produtos') → passa.
    await expect(
      requireAnyPermission(ctx, ["produtos", "vendas"]),
    ).resolves.toBeUndefined();
    // Não tem nenhum dos dois → lança.
    await expect(
      requireAnyPermission(ctx, ["produtos", "loja"]),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
