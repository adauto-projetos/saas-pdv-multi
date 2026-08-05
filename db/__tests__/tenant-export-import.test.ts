// @vitest-environment node

/**
 * tenant-export-import.test.ts
 *
 * Contract tests for feature 0026F (instalação local) — the tenant data
 * migration path (SC03/SC05/SC06/SC07 of docs/features/0026F-instalacao-local
 * /plan.md's Test Specification). Covers `scripts/export-tenant.ts` and
 * `scripts/import-tenant.ts`: a single tenant's data (22 tables/groups, in FK
 * order) must round-trip from production to a fresh local Postgres without
 * loss, without leaking other tenants' rows, atomically (a broken FK aborts
 * the whole import, no partial state), and with the two data-scrub updates
 * (photo strip + subscription unlock) applied on the way in.
 *
 * Five exact test cases (plan.md, verbatim — do not add/rename):
 *   db-SC03-export-scoped        — export scoped to one tenant, 1 row/table.
 *   db-SC03-import-fk-atomic     — import preserves FK order; broken FK aborts
 *                                   the whole transaction atomically (case a:
 *                                   valid import; case b: corrupted FK).
 *   db-SC05-photos-stripped      — import nulls products.image_key/image_url.
 *   db-SC06-subscription-unlocked— import nulls valid_until/suspended_at.
 *   db-SC07-verifyprod-post-import — RLS catalog check (verify-prod.ts's
 *                                   query) passes against the post-import DB.
 *
 * Fixture shape: three disposable tenants (A, B, C), each seeded with exactly
 * one row per table via `seedOneRowPerTable` (mirrors the per-table seed
 * helpers in tenant-isolation-regression.test.ts, duplicated locally — same
 * convention that file itself uses for its own private seed helpers).
 *   - Tenant A: leak-check baseline only (never exported/imported for real).
 *   - Tenant B: the "golden path" — exported, deleted, re-imported. Its
 *     post-import state is what db-SC03(a)/SC05/SC06/SC07 all assert against.
 *     Built once in `beforeAll` (not a separate `it`) precisely because those
 *     four cases all depend on "already imported" — see the comment on the
 *     db-SC03-import-fk-atomic test below for why the import itself runs
 *     there and not in `beforeAll`.
 *   - Tenant C: minimal dataset dedicated to the corrupted-FK sub-case (case
 *     b) — kept separate from B so corrupting/rolling it back never touches
 *     the fixtures the other four cases rely on.
 *
 * `db.execute<T>()` (postgres-js) returns an array-like of rows — cast to
 * `Array<T>` before using array methods, same pattern as
 * lib/services/audit/audit-data.ts (`overrideLogExists`).
 */

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
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
  productCategories,
  products,
  receivablePayments,
  receivables,
  saleItems,
  sales,
  stockMovements,
  subscriptionLog,
  tenantMembers,
  tenants,
  userPermissions,
  users,
} from "@/db/schema";
import { requireActiveTenant } from "@/lib/auth/tenant-guard";
import { selectHasRenewed } from "@/lib/services/subscriptions/repository";
import { getTenantStatus } from "@/lib/services/subscriptions/subscription-status";
import type { TenantExportData } from "@/scripts/export-tenant";
import { exportTenant } from "@/scripts/export-tenant";
import { importTenant, tenantExportReviver } from "@/scripts/import-tenant";

import { cleanupTenant, createTestUser, deleteTestUser, HAS_DB, seedTenant } from "./seed";

const suite = HAS_DB ? describe : describe.skip;

/** UUID guaranteed to not exist in any fixture — used to corrupt a FK. */
const NON_EXISTENT_UUID = "00000000-0000-0000-0000-000000000000";

// ---------------------------------------------------------------------------
// Helper: seed one row in each of the 19 "additional" tenant-scoped tables
// (tenants + tenant_members are already seeded by `seedTenant`/`createTestUser`
// before this runs). Mirrors the per-table seed helpers private to
// tenant-isolation-regression.test.ts — duplicated here rather than shared,
// same convention that file itself follows (it doesn't export its helpers).
// ---------------------------------------------------------------------------
async function seedOneRowPerTable(
  tenantId: string,
  userId: string,
  opts: { subscriptionAction?: string } = {},
): Promise<{ productId: string; saleId: string; comandaId: string }> {
  await db
    .insert(userPermissions)
    .values({ tenantId, userId, permissionCode: "cancelar_venda", grantedBy: null });
  await db.insert(overrideLog).values({
    tenantId,
    actorUserId: userId,
    authorizerUserId: userId,
    actionCode: "fechar_caixa",
  });
  const [category] = await db
    .insert(productCategories)
    .values({ tenantId, name: `Categoria ${tenantId.slice(0, 8)}`, color: "azul", position: 0 })
    .returning({ id: productCategories.id });
  const [product] = await db
    .insert(products)
    .values({
      tenantId,
      name: `Produto ${tenantId.slice(0, 8)}`,
      unit: "un",
      salePriceCents: 1000,
      stockQuantity: "10.000",
      priceIsManual: false,
      categoryId: category.id,
    })
    .returning({ id: products.id });
  const [customer] = await db
    .insert(customers)
    .values({ tenantId, name: `Cliente ${tenantId.slice(0, 8)}` })
    .returning({ id: customers.id });
  await db
    .insert(cashSessions)
    .values({ tenantId, openingBalanceCents: 1000, openedBy: userId, status: "aberta" });
  const [payable] = await db
    .insert(payables)
    .values({
      tenantId,
      description: "Conta teste",
      totalCents: 500,
      category: "fornecedor",
      userId,
    })
    .returning({ id: payables.id });
  await db
    .insert(kitchenOrderSeqs)
    .values({ tenantId, date: "2020-01-01", seq: 1 })
    .onConflictDoNothing();
  await db
    .insert(subscriptionLog)
    .values({ tenantId, action: opts.subscriptionAction ?? "trial_started" });
  const [sale] = await db
    .insert(sales)
    .values({ tenantId, userId, totalCents: 100, paymentMethod: "dinheiro" })
    .returning({ id: sales.id });
  await db.insert(saleItems).values({
    tenantId,
    saleId: sale.id,
    nameSnapshot: "Item Teste",
    unit: "un",
    unitPriceCents: 100,
    quantity: "1.000",
    subtotalCents: 100,
  });
  await db
    .insert(stockMovements)
    .values({ tenantId, productId: product.id, type: "entrada", quantity: "5.000", userId });
  const [comanda] = await db
    .insert(comandas)
    .values({ tenantId, openedBy: userId, label: "Mesa Teste", status: "aberta" })
    .returning({ id: comandas.id });
  await db
    .insert(comandaItems)
    .values({ tenantId, comandaId: comanda.id, productId: product.id, quantity: "1.000" });
  await db
    .insert(cashMovements)
    .values({ tenantId, userId, amountCents: 100, type: "entrada", origin: "manual" });
  const [receivable] = await db
    .insert(receivables)
    .values({ tenantId, userId, customerId: customer.id, totalCents: 200, origin: "avulsa" })
    .returning({ id: receivables.id });
  await db
    .insert(receivablePayments)
    .values({ tenantId, receivableId: receivable.id, amountCents: 50, method: "pix", userId });
  await db
    .insert(payablePayments)
    .values({ tenantId, payableId: payable.id, amountCents: 50, method: "pix", userId });
  await db
    .insert(printLogs)
    .values({ tenantId, type: "cupom", triggerId: sale.id, status: "ok", printedBy: userId });

  return { productId: product.id, saleId: sale.id, comandaId: comanda.id };
}

/** Simulates the export → manual file transfer → import round trip via real JSON text. */
function roundTripJson(data: TenantExportData): TenantExportData {
  return JSON.parse(JSON.stringify(data), tenantExportReviver) as TenantExportData;
}

/**
 * Counts current rows for `tenantId` across all 22 table/groups, queried
 * directly against the DB (independent of whatever `importTenant` claims it
 * inserted) — used both to confirm a successful import (counts match the
 * export) and a rolled-back one (counts are all zero).
 */
async function countRowsByTenant(tenantId: string): Promise<Record<string, number>> {
  const tenantsRows = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId));
  const memberRows = await db
    .select({ userId: tenantMembers.userId })
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, tenantId));
  const memberUserIds = memberRows.map((r) => r.userId);
  const usersRows =
    memberUserIds.length > 0
      ? await db.select({ id: users.id }).from(users).where(inArray(users.id, memberUserIds))
      : [];
  const tenantMembersRows = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, tenantId));
  const userPermissionsRows = await db
    .select({ id: userPermissions.id })
    .from(userPermissions)
    .where(eq(userPermissions.tenantId, tenantId));
  const overrideLogRows = await db
    .select({ id: overrideLog.id })
    .from(overrideLog)
    .where(eq(overrideLog.tenantId, tenantId));
  const productCategoriesRows = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(eq(productCategories.tenantId, tenantId));
  const productsRows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.tenantId, tenantId));
  const customersRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));
  const cashSessionsRows = await db
    .select({ id: cashSessions.id })
    .from(cashSessions)
    .where(eq(cashSessions.tenantId, tenantId));
  const payablesRows = await db
    .select({ id: payables.id })
    .from(payables)
    .where(eq(payables.tenantId, tenantId));
  const kitchenOrderSeqsRows = await db
    .select({ tenantId: kitchenOrderSeqs.tenantId })
    .from(kitchenOrderSeqs)
    .where(eq(kitchenOrderSeqs.tenantId, tenantId));
  const subscriptionLogRows = await db
    .select({ id: subscriptionLog.id })
    .from(subscriptionLog)
    .where(eq(subscriptionLog.tenantId, tenantId));
  const salesRows = await db.select({ id: sales.id }).from(sales).where(eq(sales.tenantId, tenantId));
  const saleItemsRows = await db
    .select({ id: saleItems.id })
    .from(saleItems)
    .where(eq(saleItems.tenantId, tenantId));
  const stockMovementsRows = await db
    .select({ id: stockMovements.id })
    .from(stockMovements)
    .where(eq(stockMovements.tenantId, tenantId));
  const comandasRows = await db
    .select({ id: comandas.id })
    .from(comandas)
    .where(eq(comandas.tenantId, tenantId));
  const comandaItemsRows = await db
    .select({ id: comandaItems.id })
    .from(comandaItems)
    .where(eq(comandaItems.tenantId, tenantId));
  const cashMovementsRows = await db
    .select({ id: cashMovements.id })
    .from(cashMovements)
    .where(eq(cashMovements.tenantId, tenantId));
  const receivablesRows = await db
    .select({ id: receivables.id })
    .from(receivables)
    .where(eq(receivables.tenantId, tenantId));
  const receivablePaymentsRows = await db
    .select({ id: receivablePayments.id })
    .from(receivablePayments)
    .where(eq(receivablePayments.tenantId, tenantId));
  const payablePaymentsRows = await db
    .select({ id: payablePayments.id })
    .from(payablePayments)
    .where(eq(payablePayments.tenantId, tenantId));
  const printLogsRows = await db
    .select({ id: printLogs.id })
    .from(printLogs)
    .where(eq(printLogs.tenantId, tenantId));

  return {
    tenants: tenantsRows.length,
    users: usersRows.length,
    tenantMembers: tenantMembersRows.length,
    userPermissions: userPermissionsRows.length,
    overrideLog: overrideLogRows.length,
    productCategories: productCategoriesRows.length,
    products: productsRows.length,
    customers: customersRows.length,
    cashSessions: cashSessionsRows.length,
    payables: payablesRows.length,
    kitchenOrderSeqs: kitchenOrderSeqsRows.length,
    subscriptionLog: subscriptionLogRows.length,
    sales: salesRows.length,
    saleItems: saleItemsRows.length,
    stockMovements: stockMovementsRows.length,
    comandas: comandasRows.length,
    comandaItems: comandaItemsRows.length,
    cashMovements: cashMovementsRows.length,
    receivables: receivablesRows.length,
    receivablePayments: receivablePaymentsRows.length,
    payablePayments: payablePaymentsRows.length,
    printLogs: printLogsRows.length,
  };
}

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

suite("tenant-export-import (0026F)", () => {
  let userA = { userId: "", email: "" };
  let userB = { userId: "", email: "" };
  let userC = { userId: "", email: "" };
  let tenantA = "";
  let tenantB = "";
  let tenantC = "";

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
    userC = await createTestUser();
    tenantA = await seedTenant(userA.userId, "Loja A (export-import test)");
    tenantB = await seedTenant(userB.userId, "Loja B (export-import test)");
    tenantC = await seedTenant(userC.userId, "Loja C (export-import test)");

    // Tenant A only exists to prove the export doesn't leak — no special fixtures.
    await seedOneRowPerTable(tenantA, userA.userId);

    // Tenant B is the "golden path" dataset. db-SC05/SC06/SC07 all read its
    // post-import state — built once here, not spread across `it` blocks.
    const idsB = await seedOneRowPerTable(tenantB, userB.userId, {
      subscriptionAction: "renewed",
    });

    // db-SC05 fixture: simulate a leftover R2 reference from production.
    await db
      .update(products)
      .set({
        imageKey: "loja-b/produto.webp",
        imageUrl: "https://pub-example.r2.dev/loja-b/produto.webp",
      })
      .where(eq(products.id, idsB.productId));

    // db-SC06 fixture: subscription expired (valid_until in the past).
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db
      .update(tenants)
      .set({ validUntil: pastDate, suspendedAt: null })
      .where(eq(tenants.id, tenantB));

    // Tenant C is a minimal dataset dedicated to the corrupted-FK sub-case
    // (db-SC03-import-fk-atomic, case b) — kept separate from B so corrupting
    // and rolling it back never disturbs the fixtures the other tests rely on.
    await seedOneRowPerTable(tenantC, userC.userId);
  }, 60_000);

  afterAll(async () => {
    if (tenantA) await cleanupTenant(tenantA);
    if (tenantB) await cleanupTenant(tenantB);
    if (tenantC) await cleanupTenant(tenantC);
    if (userA.userId) await deleteTestUser(userA.userId);
    if (userB.userId) await deleteTestUser(userB.userId);
    if (userC.userId) await deleteTestUser(userC.userId);
  });

  // -------------------------------------------------------------------------
  // db-SC03-export-scoped
  // -------------------------------------------------------------------------
  it("db-SC03-export-scoped — export inclui só linhas do tenant alvo, 1 por tabela/grupo", async () => {
    const exportedA = await exportTenant(tenantA);
    const exportedB = await exportTenant(tenantB);

    // Every one of the 22 table/groups has exactly 1 row for tenant B — since
    // tenant A ALSO seeded exactly 1 row per table, any cross-tenant leak
    // (missing WHERE tenant_id filter, wrong join, etc.) would surface here as
    // a count of 2, not 1. This doubles as "zero linhas de tenantA vazadas".
    expect(exportedB.tables.tenants).toHaveLength(1);
    expect(exportedB.tables.users).toHaveLength(1);
    expect(exportedB.tables.tenantMembers).toHaveLength(1);
    expect(exportedB.tables.userPermissions).toHaveLength(1);
    expect(exportedB.tables.overrideLog).toHaveLength(1);
    expect(exportedB.tables.productCategories).toHaveLength(1);
    expect(exportedB.tables.products).toHaveLength(1);
    expect(exportedB.tables.customers).toHaveLength(1);
    expect(exportedB.tables.cashSessions).toHaveLength(1);
    expect(exportedB.tables.payables).toHaveLength(1);
    expect(exportedB.tables.kitchenOrderSeqs).toHaveLength(1);
    expect(exportedB.tables.subscriptionLog).toHaveLength(1);
    expect(exportedB.tables.sales).toHaveLength(1);
    expect(exportedB.tables.saleItems).toHaveLength(1);
    expect(exportedB.tables.stockMovements).toHaveLength(1);
    expect(exportedB.tables.comandas).toHaveLength(1);
    expect(exportedB.tables.comandaItems).toHaveLength(1);
    expect(exportedB.tables.cashMovements).toHaveLength(1);
    expect(exportedB.tables.receivables).toHaveLength(1);
    expect(exportedB.tables.receivablePayments).toHaveLength(1);
    expect(exportedB.tables.payablePayments).toHaveLength(1);
    expect(exportedB.tables.printLogs).toHaveLength(1);

    // Explicit identity check on a few representative tables: the single row
    // present really is tenant B's, not tenant A's.
    expect(exportedB.tables.tenants[0].id).toBe(tenantB);
    expect(exportedB.tables.users[0].id).toBe(userB.userId);
    expect(exportedB.tables.products[0].tenantId).toBe(tenantB);
    expect(exportedB.tables.sales[0].tenantId).toBe(tenantB);
    expect(exportedB.tables.customers[0].tenantId).toBe(tenantB);

    // Sanity: tenant A's own export is non-empty — the "1 per table" baseline
    // above isn't just an artifact of tenant B being the only seeded tenant.
    expect(exportedA.tables.products).toHaveLength(1);
    expect(exportedA.tables.products[0].tenantId).toBe(tenantA);
  });

  // -------------------------------------------------------------------------
  // db-SC03-import-fk-atomic
  //
  // Both sub-cases live in this single test (matching the plan.md row, which
  // describes them as one test case with inputs (a) and (b)):
  //   (a) valid import: tenant B is deleted then reimported from its own
  //       export — this is the ONLY place the "golden path" import actually
  //       runs, which is why db-SC05/SC06/SC07 below depend on this test
  //       having executed first (Vitest runs `it`s within a `describe`
  //       sequentially, in declaration order — same assumption
  //       tenant-isolation-regression.test.ts makes for its own beforeAll).
  //   (b) corrupted FK: tenant C's sale_items.sale_id is pointed at a
  //       non-existent sale before import — the whole transaction must abort,
  //       leaving zero rows for tenant C anywhere.
  // -------------------------------------------------------------------------
  it("db-SC03-import-fk-atomic — import respeita ordem de FK numa transação; FK ausente aborta tudo", async () => {
    // -- (a) valid import ----------------------------------------------------
    const exportedB = await exportTenant(tenantB);
    const roundTrippedB = roundTripJson(exportedB);
    // `cleanupTenant` only deletes the `tenants` row (cascade removes every
    // FK-linked child) — `users` has NO fk to `tenants` (a user can in
    // principle belong to several tenants), so it survives and must be
    // cleared separately to simulate a truly empty import target. Mirrors
    // the real flow: a fresh local Postgres has no `users` rows at all.
    await cleanupTenant(tenantB);
    await deleteTestUser(userB.userId);

    const importResultB = await importTenant(roundTrippedB);

    const expectedCountsB = Object.fromEntries(
      Object.entries(exportedB.tables).map(([key, rows]) => [key, (rows as unknown[]).length]),
    );
    expect(importResultB.counts).toEqual(expectedCountsB);

    const dbCountsAfterImport = await countRowsByTenant(tenantB);
    expect(dbCountsAfterImport).toEqual(expectedCountsB);

    // -- (b) corrupted FK aborts atomically -----------------------------------
    const exportedC = await exportTenant(tenantC);
    const corruptedC = roundTripJson(exportedC);
    expect(corruptedC.tables.saleItems.length).toBeGreaterThan(0);
    corruptedC.tables.saleItems[0] = {
      ...corruptedC.tables.saleItems[0],
      saleId: NON_EXISTENT_UUID,
    };
    // Same reasoning as tenant B above: clear `users` too, not just `tenants`.
    await cleanupTenant(tenantC);
    await deleteTestUser(userC.userId);

    await expect(importTenant(corruptedC)).rejects.toThrow();

    const dbCountsAfterFailedImport = await countRowsByTenant(tenantC);
    for (const [table, count] of Object.entries(dbCountsAfterFailedImport)) {
      expect(count, `[${table}] deveria ter zero linhas após rollback do import corrompido`).toBe(0);
    }
  });

  // -------------------------------------------------------------------------
  // db-SC05-photos-stripped
  // Depends on the (a) import above having already run against tenant B.
  // -------------------------------------------------------------------------
  it("db-SC05-photos-stripped — import zera image_key/image_url de todos os produtos do tenant migrado", async () => {
    const rows = await db.select().from(products).where(eq(products.tenantId, tenantB));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.imageKey, `[products ${row.id}] image_key deveria ser NULL pós-import`).toBeNull();
      expect(row.imageUrl, `[products ${row.id}] image_url deveria ser NULL pós-import`).toBeNull();
    }
  });

  // -------------------------------------------------------------------------
  // db-SC06-subscription-unlocked
  // Depends on the (a) import above having already run against tenant B.
  // -------------------------------------------------------------------------
  it("db-SC06-subscription-unlocked — import zera valid_until/suspended_at; tenant nunca trava", async () => {
    const [tenantRow] = await db.select().from(tenants).where(eq(tenants.id, tenantB));
    expect(tenantRow.validUntil).toBeNull();
    expect(tenantRow.suspendedAt).toBeNull();

    const hasRenewed = await selectHasRenewed(tenantB);
    const status = getTenantStatus(tenantRow, hasRenewed);
    expect(status).not.toBe("travada");

    await expect(requireActiveTenant(tenantB)).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // db-SC07-verifyprod-post-import
  //
  // Reimplements the exact catalog query from scripts/verify-prod.ts's
  // `verifyRlsPolicies` — that file is NOT imported here because it calls
  // `void main()` at module top-level (a process-exiting side effect on
  // import), and the task constraints require reusing it unchanged rather
  // than refactoring it to be import-safe. This mirrors the plan.md
  // instruction verbatim ("Reexecutar a query de catálogo de
  // scripts/verify-prod.ts").
  // -------------------------------------------------------------------------
  it("db-SC07-verifyprod-post-import — checagem de RLS de verify-prod.ts passa contra o banco local pós-import", async () => {
    const raw = await db.execute<{
      table_name: string;
      rowsecurity: boolean;
      has_policy: boolean;
    }>(sql`
      SELECT c.relname AS table_name,
             c.relrowsecurity AS rowsecurity,
             EXISTS (
               SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
             ) AS has_policy
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND a.attname = 'tenant_id'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY c.relname
    `);
    const rows = raw as unknown as Array<{
      table_name: string;
      rowsecurity: boolean;
      has_policy: boolean;
    }>;

    expect(rows.length).toBeGreaterThan(0);

    const problems = rows
      .filter((r) => !r.rowsecurity || !r.has_policy)
      .map((r) => r.table_name);
    expect(problems, `Tabelas com problema de RLS pós-import: ${problems.join(", ")}`).toHaveLength(0);
  });
});
