// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { tenantMembers, userPermissions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedOperator,
  seedTenant,
  withGlobalSettingsLock,
} from "@/db/__tests__/seed";
import { setMaxOperators } from "@/lib/services/platform/settings-repository";
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/services/errors";
import { getUserTenantId } from "@/lib/services/tenants/onboarding";

import {
  createOperator,
  deactivateOperator,
  listOperators,
  reactivateOperator,
  updateOperatorPermissions,
} from "./operator-service";

const suite = HAS_DB ? describe : describe.skip;

let counter = 0;
function uniqueEmail(): string {
  counter += 1;
  return `op-svc-${Date.now()}-${counter}@example.com`;
}

suite("operator-service — hierarquia + anti-escalonamento (RF12/RF13/RN05)", () => {
  let owner = { userId: "", email: "" };
  let tenantId = "";
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser();
    tenantId = await seedTenant(owner.userId, "Loja Operadores");
  });

  afterEach(async () => {
    // Limpa operadores criados durante cada teste (users são globais).
    for (const id of createdUserIds.splice(0)) {
      await db.delete(tenantMembers).where(eq(tenantMembers.userId, id));
      await db.delete(userPermissions).where(eq(userPermissions.userId, id));
      await db.delete(users).where(eq(users.id, id));
    }
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (owner.userId) await deleteTestUser(owner.userId);
  });

  const ownerCtx = () => ({ userId: owner.userId, tenantId });

  it("owner cria operador com permissões (RF03/RF05)", async () => {
    const dto = await createOperator(ownerCtx(), {
      name: "Maria",
      email: uniqueEmail(),
      password: "secret1",
      permissions: ["vendas", "comanda"],
    });
    createdUserIds.push(dto.userId);

    expect(dto.role).toBe("operator");
    expect(dto.isActive).toBe(true);
    expect(dto.isOwner).toBe(false);
    expect(new Set(dto.permissions)).toEqual(new Set(["vendas", "comanda"]));

    // granted_by deve ser o criador (owner).
    const rows = await db
      .select({ grantedBy: userPermissions.grantedBy })
      .from(userPermissions)
      .where(eq(userPermissions.userId, dto.userId));
    expect(rows.every((r) => r.grantedBy === owner.userId)).toBe(true);
  });

  it("rejeita criação sem permissões (RN02)", async () => {
    await expect(
      createOperator(ownerCtx(), {
        name: "Sem Perm",
        email: uniqueEmail(),
        password: "secret1",
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejeita email duplicado (RF04)", async () => {
    const email = uniqueEmail();
    const dto = await createOperator(ownerCtx(), {
      name: "Primeiro",
      email,
      password: "secret1",
      permissions: ["vendas"],
    });
    createdUserIds.push(dto.userId);

    await expect(
      createOperator(ownerCtx(), {
        name: "Segundo",
        email,
        password: "secret1",
        permissions: ["vendas"],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("anti-escalonamento: concedente só concede o que tem (RF13)", async () => {
    const granter = await seedOperator(tenantId, { permissions: ["vendas"] });
    createdUserIds.push(granter.userId);
    const granterCtx = { userId: granter.userId, tenantId };

    // Não pode conceder 'loja' (não possui).
    await expect(
      createOperator(granterCtx, {
        name: "Alvo",
        email: uniqueEmail(),
        password: "secret1",
        permissions: ["loja"],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    // Pode conceder 'vendas' (possui).
    const ok = await createOperator(granterCtx, {
      name: "Alvo2",
      email: uniqueEmail(),
      password: "secret1",
      permissions: ["vendas"],
    });
    createdUserIds.push(ok.userId);
    expect(ok.permissions).toEqual(["vendas"]);
  });

  it("owner é intocável: não pode editar permissões do owner (RF12)", async () => {
    await expect(
      updateOperatorPermissions(ownerCtx(), {
        userId: owner.userId,
        permissions: ["vendas"],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("operador não pode editar as próprias permissões (RN05)", async () => {
    const op = await seedOperator(tenantId, {
      permissions: ["gerenciar_usuarios", "vendas"],
    });
    createdUserIds.push(op.userId);
    await expect(
      updateOperatorPermissions(
        { userId: op.userId, tenantId },
        { userId: op.userId, permissions: ["vendas"] },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("operador não pode desativar a si mesmo (RN05)", async () => {
    const op = await seedOperator(tenantId, { permissions: ["gerenciar_usuarios"] });
    createdUserIds.push(op.userId);
    await expect(
      deactivateOperator({ userId: op.userId, tenantId }, op.userId),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("desativar barra a sessão; reativar a restaura (RF14/RF15/RF16)", async () => {
    const op = await seedOperator(tenantId, { permissions: ["vendas"] });
    createdUserIds.push(op.userId);

    // Sessão resolve enquanto ativo.
    expect(await getUserTenantId(op.userId)).toBe(tenantId);

    await deactivateOperator(ownerCtx(), op.userId);
    // RF15: operador desativado é tratado como sem loja (sessão rejeitada).
    expect(await getUserTenantId(op.userId)).toBeNull();
    // Permissões preservadas (não apagadas).
    const stillThere = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, op.userId));
    expect(stillThere.length).toBeGreaterThan(0);

    await reactivateOperator(ownerCtx(), op.userId);
    expect(await getUserTenantId(op.userId)).toBe(tenantId);
  });

  it("listOperators inclui owner (com flag) e operadores", async () => {
    const op = await seedOperator(tenantId, { permissions: ["vendas"] });
    createdUserIds.push(op.userId);
    const list = await listOperators(ownerCtx());
    const ownerRow = list.find((o) => o.userId === owner.userId);
    expect(ownerRow?.isOwner).toBe(true);
    expect(list.some((o) => o.userId === op.userId && !o.isOwner)).toBe(true);
  });
});

suite("operator-service — limite de operadores (SF03: RF03/RF04/RN02/RN03/RN04)", () => {
  let owner = { userId: "", email: "" };
  let tenantId = "";
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    owner = await createTestUser();
    tenantId = await seedTenant(owner.userId, "Loja Limite");
  });

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await db.delete(tenantMembers).where(eq(tenantMembers.userId, id));
      await db.delete(userPermissions).where(eq(userPermissions.userId, id));
      await db.delete(users).where(eq(users.id, id));
    }
  });

  afterAll(async () => {
    await setMaxOperators(3, null);
    if (tenantId) await cleanupTenant(tenantId);
    if (owner.userId) await deleteTestUser(owner.userId);
  });

  const ownerCtx = () => ({ userId: owner.userId, tenantId });

  async function create(permissions: ("vendas" | "comanda")[] = ["vendas"]) {
    const dto = await createOperator(ownerCtx(), {
      name: "Op",
      email: uniqueEmail(),
      password: "secret1",
      permissions,
    });
    createdUserIds.push(dto.userId);
    return dto;
  }

  it("bloqueia o cadastro ao atingir o teto; owner não conta (RF03/RF04/RN02)", async () => {
    await withGlobalSettingsLock(async () => {
      // max=1: owner NÃO conta — senão o 1º cadastro já bloquearia.
      await setMaxOperators(1, null);
      await create(); // count 0 → 1 ok
      await expect(create()).rejects.toBeInstanceOf(ConflictError); // count 1 ≥ 1 bloqueia
      await setMaxOperators(3, null);
    });
  });

  it("desativar libera um slot (RN03)", async () => {
    await withGlobalSettingsLock(async () => {
      await setMaxOperators(1, null);
      const first = await create();
      await expect(create()).rejects.toBeInstanceOf(ConflictError);
      // Desativar libera o slot → novo cadastro passa.
      await deactivateOperator(ownerCtx(), first.userId);
      const second = await create();
      expect(second.isActive).toBe(true);
      await setMaxOperators(3, null);
    });
  });

  it("baixar o teto não desativa ninguém (grandfather, RN04)", async () => {
    await withGlobalSettingsLock(async () => {
      await setMaxOperators(2, null);
      await create();
      await create();
      // Baixa o teto para 1 (abaixo da contagem atual de 2).
      await setMaxOperators(1, null);
      const list = await listOperators(ownerCtx());
      const activeOps = list.filter((o) => !o.isOwner && o.isActive);
      // Os 2 existentes continuam ativos (nenhuma desativação retroativa).
      expect(activeOps).toHaveLength(2);
      // Mas um novo cadastro é barrado.
      await expect(create()).rejects.toBeInstanceOf(ConflictError);
      await setMaxOperators(3, null);
    });
  });
});
