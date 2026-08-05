import "./load-env-local";

import { eq, inArray } from "drizzle-orm";

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { db } from "../db";
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
} from "../db/schema";
import type {
  CashMovement,
  CashSession,
  Comanda,
  ComandaItem,
  Customer,
  KitchenOrderSeq,
  OverrideLog,
  Payable,
  PayablePayment,
  PrintLog,
  Product,
  ProductCategory,
  Receivable,
  ReceivablePayment,
  Sale,
  SaleItem,
  StockMovement,
  SubscriptionLog,
  Tenant,
  TenantMember,
  User,
  UserPermission,
} from "../db/schema";

// ============================================================================
// export-tenant.ts — feature 0026F (instalação local)
// ----------------------------------------------------------------------------
// Exporta TODAS as linhas de um único tenant, nas 22 tabelas/grupos em ordem
// de FK (ver plan.md > "Table export/import order"), para um único arquivo
// JSON. Não usa `pg_dump` — reaproveita o mesmo stack Drizzle/`postgres` de
// todo outro script do projeto (ver Architecture Decisions do plano).
//
// `users` não tem `tenant_id`: filtrado via join com `tenant_members`
// (2 passos — busca ids de membro, depois os usuários por esses ids — mesmo
// padrão de `inArray` usado em lib/services/sales/data.ts e
// lib/services/comanda/comanda-data.ts, sem subquery inline).
//
// Roda com a conexão owner (`db`, papel `postgres`) — bypassa RLS de propósito,
// mesmo padrão de scripts/seed-testfull.ts: o script precisa enxergar os dados
// do tenant independentemente de qualquer sessão de usuário.
// ============================================================================

/** Formato do arquivo de export — consumido por scripts/import-tenant.ts. */
export interface TenantExportTables {
  tenants: Tenant[];
  users: User[];
  tenantMembers: TenantMember[];
  userPermissions: UserPermission[];
  overrideLog: OverrideLog[];
  productCategories: ProductCategory[];
  products: Product[];
  customers: Customer[];
  cashSessions: CashSession[];
  payables: Payable[];
  kitchenOrderSeqs: KitchenOrderSeq[];
  subscriptionLog: SubscriptionLog[];
  sales: Sale[];
  saleItems: SaleItem[];
  stockMovements: StockMovement[];
  comandas: Comanda[];
  comandaItems: ComandaItem[];
  cashMovements: CashMovement[];
  receivables: Receivable[];
  receivablePayments: ReceivablePayment[];
  payablePayments: PayablePayment[];
  printLogs: PrintLog[];
}

export interface TenantExportData {
  tenantId: string;
  exportedAt: string;
  tables: TenantExportTables;
}

/**
 * Exporta um tenant inteiro (22 tabelas/grupos, em ordem de FK) para um objeto
 * em memória. Lança erro se o tenant não existir — evita gerar um export vazio
 * silenciosamente (RN implícita: falha explícita é melhor que dado incompleto).
 */
export async function exportTenant(tenantId: string): Promise<TenantExportData> {
  // 1. tenants — a própria raiz.
  const tenantsRows = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (tenantsRows.length === 0) {
    throw new Error(`Tenant não encontrado: ${tenantId}`);
  }

  // 2. users — sem tenant_id; filtrado via join com tenant_members (2 passos).
  const memberRows = await db
    .select({ userId: tenantMembers.userId })
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, tenantId));
  const memberUserIds = memberRows.map((r) => r.userId);
  const usersRows =
    memberUserIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, memberUserIds))
      : [];

  // 3–22. Demais tabelas — todas filtradas diretamente por tenant_id, na
  // mesma ordem de FK documentada em plan.md.
  const tenantMembersRows = await db
    .select()
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, tenantId));
  const userPermissionsRows = await db
    .select()
    .from(userPermissions)
    .where(eq(userPermissions.tenantId, tenantId));
  const overrideLogRows = await db
    .select()
    .from(overrideLog)
    .where(eq(overrideLog.tenantId, tenantId));
  const productCategoriesRows = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.tenantId, tenantId));
  const productsRows = await db.select().from(products).where(eq(products.tenantId, tenantId));
  const customersRows = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId));
  const cashSessionsRows = await db
    .select()
    .from(cashSessions)
    .where(eq(cashSessions.tenantId, tenantId));
  const payablesRows = await db.select().from(payables).where(eq(payables.tenantId, tenantId));
  const kitchenOrderSeqsRows = await db
    .select()
    .from(kitchenOrderSeqs)
    .where(eq(kitchenOrderSeqs.tenantId, tenantId));
  const subscriptionLogRows = await db
    .select()
    .from(subscriptionLog)
    .where(eq(subscriptionLog.tenantId, tenantId));
  const salesRows = await db.select().from(sales).where(eq(sales.tenantId, tenantId));
  const saleItemsRows = await db
    .select()
    .from(saleItems)
    .where(eq(saleItems.tenantId, tenantId));
  const stockMovementsRows = await db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.tenantId, tenantId));
  const comandasRows = await db.select().from(comandas).where(eq(comandas.tenantId, tenantId));
  const comandaItemsRows = await db
    .select()
    .from(comandaItems)
    .where(eq(comandaItems.tenantId, tenantId));
  const cashMovementsRows = await db
    .select()
    .from(cashMovements)
    .where(eq(cashMovements.tenantId, tenantId));
  const receivablesRows = await db
    .select()
    .from(receivables)
    .where(eq(receivables.tenantId, tenantId));
  const receivablePaymentsRows = await db
    .select()
    .from(receivablePayments)
    .where(eq(receivablePayments.tenantId, tenantId));
  const payablePaymentsRows = await db
    .select()
    .from(payablePayments)
    .where(eq(payablePayments.tenantId, tenantId));
  const printLogsRows = await db
    .select()
    .from(printLogs)
    .where(eq(printLogs.tenantId, tenantId));

  return {
    tenantId,
    exportedAt: new Date().toISOString(),
    tables: {
      tenants: tenantsRows,
      users: usersRows,
      tenantMembers: tenantMembersRows,
      userPermissions: userPermissionsRows,
      overrideLog: overrideLogRows,
      productCategories: productCategoriesRows,
      products: productsRows,
      customers: customersRows,
      cashSessions: cashSessionsRows,
      payables: payablesRows,
      kitchenOrderSeqs: kitchenOrderSeqsRows,
      subscriptionLog: subscriptionLogRows,
      sales: salesRows,
      saleItems: saleItemsRows,
      stockMovements: stockMovementsRows,
      comandas: comandasRows,
      comandaItems: comandaItemsRows,
      cashMovements: cashMovementsRows,
      receivables: receivablesRows,
      receivablePayments: receivablePaymentsRows,
      payablePayments: payablePaymentsRows,
      printLogs: printLogsRows,
    },
  };
}

// ----------------------------------------------------------------------------
// CLI entry point. Guardado por `isMainModule` (diferente dos demais scripts
// do projeto, que chamam `main()` incondicionalmente): este arquivo também é
// importado como módulo pelos testes (`exportTenant` chamado direto), então
// `main()` só pode rodar quando o arquivo é executado diretamente via tsx.
// ----------------------------------------------------------------------------
function isMainModule(): boolean {
  return !!process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);
}

async function main() {
  const tenantId = process.argv[2];
  const outputPath = process.argv[3] ?? "tenant-export.json";

  if (!tenantId) {
    console.error("Uso: npx tsx scripts/export-tenant.ts <tenantId> [arquivo-saida.json]");
    process.exit(1);
  }

  try {
    const data = await exportTenant(tenantId);
    writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");
    const counts = Object.entries(data.tables)
      .map(([name, rows]) => `${name}=${rows.length}`)
      .join(", ");
    console.log(`✓ Export concluído: ${outputPath}`);
    console.log(`  tenant: ${data.tenantId}`);
    console.log(`  contagens: ${counts}`);
    // A conexão postgres-js (`../db`) fica aberta pra reuso — sem isso o
    // processo trava sem sair (confirmado via teste manual: script "termina"
    // mas nunca devolve o terminal, o que travaria install-local.sh no meio).
    process.exit(0);
  } catch (error) {
    console.error("✗ Falha no export:", error);
    process.exit(1);
  }
}

if (isMainModule()) {
  void main();
}
