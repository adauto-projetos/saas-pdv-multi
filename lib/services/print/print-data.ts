import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { customers, kitchenOrderSeqs, printLogs, tenants } from "@/db/schema";

/**
 * Data layer da feature de impressão (0007F). Executor = db ou RlsTx;
 * o serviço decide o contexto (sempre `withUserRls`). Todas as funções filtram
 * por `tenant_id` — filtro aditivo à RLS (RN01).
 */
type Executor = Pick<Database, "insert" | "select" | "update" | "delete">;

export type NewPrintLog = {
  tenantId: string;
  type: "cozinha" | "cupom";
  triggerId: string;
  status: "ok" | "falhou";
  errorMessage?: string | null;
  printedBy: string;
};

/**
 * Insere um registro de tentativa de impressão (RF08 — append-only).
 * Garante rastreabilidade de sucessos e falhas por tenant.
 */
export async function insertPrintLog(
  tx: Executor,
  input: NewPrintLog,
): Promise<typeof printLogs.$inferSelect> {
  const [row] = await tx
    .insert(printLogs)
    .values({
      tenantId: input.tenantId,
      type: input.type,
      triggerId: input.triggerId,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      printedBy: input.printedBy,
    })
    .returning();
  return row;
}

/**
 * Incremento atômico do sequencial de cozinha por tenant + dia (RN02).
 * Usa `INSERT ... ON CONFLICT DO UPDATE` numa única instrução — sem race condition
 * mesmo com chamadas concorrentes. Caller deve converter o instante para UTC-3
 * antes de passar `date` (RN02 — reset diário alinhado ao fuso local).
 *
 * Retorna o número sequencial comprometido (começa em 1 no primeiro call do dia).
 */
export async function getNextKitchenOrderNum(
  tx: Executor,
  tenantId: string,
  date: string,
): Promise<number> {
  const [row] = await tx
    .insert(kitchenOrderSeqs)
    .values({ tenantId, date, seq: 1 })
    .onConflictDoUpdate({
      target: [kitchenOrderSeqs.tenantId, kitchenOrderSeqs.date],
      set: { seq: sql`${kitchenOrderSeqs.seq} + 1` },
    })
    .returning();
  return row.seq;
}

/**
 * Logs de impressão de um trigger específico, mais recentes primeiro.
 * Usado para reimpressão e rastreabilidade (RF07, RF08).
 */
export async function selectPrintLogsByTrigger(
  tx: Executor,
  tenantId: string,
  triggerId: string,
): Promise<(typeof printLogs.$inferSelect)[]> {
  return tx
    .select()
    .from(printLogs)
    .where(
      and(
        eq(printLogs.tenantId, tenantId),
        eq(printLogs.triggerId, triggerId),
      ),
    )
    .orderBy(desc(printLogs.printedAt));
}

/**
 * Nome do estabelecimento para o cabeçalho do cupom (RN08).
 * Query trivial de PK — tabela `tenants` é pequena.
 * Lança se tenant não encontrado (situação impossível em operação normal).
 */
export async function selectTenantName(
  tx: Executor,
  tenantId: string,
): Promise<string> {
  const [row] = await tx
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!row) throw new Error("Tenant not found");
  return row.name;
}

/**
 * Nome do cliente para o cupom de pagamento fiado (RF03).
 * Retorna null se o cliente não for encontrado (não lança — uso defensivo).
 */
export async function selectCustomerName(
  tx: Executor,
  tenantId: string,
  customerId: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ name: customers.name })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  return row?.name ?? null;
}
