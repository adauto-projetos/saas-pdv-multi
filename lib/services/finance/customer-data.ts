import { and, asc, eq, ilike } from "drizzle-orm";

import type { Database } from "@/db";
import { customers } from "@/db/schema";
import type { CustomerDto } from "@/types/finance";

type Executor = Pick<Database, "insert" | "select" | "update">;

function toCustomerDto(row: typeof customers.$inferSelect): CustomerDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function insertCustomer(
  tx: Executor,
  tenantId: string,
  data: { name: string; phone?: string | null },
): Promise<CustomerDto> {
  const [row] = await tx
    .insert(customers)
    .values({ tenantId, name: data.name, phone: data.phone ?? null })
    .returning();
  return toCustomerDto(row);
}

/** Clientes do tenant, ordem alfabética; filtra por `search` (ilike no nome). */
export async function selectCustomers(
  tx: Executor,
  tenantId: string,
  search?: string,
): Promise<CustomerDto[]> {
  const conds = [eq(customers.tenantId, tenantId)];
  if (search) conds.push(ilike(customers.name, `%${search}%`));
  const rows = await tx
    .select()
    .from(customers)
    .where(and(...conds))
    .orderBy(asc(customers.name));
  return rows.map(toCustomerDto);
}

export async function selectCustomerById(
  tx: Executor,
  tenantId: string,
  id: string,
): Promise<CustomerDto | null> {
  const [row] = await tx
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)));
  return row ? toCustomerDto(row) : null;
}
