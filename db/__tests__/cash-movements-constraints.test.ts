// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import { cashMovements } from "@/db/schema";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedTenant,
} from "./seed";

// Requires a real Postgres connection (DATABASE_URL). Skipped without it.
const suite = HAS_DB ? describe : describe.skip;

suite("cash_movements CHECK constraints (RN02/RN05)", () => {
  let userId = "";
  let tenantId = "";

  // beforeAll inlined into each test to keep setup minimal — mirrors
  // products-constraints.test.ts style.
  afterAll(async () => {
    if (tenantId) await cleanupTenant(tenantId);
    if (userId) await deleteTestUser(userId);
  });

  it("cash-sign-check — rejeita type='entrada' com amount_cents < 0 via CHECK", async () => {
    const user = await createTestUser();
    userId = user.userId;
    tenantId = await seedTenant(userId, "Loja Constraint Caixa");

    await expect(
      db.insert(cashMovements).values({
        tenantId,
        userId,
        amountCents: -100, // inválido: entrada deve ser > 0
        type: "entrada",
        origin: "manual",
      }),
    ).rejects.toThrow();
  });

  it("cash-sign-check — rejeita type='saida' com amount_cents > 0 via CHECK", async () => {
    await expect(
      db.insert(cashMovements).values({
        tenantId,
        userId,
        amountCents: 100, // inválido: saída deve ser < 0
        type: "saida",
        origin: "manual",
      }),
    ).rejects.toThrow();
  });
});
