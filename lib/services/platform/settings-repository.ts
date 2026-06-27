import { eq } from "drizzle-orm";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";

/**
 * Lê o preço do plano mensal (em centavos) da config global da plataforma.
 * Retorna 0 quando ainda não foi definido (nenhuma linha) — o signup trata 0
 * como "preço não exibido". Usa owner db (sem RLS): config global, não-tenant.
 */
export async function getMonthlyPlanPriceCents(): Promise<number> {
  const [row] = await db
    .select({ monthlyPriceCents: platformSettings.monthlyPriceCents })
    .from(platformSettings)
    .where(eq(platformSettings.singleton, true))
    .limit(1);
  return row?.monthlyPriceCents ?? 0;
}

/**
 * Define o preço do plano mensal (upsert na linha singleton). Chamado pela
 * action do painel super admin (gated por requireFounder). Usa owner db.
 */
export async function setMonthlyPlanPriceCents(
  priceCents: number,
  byUserId: string | null,
): Promise<void> {
  await db
    .insert(platformSettings)
    .values({
      singleton: true,
      monthlyPriceCents: priceCents,
      updatedBy: byUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.singleton,
      set: {
        monthlyPriceCents: priceCents,
        updatedBy: byUserId,
        updatedAt: new Date(),
      },
    });
}

/**
 * Lê o teto global de operadores por loja (0014F/SF03). Default 3 quando ainda
 * não há linha singleton. Owner db (config global, não-tenant).
 */
export async function getMaxOperators(): Promise<number> {
  const [row] = await db
    .select({ maxOperators: platformSettings.maxOperators })
    .from(platformSettings)
    .where(eq(platformSettings.singleton, true))
    .limit(1);
  return row?.maxOperators ?? 3;
}

/**
 * Define o teto global de operadores (upsert na linha singleton). Chamado pela
 * action do painel super admin (gated por requireFounder). Owner db.
 */
export async function setMaxOperators(
  maxOperators: number,
  byUserId: string | null,
): Promise<void> {
  await db
    .insert(platformSettings)
    .values({
      singleton: true,
      maxOperators,
      updatedBy: byUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.singleton,
      set: {
        maxOperators,
        updatedBy: byUserId,
        updatedAt: new Date(),
      },
    });
}
