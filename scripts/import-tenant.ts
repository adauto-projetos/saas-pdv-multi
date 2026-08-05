import "./load-env-local";

import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { readFileSync } from "node:fs";
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
import type { TenantExportData } from "./export-tenant";

// ============================================================================
// import-tenant.ts — feature 0026F (instalação local)
// ----------------------------------------------------------------------------
// Lê o JSON gerado por scripts/export-tenant.ts e insere as 22 tabelas/grupos
// na mesma ordem de FK, numa ÚNICA transação, via conexão owner (`db`, papel
// `postgres` — bypassa RLS, mesmo padrão de scripts/seed-testfull.ts). Uma FK
// ausente/quebrada aborta a transação inteira atomicamente — constraint real
// do Postgres, sem necessidade de rollback manual (ver plan.md > Risks).
//
// Depois de inserir tudo, aplica DENTRO da mesma transação (atômico com o
// insert) os dois ajustes de dados decididos em about.md:
//   - Desbloqueio de assinatura: tenants.valid_until = NULL, suspended_at = NULL.
//   - Remoção de fotos: products.image_key = NULL, image_url = NULL (RN: sem
//     R2 local — about.md "Does NOT Include").
// ============================================================================

/** Tipo da transação Drizzle (postgres-js) — mesmo padrão de repository.ts. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Contagem de linhas inseridas por tabela (chave = mesma chave de `tables`). */
export type ImportCounts = Record<keyof TenantExportData["tables"], number>;

export interface ImportResult {
  tenantId: string;
  counts: ImportCounts;
}

/**
 * Insere `rows` na tabela `table` dentro da transação `tx` e confirma
 * paridade de contagem (linhas pedidas === linhas retornadas por `.returning()`).
 * Tabelas sem linhas pra este tenant são puladas — `.values([])` do Drizzle
 * lança erro em array vazio, então o guard é necessário (não é defesa contra
 * dado malformado, é o caminho normal para tabelas opcionais como comandas).
 */
async function insertRows<TTable extends PgTable>(
  tx: Tx,
  table: TTable,
  tableLabel: string,
  rows: InferInsertModel<TTable>[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await tx.insert(table).values(rows).returning();
  if (inserted.length !== rows.length) {
    throw new Error(
      `Paridade de contagem falhou em "${tableLabel}": esperado ${rows.length}, inserido ${inserted.length}.`,
    );
  }
  return inserted.length;
}

/**
 * Importa um export de tenant inteiro numa única transação atômica.
 * Lança erro (e reverte tudo, sem estado parcial) se qualquer FK estiver
 * ausente/quebrada, ou se a paridade de contagem falhar em qualquer tabela.
 */
export async function importTenant(data: TenantExportData): Promise<ImportResult> {
  if (!data.tenantId || data.tables.tenants.length === 0) {
    throw new Error("Export inválido: nenhum tenant encontrado no arquivo.");
  }
  const { tenantId, tables } = data;

  const counts = await db.transaction(async (tx) => {
    // Ordem de FK — idêntica à tabela "Table export/import order" do plan.md.
    const result = {} as ImportCounts;
    result.tenants = await insertRows(tx, tenants, "tenants", tables.tenants);
    result.users = await insertRows(tx, users, "users", tables.users);
    result.tenantMembers = await insertRows(
      tx,
      tenantMembers,
      "tenant_members",
      tables.tenantMembers,
    );
    result.userPermissions = await insertRows(
      tx,
      userPermissions,
      "user_permissions",
      tables.userPermissions,
    );
    result.overrideLog = await insertRows(tx, overrideLog, "override_log", tables.overrideLog);
    result.productCategories = await insertRows(
      tx,
      productCategories,
      "product_categories",
      tables.productCategories,
    );
    result.products = await insertRows(tx, products, "products", tables.products);
    result.customers = await insertRows(tx, customers, "customers", tables.customers);
    result.cashSessions = await insertRows(
      tx,
      cashSessions,
      "cash_sessions",
      tables.cashSessions,
    );
    result.payables = await insertRows(tx, payables, "payables", tables.payables);
    result.kitchenOrderSeqs = await insertRows(
      tx,
      kitchenOrderSeqs,
      "kitchen_order_seqs",
      tables.kitchenOrderSeqs,
    );
    result.subscriptionLog = await insertRows(
      tx,
      subscriptionLog,
      "subscription_log",
      tables.subscriptionLog,
    );
    result.sales = await insertRows(tx, sales, "sales", tables.sales);
    result.saleItems = await insertRows(tx, saleItems, "sale_items", tables.saleItems);
    result.stockMovements = await insertRows(
      tx,
      stockMovements,
      "stock_movements",
      tables.stockMovements,
    );
    result.comandas = await insertRows(tx, comandas, "comandas", tables.comandas);
    result.comandaItems = await insertRows(
      tx,
      comandaItems,
      "comanda_items",
      tables.comandaItems,
    );
    result.cashMovements = await insertRows(
      tx,
      cashMovements,
      "cash_movements",
      tables.cashMovements,
    );
    result.receivables = await insertRows(tx, receivables, "receivables", tables.receivables);
    result.receivablePayments = await insertRows(
      tx,
      receivablePayments,
      "receivable_payments",
      tables.receivablePayments,
    );
    result.payablePayments = await insertRows(
      tx,
      payablePayments,
      "payable_payments",
      tables.payablePayments,
    );
    result.printLogs = await insertRows(tx, printLogs, "print_logs", tables.printLogs);

    // Ajustes de dados (about.md) — aplicados aqui, não no export, dentro da
    // MESMA transação: se qualquer insert acima falhar, estes UPDATEs também
    // revertem (atomicidade), então o tenant nunca fica "meio migrado".
    await tx
      .update(tenants)
      .set({ validUntil: null, suspendedAt: null })
      .where(eq(tenants.id, tenantId));
    await tx
      .update(products)
      .set({ imageKey: null, imageUrl: null })
      .where(eq(products.tenantId, tenantId));

    return result;
  });

  return { tenantId, counts };
}

// ----------------------------------------------------------------------------
// Reviver de JSON.parse — reconstrói `Date` a partir de strings ISO 8601 com
// milissegundos + "Z" (formato exato de `Date.prototype.toISOString()`, o que
// `JSON.stringify` grava para colunas `timestamp`). Colunas `date` (ex.:
// kitchen_order_seqs.date, payables.due_date) usam formato "YYYY-MM-DD" sem
// componente de hora — não batem no regex, permanecem string (mode "string"
// do Drizzle para `date`, mesmo padrão usado em db/__tests__/seed.ts). Colunas
// `numeric` também permanecem string (mode "string" do Drizzle) — sem conversão.
// ----------------------------------------------------------------------------
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function tenantExportReviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && ISO_TIMESTAMP_RE.test(value)) {
    return new Date(value);
  }
  return value;
}

/** Lê e faz o parse de um arquivo de export gerado por export-tenant.ts. */
export function loadTenantExport(filePath: string): TenantExportData {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw, tenantExportReviver) as TenantExportData;
}

// ----------------------------------------------------------------------------
// CLI entry point. Guardado por `isMainModule` (diferente dos demais scripts
// do projeto, que chamam `main()` incondicionalmente): este arquivo também é
// importado como módulo pelos testes (`importTenant` chamado direto), então
// `main()` só pode rodar quando o arquivo é executado diretamente via tsx.
// ----------------------------------------------------------------------------
function isMainModule(): boolean {
  return !!process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Uso: npx tsx scripts/import-tenant.ts <arquivo-export.json>");
    process.exit(1);
  }

  try {
    const data = loadTenantExport(inputPath);
    const result = await importTenant(data);
    const counts = Object.entries(result.counts)
      .map(([name, count]) => `${name}=${count}`)
      .join(", ");
    console.log(`✓ Import concluído.`);
    console.log(`  tenant: ${result.tenantId}`);
    console.log(`  contagens: ${counts}`);
    // A conexão postgres-js (`../db`) fica aberta pra reuso — sem isso o
    // processo trava sem sair (confirmado via teste manual: o import travou
    // install-local.sh no meio, depois de já ter concluído o trabalho).
    process.exit(0);
  } catch (error) {
    console.error("✗ Falha no import — nenhuma linha foi persistida (transação revertida):", error);
    process.exit(1);
  }
}

if (isMainModule()) {
  void main();
}
