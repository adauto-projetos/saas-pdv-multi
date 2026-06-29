import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenants } from "@/db/schema";

/**
 * Data layer do super-admin (0020F/RF01). Roda na conexão `db` (owner) — o painel
 * founder opera cross-tenant (gerencia QUALQUER loja), então NÃO usa withUserRls:
 * bypassa RLS por design. Mesmo padrão `*-data.ts` de 0014F (operator-data.ts).
 * O gate de autorização (`requireFounder`) vive na action.
 */

/** Nome do tenant por PK (owner db, sem RLS). Para confirmação de exclusão no super-admin. */
export async function selectTenantName(
  tenantId: string,
): Promise<{ name: string } | null> {
  const [row] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row ?? null;
}
