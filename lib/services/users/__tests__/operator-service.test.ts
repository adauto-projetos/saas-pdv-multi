// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HAS_DB,
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  seedOperator,
  seedTenant,
} from "@/db/__tests__/seed";
import * as permissionData from "@/lib/services/permissions/permission-data";
import type { PermissionCode } from "@/lib/validation/usuarios";
import type { AuthContext } from "@/types/product";

/**
 * Contract tests do batch de permissões (0020F/RF02). Mata o N+1 de listOperators:
 * 1 select de membros + 1 batch de permissões = ≤2 queries, constante no nº de
 * operadores. DB-touching — pulado sem DATABASE_URL.
 */
const suite = HAS_DB ? describe : describe.skip;

suite("operator-service — batch de permissões (RF02)", () => {
  const created: { userId: string; tenantId: string }[] = [];

  async function makeTenant() {
    const { userId } = await createTestUser();
    const tenantId = await seedTenant(userId, "Loja Operadores");
    created.push({ userId, tenantId });
    return { ownerId: userId, tenantId };
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const { tenantId, userId } of created.reverse()) {
      await cleanupTenant(tenantId);
      await deleteTestUser(userId);
    }
    created.length = 0;
  });

  it("ops-RF02-empty — selectPermissionsByUserIds([]) retorna Map vazio sem ir ao banco", async () => {
    const { tenantId } = await makeTenant();
    // Sem userIds: short-circuit. Não deve tocar no banco — comprovamos pelo retorno
    // (Map vazio) e pela ausência de erro mesmo com tenantId qualquer.
    const result = await permissionData.selectPermissionsByUserIds(tenantId, []);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it("ops-RF02-map — batch mapeia permissões distintas por userId", async () => {
    const { tenantId } = await makeTenant();
    const permsA: PermissionCode[] = ["produtos"];
    const permsB: PermissionCode[] = ["gerenciar_usuarios", "financeiro"];
    const a = await seedOperator(tenantId, { permissions: permsA });
    const b = await seedOperator(tenantId, { permissions: permsB });

    const map = await permissionData.selectPermissionsByUserIds(tenantId, [
      a.userId,
      b.userId,
    ]);
    expect([...(map.get(a.userId) ?? [])].sort()).toEqual([...permsA].sort());
    expect([...(map.get(b.userId) ?? [])].sort()).toEqual([...permsB].sort());
  });

  it("ops-RF02-batch — listOperators usa ≤2 queries (1 select + 1 batch), constante no nº de operadores", async () => {
    const { ownerId, tenantId } = await makeTenant();
    // 10 operadores com permissões (valor do spec ops-RF02-batch): se houvesse N+1,
    // seriam 10 queries extras — o spy abaixo prova que o batch roda UMA vez só.
    for (let i = 0; i < 10; i++) {
      await seedOperator(tenantId, { permissions: ["produtos"] });
    }

    const batchSpy = vi.spyOn(permissionData, "selectPermissionsByUserIds");

    const { listOperators } = await import("../operator-service");
    const ctx: AuthContext = { userId: ownerId, tenantId };
    const result = await listOperators(ctx);

    // Estrutura: 1 selectOperators + 1 selectPermissionsByUserIds = ≤2 queries.
    // O batch é chamado UMA vez independentemente do nº de operadores (sem N+1).
    expect(batchSpy).toHaveBeenCalledTimes(1);
    // 10 operadores + owner.
    expect(result.length).toBe(11);
  });

  it("ops-RF02-parity — permissões por operador iguais ao select por-usuário (sem regressão)", async () => {
    const { ownerId, tenantId } = await makeTenant();
    const permsA: PermissionCode[] = ["produtos", "financeiro"];
    const permsB: PermissionCode[] = ["gerenciar_usuarios"];
    const a = await seedOperator(tenantId, { permissions: permsA, name: "Op A" });
    const b = await seedOperator(tenantId, { permissions: permsB, name: "Op B" });

    const { listOperators } = await import("../operator-service");
    const ctx: AuthContext = { userId: ownerId, tenantId };
    const dtos = await listOperators(ctx);

    const byUser = new Map(dtos.map((d) => [d.userId, d]));

    // Owner → [] (tudo implícito).
    expect(byUser.get(ownerId)?.permissions).toEqual([]);
    expect(byUser.get(ownerId)?.isOwner).toBe(true);

    // Cada operador → exatamente o que selectPermissionCodes retorna (parity N+1).
    for (const op of [{ ...a, perms: permsA }, { ...b, perms: permsB }]) {
      const viaSingle = await permissionData.selectPermissionCodes(
        tenantId,
        op.userId,
      );
      const viaBatch = byUser.get(op.userId)?.permissions ?? [];
      expect([...viaBatch].sort()).toEqual([...viaSingle].sort());
      expect([...viaBatch].sort()).toEqual([...op.perms].sort());
    }
  });
});
