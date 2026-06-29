// @vitest-environment node

/**
 * tenant-isolation-regression.test.ts
 *
 * Parametrized regression suite for RF03/RN03 (feature 0020F).
 *
 * Contract: for every business table that carries a `tenant_id` column, a user
 * authenticated as tenant A MUST NOT be able to read or write a row that belongs
 * to tenant B — even when they know the exact row id. The enforcement layer is
 * PostgreSQL Row Level Security (RLS) applied to the `app_user` role via
 * `withUserRls()`.
 *
 * How a missing RLS policy becomes a red test:
 *   If a table with `tenant_id` has no RLS policy (or RLS is disabled), the
 *   cross-tenant SELECT returns the row → `toHaveLength(0)` fails. The UPDATE
 *   likewise succeeds and the "row still intact" assertion detects the mutation.
 *   Both failures are red; CI blocks the merge. This is the contract for RN03.
 *
 * Tables under test (19 — tenants root excluded; platform_settings excluded —
 * global singleton, no tenant_id):
 *   products, customers, sales, sale_items, comandas, comanda_items,
 *   kitchen_order_seqs, print_logs, stock_movements, cash_sessions,
 *   cash_movements, receivables, receivable_payments, payables,
 *   payable_payments, subscription_log, override_log, user_permissions,
 *   tenant_members
 *
 * (The plan prose said 18; the live schema currently exposes 19 tables with a
 * `tenant_id` column, and `iso-RN03-allpresent` derives the expected count from
 * the schema at runtime — so that test, not this comment, is authoritative.)
 */

import { and, eq, SQL } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { withUserRls } from "@/db/rls";
import {
  cashMovements,
  cashSessions,
  comandaItems,
  comandas,
  customers,
  kitchenOrderSeqs,
  overrideLog,
  payablePayments,
  payables,
  printLogs,
  products,
  receivablePayments,
  receivables,
  saleItems,
  sales,
  stockMovements,
  subscriptionLog,
  tenantMembers,
  userPermissions,
} from "@/db/schema";
import type { PermissionCode } from "@/lib/validation/usuarios";

import {
  cleanupTenant,
  createTestUser,
  deleteTestUser,
  HAS_DB,
  seedCashMovement,
  seedCashSession,
  seedComanda,
  seedComandaItem,
  seedCustomer,
  seedOperator,
  seedPayable,
  seedProduct,
  seedReceivable,
  seedTenant,
} from "./seed";

// ---------------------------------------------------------------------------
// Suite guard — skip without DATABASE_URL (no Postgres Docker).
// ---------------------------------------------------------------------------
const suite = HAS_DB ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Table config types
// ---------------------------------------------------------------------------

/**
 * Describes one table entry in the parametrized suite.
 *
 * `readWhere`  — WHERE clause used by userA to attempt a cross-tenant SELECT.
 * `writeWhere` — WHERE clause used by userA to attempt a cross-tenant UPDATE.
 * `mutatePatch` — the SET payload for the UPDATE (must be a safe mutable col).
 * `originalValue` — expected value of the mutated column BEFORE the update, so
 *                   the post-update owner re-read can verify the row is intact.
 * `originalKey`  — column name in the returning row to check (string key).
 */
interface TableConfig {
  /** Human-readable name (matches SQL table name). */
  name: string;
  /** Drizzle table reference. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: PgTable<any>;
  /** WHERE clause for the cross-tenant read attempt. */
  readWhere: SQL;
  /** WHERE clause for the cross-tenant write attempt. */
  writeWhere: SQL;
  /** Patch object for the UPDATE. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutatePatch: Record<string, any>;
  /** Key in the selected row to verify "unchanged after attempted write". */
  originalKey: string;
  /** Expected value of `originalKey` before any mutation. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalValue: any;
}

// ---------------------------------------------------------------------------
// Test state — populated in beforeAll
// ---------------------------------------------------------------------------

let userA = { userId: "", email: "" };
let userB = { userId: "", email: "" };
let tenantA = "";
let tenantB = "";

/** Config array — one entry per business table. Populated in beforeAll. */
const tableConfigs: TableConfig[] = [];

// ---------------------------------------------------------------------------
// Helper: seed a sale (no dedicated seed helper exists yet).
// ---------------------------------------------------------------------------
async function seedSale(
  tenantId: string,
  userId: string,
): Promise<string> {
  const [row] = await db
    .insert(sales)
    .values({
      tenantId,
      userId,
      totalCents: 100,
      paymentMethod: "dinheiro",
    })
    .returning({ id: sales.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Helper: seed a subscription_log row.
// ---------------------------------------------------------------------------
async function seedSubscriptionLog(
  tenantId: string,
): Promise<string> {
  const [row] = await db
    .insert(subscriptionLog)
    .values({
      tenantId,
      action: "trial_started",
    })
    .returning({ id: subscriptionLog.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Helper: seed an override_log row.
// ---------------------------------------------------------------------------
async function seedOverrideLog(
  tenantId: string,
): Promise<string> {
  const [row] = await db
    .insert(overrideLog)
    .values({
      tenantId,
      actionCode: "fechar_caixa",
    })
    .returning({ id: overrideLog.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Helper: seed a print_log row.
// ---------------------------------------------------------------------------
async function seedPrintLog(
  tenantId: string,
  userId: string,
  triggerId: string,
): Promise<string> {
  const [row] = await db
    .insert(printLogs)
    .values({
      tenantId,
      type: "cupom",
      triggerId,
      status: "ok",
      printedBy: userId,
    })
    .returning({ id: printLogs.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Helper: seed a stock_movement row.
// ---------------------------------------------------------------------------
async function seedStockMovement(
  tenantId: string,
  productId: string,
  userId: string,
): Promise<string> {
  const [row] = await db
    .insert(stockMovements)
    .values({
      tenantId,
      productId,
      type: "entrada",
      quantity: "5.000",
      userId,
    })
    .returning({ id: stockMovements.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Helper: seed a sale_item row.
// ---------------------------------------------------------------------------
async function seedSaleItem(
  tenantId: string,
  saleId: string,
): Promise<string> {
  const [row] = await db
    .insert(saleItems)
    .values({
      tenantId,
      saleId,
      nameSnapshot: "Produto B",
      unit: "un",
      unitPriceCents: 100,
      quantity: "1.000",
      subtotalCents: 100,
    })
    .returning({ id: saleItems.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Helper: seed a receivable_payment row (cash_movement_id nullable).
// ---------------------------------------------------------------------------
async function seedReceivablePayment(
  tenantId: string,
  receivableId: string,
  userId: string,
): Promise<string> {
  const [row] = await db
    .insert(receivablePayments)
    .values({
      tenantId,
      receivableId,
      amountCents: 50,
      method: "pix",
      userId,
    })
    .returning({ id: receivablePayments.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Helper: seed a payable_payment row (cash_movement_id nullable).
// ---------------------------------------------------------------------------
async function seedPayablePayment(
  tenantId: string,
  payableId: string,
  userId: string,
): Promise<string> {
  const [row] = await db
    .insert(payablePayments)
    .values({
      tenantId,
      payableId,
      amountCents: 50,
      method: "pix",
      userId,
    })
    .returning({ id: payablePayments.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Helper: seed a kitchen_order_seqs row (composite PK, no id column).
// Returns the date string seeded.
// ---------------------------------------------------------------------------
async function seedKitchenOrderSeq(
  tenantId: string,
): Promise<string> {
  const dateStr = "2020-01-01"; // fixed date; avoids collisions with real data
  await db
    .insert(kitchenOrderSeqs)
    .values({ tenantId, date: dateStr, seq: 1 })
    .onConflictDoNothing();
  return dateStr;
}

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

suite("tenant-isolation-regression (RF03/RN03)", () => {
  // -------------------------------------------------------------------------
  // Setup: create two isolated tenants and seed one target row per table in
  // tenant B. Build the tableConfigs array for the parametrized cases below.
  // -------------------------------------------------------------------------
  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A (isolation test)");
    tenantB = await seedTenant(userB.userId, "Loja B (isolation test)");

    // -- products ----------------------------------------------------------
    const productBId = await seedProduct(tenantB, { name: "Produto B Isolation" });
    tableConfigs.push({
      name: "products",
      table: products,
      readWhere: eq(products.id, productBId),
      writeWhere: eq(products.id, productBId),
      mutatePatch: { name: "hacked" },
      originalKey: "name",
      originalValue: "Produto B Isolation",
    });

    // -- customers ---------------------------------------------------------
    const customerBId = await seedCustomer(tenantB, "Cliente B Isolation");
    tableConfigs.push({
      name: "customers",
      table: customers,
      readWhere: eq(customers.id, customerBId),
      writeWhere: eq(customers.id, customerBId),
      mutatePatch: { name: "hacked" },
      originalKey: "name",
      originalValue: "Cliente B Isolation",
    });

    // -- sales -------------------------------------------------------------
    const saleBId = await seedSale(tenantB, userB.userId);
    tableConfigs.push({
      name: "sales",
      table: sales,
      readWhere: eq(sales.id, saleBId),
      writeWhere: eq(sales.id, saleBId),
      mutatePatch: { paymentMethod: "pix" },
      originalKey: "paymentMethod",
      originalValue: "dinheiro",
    });

    // -- sale_items --------------------------------------------------------
    const saleItemBId = await seedSaleItem(tenantB, saleBId);
    tableConfigs.push({
      name: "sale_items",
      table: saleItems,
      readWhere: eq(saleItems.id, saleItemBId),
      writeWhere: eq(saleItems.id, saleItemBId),
      mutatePatch: { nameSnapshot: "hacked" },
      originalKey: "nameSnapshot",
      originalValue: "Produto B",
    });

    // -- comandas ----------------------------------------------------------
    const comandaB = await seedComanda(tenantB, userB.userId, { label: "Mesa B" });
    tableConfigs.push({
      name: "comandas",
      table: comandas,
      readWhere: eq(comandas.id, comandaB.id),
      writeWhere: eq(comandas.id, comandaB.id),
      mutatePatch: { label: "hacked" },
      originalKey: "label",
      originalValue: "Mesa B",
    });

    // -- comanda_items -----------------------------------------------------
    const productBForComandaId = await seedProduct(tenantB, { name: "Produto Comanda B" });
    const comandaItemB = await seedComandaItem(tenantB, comandaB.id, productBForComandaId);
    tableConfigs.push({
      name: "comanda_items",
      table: comandaItems,
      readWhere: eq(comandaItems.id, comandaItemB.id),
      writeWhere: eq(comandaItems.id, comandaItemB.id),
      mutatePatch: { observation: "hacked" },
      originalKey: "observation",
      originalValue: null,
    });

    // -- kitchen_order_seqs ------------------------------------------------
    // No `id` column — PK is (tenant_id, date). We filter on both columns.
    const kitchenDate = await seedKitchenOrderSeq(tenantB);
    tableConfigs.push({
      name: "kitchen_order_seqs",
      table: kitchenOrderSeqs,
      readWhere: and(
        eq(kitchenOrderSeqs.tenantId, tenantB),
        eq(kitchenOrderSeqs.date, kitchenDate),
      ) as SQL,
      writeWhere: and(
        eq(kitchenOrderSeqs.tenantId, tenantB),
        eq(kitchenOrderSeqs.date, kitchenDate),
      ) as SQL,
      mutatePatch: { seq: 999 },
      originalKey: "seq",
      originalValue: 1,
    });

    // -- print_logs --------------------------------------------------------
    // triggerId is polymorphic no-FK uuid; we reuse saleBId as a plausible uuid.
    const printLogBId = await seedPrintLog(tenantB, userB.userId, saleBId);
    tableConfigs.push({
      name: "print_logs",
      table: printLogs,
      readWhere: eq(printLogs.id, printLogBId),
      writeWhere: eq(printLogs.id, printLogBId),
      mutatePatch: { status: "falhou" },
      originalKey: "status",
      originalValue: "ok",
    });

    // -- stock_movements ---------------------------------------------------
    const stockMovementBId = await seedStockMovement(
      tenantB,
      productBId,
      userB.userId,
    );
    tableConfigs.push({
      name: "stock_movements",
      table: stockMovements,
      readWhere: eq(stockMovements.id, stockMovementBId),
      writeWhere: eq(stockMovements.id, stockMovementBId),
      mutatePatch: { reason: "hacked" },
      originalKey: "reason",
      originalValue: null,
    });

    // -- cash_sessions -----------------------------------------------------
    const cashSessionBId = await seedCashSession(tenantB, userB.userId, {
      openingBalanceCents: 100,
    });
    tableConfigs.push({
      name: "cash_sessions",
      table: cashSessions,
      readWhere: eq(cashSessions.id, cashSessionBId),
      writeWhere: eq(cashSessions.id, cashSessionBId),
      mutatePatch: { status: "fechada" },
      originalKey: "status",
      originalValue: "aberta",
    });

    // -- cash_movements ----------------------------------------------------
    const cashMovementBId = await seedCashMovement(tenantB, userB.userId, {
      amountCents: 100,
      type: "entrada",
      description: "original",
    });
    tableConfigs.push({
      name: "cash_movements",
      table: cashMovements,
      readWhere: eq(cashMovements.id, cashMovementBId),
      writeWhere: eq(cashMovements.id, cashMovementBId),
      mutatePatch: { description: "hacked" },
      originalKey: "description",
      originalValue: "original",
    });

    // -- receivables -------------------------------------------------------
    const receivableBId = await seedReceivable(tenantB, userB.userId, {
      customerId: customerBId,
      totalCents: 200,
      description: "original receivable",
    });
    tableConfigs.push({
      name: "receivables",
      table: receivables,
      readWhere: eq(receivables.id, receivableBId),
      writeWhere: eq(receivables.id, receivableBId),
      mutatePatch: { description: "hacked" },
      originalKey: "description",
      originalValue: "original receivable",
    });

    // -- receivable_payments -----------------------------------------------
    const receivablePaymentBId = await seedReceivablePayment(
      tenantB,
      receivableBId,
      userB.userId,
    );
    // receivable_payments is insert-only in the app, but RLS must block UPDATE too.
    tableConfigs.push({
      name: "receivable_payments",
      table: receivablePayments,
      readWhere: eq(receivablePayments.id, receivablePaymentBId),
      writeWhere: eq(receivablePayments.id, receivablePaymentBId),
      mutatePatch: { amountCents: 1 },
      originalKey: "amountCents",
      originalValue: 50,
    });

    // -- payables ----------------------------------------------------------
    const payableBId = await seedPayable(tenantB, userB.userId, {
      description: "original payable",
      totalCents: 200,
      category: "fornecedor",
    });
    tableConfigs.push({
      name: "payables",
      table: payables,
      readWhere: eq(payables.id, payableBId),
      writeWhere: eq(payables.id, payableBId),
      mutatePatch: { description: "hacked" },
      originalKey: "description",
      originalValue: "original payable",
    });

    // -- payable_payments --------------------------------------------------
    const payablePaymentBId = await seedPayablePayment(
      tenantB,
      payableBId,
      userB.userId,
    );
    tableConfigs.push({
      name: "payable_payments",
      table: payablePayments,
      readWhere: eq(payablePayments.id, payablePaymentBId),
      writeWhere: eq(payablePayments.id, payablePaymentBId),
      mutatePatch: { amountCents: 1 },
      originalKey: "amountCents",
      originalValue: 50,
    });

    // -- subscription_log (plan name: "subscriptions") ---------------------
    const subscriptionLogBId = await seedSubscriptionLog(tenantB);
    tableConfigs.push({
      name: "subscription_log",
      table: subscriptionLog,
      readWhere: eq(subscriptionLog.id, subscriptionLogBId),
      writeWhere: eq(subscriptionLog.id, subscriptionLogBId),
      mutatePatch: { action: "renewed" },
      originalKey: "action",
      originalValue: "trial_started",
    });

    // -- override_log ------------------------------------------------------
    const overrideLogBId = await seedOverrideLog(tenantB);
    tableConfigs.push({
      name: "override_log",
      table: overrideLog,
      readWhere: eq(overrideLog.id, overrideLogBId),
      writeWhere: eq(overrideLog.id, overrideLogBId),
      mutatePatch: { targetRef: "hacked" },
      originalKey: "targetRef",
      originalValue: null,
    });

    // -- user_permissions --------------------------------------------------
    // Seed an operator in tenantB with a permission so we have a row to target.
    const operatorB = await seedOperator(tenantB, {
      permissions: ["cancelar_venda" as PermissionCode],
    });
    const [upRow] = await db
      .select({ id: userPermissions.id })
      .from(userPermissions)
      .where(
        and(
          eq(userPermissions.tenantId, tenantB),
          eq(userPermissions.userId, operatorB.userId),
        ),
      );
    tableConfigs.push({
      name: "user_permissions",
      table: userPermissions,
      readWhere: eq(userPermissions.id, upRow.id),
      writeWhere: eq(userPermissions.id, upRow.id),
      mutatePatch: { permissionCode: "hacked_perm" },
      originalKey: "permissionCode",
      originalValue: "cancelar_venda",
    });

    // -- tenant_members ----------------------------------------------------
    // tenantB owner membership row is auto-created by seedTenant.
    // We target userB's membership in tenantB.
    const [tmRow] = await db
      .select({ id: tenantMembers.id })
      .from(tenantMembers)
      .where(
        and(
          eq(tenantMembers.tenantId, tenantB),
          eq(tenantMembers.userId, userB.userId),
        ),
      );
    tableConfigs.push({
      name: "tenant_members",
      table: tenantMembers,
      readWhere: eq(tenantMembers.id, tmRow.id),
      writeWhere: eq(tenantMembers.id, tmRow.id),
      mutatePatch: { role: "hacked" },
      originalKey: "role",
      originalValue: "owner",
    });
  }, 60_000);

  // -------------------------------------------------------------------------
  // Teardown: cascade cleanup. Order: tenantA → tenantB (cascade removes
  // all child rows), then users.
  // -------------------------------------------------------------------------
  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    if (userA.userId) await deleteTestUser(userA.userId);
    if (userB.userId) await deleteTestUser(userB.userId);
  });

  // -------------------------------------------------------------------------
  // iso-RN03-allpresent
  //
  // Derives the EXPECTED set by inspecting the schema module: any exported
  // pgTable object whose Drizzle column map contains a `tenantId` entry is
  // counted (excluding the `tenants` table itself and `platform_settings`).
  //
  // If a new table with `tenant_id` is added to the schema but NOT added to
  // this suite's tableConfigs array, the counts diverge and this test fails.
  // -------------------------------------------------------------------------
  it("iso-RN03-allpresent — suite covers 100% of tables with tenant_id", () => {
    // Derive all schema tables that expose a `tenantId` Drizzle column.
    const EXCLUDED_TABLE_NAMES = new Set(["tenants", "platform_settings"]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemaTablesWithTenantId = (Object.values(schema) as any[]).filter(
      (v) => {
        // Drizzle pgTable objects expose their column map via camelCase property
        // access. `tenantId` present = table has tenant_id column. Exclude root
        // tables with no tenant_id per feature spec.
        return (
          v !== null &&
          typeof v === "object" &&
          typeof v.tenantId !== "undefined" &&
          !EXCLUDED_TABLE_NAMES.has(v[Symbol.for("drizzle:BaseName")] as string)
        );
      },
    );

    const expectedCount = schemaTablesWithTenantId.length;
    const testedCount = tableConfigs.length;

    // List tested names for diagnostics when counts differ.
    const testedNames = new Set(tableConfigs.map((c) => c.name));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemaNames = (schemaTablesWithTenantId as any[]).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => t[Symbol.for("drizzle:BaseName")] as string,
    );
    const untestedSchemaNames = schemaNames.filter((n) => !testedNames.has(n));

    expect(
      untestedSchemaNames,
      `Tables with tenant_id found in schema but NOT tested: ${untestedSchemaNames.join(", ")}. Add them to the tableConfigs array above.`,
    ).toHaveLength(0);

    expect(
      testedCount,
      `Suite covers ${testedCount} tables; schema has ${expectedCount} tables with tenant_id (excluding tenants+platform_settings). Counts must match.`,
    ).toBe(expectedCount);
  });

  // -------------------------------------------------------------------------
  // iso-RN03-policy-gap contract comment
  //
  // The per-table tests below ARE the policy-gap detector:
  //   - If any table has `tenant_id` but NO RLS policy (or RLS disabled),
  //     the cross-tenant read succeeds → `toHaveLength(0)` FAILS.
  //   - The cross-tenant update also succeeds → `toHaveLength(0)` on
  //     `.returning()` FAILS.
  // Both cases produce a red test, which blocks the merge. This is the
  // RN03 contract: "missing RLS policy → red CI".
  //
  // Note on describe.each vs it-loop:
  //   `describe.each` is evaluated at module-load time, before `beforeAll`
  //   runs, so the lazily-populated `tableConfigs` array would be empty.
  //   Instead, we use a single `it` per case that iterates over the array
  //   at execution time (after `beforeAll`). Each failure message includes
  //   the table name for easy diagnosis.
  // -------------------------------------------------------------------------

  // iso-RF03-read: userA cannot read any row owned by tenantB.
  it("iso-RF03-read — userA cannot read a row from tenantB (all tables)", async () => {
    for (const cfg of tableConfigs) {
      const rows = await withUserRls(userA.userId, (tx) =>
        tx.select().from(cfg.table).where(cfg.readWhere),
      );
      expect(
        rows,
        `[${cfg.name}] RLS should block cross-tenant read`,
      ).toHaveLength(0);
    }
  });

  // iso-RF03-write: userA cannot mutate any row owned by tenantB; row unchanged.
  it("iso-RF03-write — userA cannot mutate a row from tenantB (all tables)", async () => {
    for (const cfg of tableConfigs) {
      const updated = await withUserRls(userA.userId, (tx) =>
        tx
          .update(cfg.table)
          .set(cfg.mutatePatch)
          .where(cfg.writeWhere)
          .returning(),
      );
      expect(
        updated,
        `[${cfg.name}] RLS should block cross-tenant write`,
      ).toHaveLength(0);

      // Confirm the row is still intact (owner db, bypasses RLS).
      const [still] = await db
        .select()
        .from(cfg.table)
        .where(cfg.readWhere);

      expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (still as any)?.[cfg.originalKey],
        `[${cfg.name}] Row must be unchanged after blocked cross-tenant update`,
      ).toBe(cfg.originalValue);
    }
  });
});
