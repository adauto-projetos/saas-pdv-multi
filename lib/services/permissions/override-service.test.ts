// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import { overrideLog } from "@/db/schema";
import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedOperator,
  seedTenant,
  setUserPassword,
} from "@/db/__tests__/seed";

import { runWithOverride } from "./override-service";

const suite = HAS_DB ? describe : describe.skip;

suite("runWithOverride — autorizador + log (SF02)", () => {
  let owner = { userId: "", email: "" };
  let tenantId = "";
  let actor = { userId: "", email: "" };
  let mgr = { userId: "", email: "" };
  let plain = { userId: "", email: "" };
  let deadMgr = { userId: "", email: "" };

  let calls = 0;
  const run = async () => {
    calls += 1;
    return "DONE";
  };

  async function logCount(): Promise<number> {
    const rows = await db
      .select({ id: overrideLog.id })
      .from(overrideLog)
      .where(eq(overrideLog.tenantId, tenantId));
    return rows.length;
  }

  beforeAll(async () => {
    owner = await createTestUser();
    tenantId = await seedTenant(owner.userId, "Loja Override");
    await setUserPassword(owner.userId, "ownerpass");
    // actor: operador SEM 'comanda' (tem 'vendas') → precisa de override.
    actor = await seedOperator(tenantId, {
      permissions: ["vendas"],
      password: "actorpass",
    });
    mgr = await seedOperator(tenantId, {
      permissions: ["gerenciar_usuarios"],
      password: "mgrpass",
    });
    plain = await seedOperator(tenantId, {
      permissions: ["vendas"],
      password: "plainpass",
    });
    deadMgr = await seedOperator(tenantId, {
      permissions: ["gerenciar_usuarios"],
      password: "deadpass",
      isActive: false,
    });
  });

  beforeEach(() => {
    calls = 0;
  });

  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    for (const u of [owner, actor, mgr, plain, deadMgr]) {
      if (u.userId) await deleteTestUser(u.userId);
    }
  });

  const actorCtx = () => ({ userId: actor.userId, tenantId });

  it("sem credenciais → sinal overrideRequired e ação NÃO roda (RF01/RN01)", async () => {
    const before = await logCount();
    const result = await runWithOverride(actorCtx(), {
      actionCode: "cancelar_comanda",
      targetRef: "comanda-1",
      run,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.overrideRequired).toBe(true);
      expect(result.actionCode).toBe("cancelar_comanda");
    }
    expect(calls).toBe(0);
    expect(await logCount()).toBe(before);
  });

  it("owner + senha certa → roda 1x e grava override_log (RF06/RF07)", async () => {
    const before = await logCount();
    const result = await runWithOverride(actorCtx(), {
      actionCode: "cancelar_comanda",
      targetRef: "comanda-ok",
      credentials: { authorizerEmail: owner.email, password: "ownerpass" },
      run,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe("DONE");
    expect(calls).toBe(1);
    expect(await logCount()).toBe(before + 1);

    const [row] = await db
      .select()
      .from(overrideLog)
      .where(eq(overrideLog.targetRef, "comanda-ok"))
      .limit(1);
    expect(row.actorUserId).toBe(actor.userId);
    expect(row.authorizerUserId).toBe(owner.userId);
    expect(row.actionCode).toBe("cancelar_comanda");
  });

  it("autorizador com 'gerenciar_usuarios' também libera (RF04)", async () => {
    const result = await runWithOverride(actorCtx(), {
      actionCode: "fechar_caixa",
      credentials: { authorizerEmail: mgr.email, password: "mgrpass" },
      run,
    });
    expect(result.ok).toBe(true);
    expect(calls).toBe(1);
  });

  it("senha errada → erro, sem rodar, sem log (RF05/RF08/RN01)", async () => {
    const before = await logCount();
    const result = await runWithOverride(actorCtx(), {
      actionCode: "cancelar_comanda",
      targetRef: "comanda-bad",
      credentials: { authorizerEmail: owner.email, password: "WRONG" },
      run,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.overrideRequired).toBeUndefined();
    expect(calls).toBe(0);
    expect(await logCount()).toBe(before);
  });

  it("autorizador sem papel (só 'vendas') é rejeitado (RF04)", async () => {
    const result = await runWithOverride(actorCtx(), {
      actionCode: "cancelar_comanda",
      credentials: { authorizerEmail: plain.email, password: "plainpass" },
      run,
    });
    expect(result.ok).toBe(false);
    expect(calls).toBe(0);
  });

  it("autorizador = o próprio operador bloqueado é rejeitado (RN02)", async () => {
    const result = await runWithOverride(actorCtx(), {
      actionCode: "cancelar_comanda",
      credentials: { authorizerEmail: actor.email, password: "actorpass" },
      run,
    });
    expect(result.ok).toBe(false);
    expect(calls).toBe(0);
  });

  it("autorizador desativado é rejeitado (RF04)", async () => {
    const result = await runWithOverride(actorCtx(), {
      actionCode: "cancelar_comanda",
      credentials: { authorizerEmail: deadMgr.email, password: "deadpass" },
      run,
    });
    expect(result.ok).toBe(false);
    expect(calls).toBe(0);
  });

  it("operador COM o código roda direto, sem override nem log", async () => {
    const withPerm = await seedOperator(tenantId, { permissions: ["comanda"] });
    const before = await logCount();
    const result = await runWithOverride(
      { userId: withPerm.userId, tenantId },
      { actionCode: "cancelar_comanda", run },
    );
    expect(result.ok).toBe(true);
    expect(calls).toBe(1);
    // Não é exceção → não grava override_log.
    expect(await logCount()).toBe(before);
    await deleteTestUser(withPerm.userId);
  });
});
