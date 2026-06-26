import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

/**
 * Configuração GLOBAL da plataforma — singleton (uma única linha).
 *
 * NÃO é dado de negócio de um tenant: guarda o preço único do plano mensal do
 * SaaS, definido pelo founder no painel super admin e exibido na tela de criar
 * conta. Por isso NÃO tem `tenant_id` e fica FORA da RLS — é acessada apenas via
 * conexão owner (`db`): a tela de signup é pública (sem sessão) e a edição é
 * protegida por `requireFounder()` na server action.
 *
 * Linha única garantida por `singleton` (boolean unico, sempre `true`): o upsert
 * usa `ON CONFLICT (singleton)` para sempre mirar a mesma linha.
 */
export const platformSettings = pgTable("platform_settings", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // Trava de singleton: só pode existir uma linha com singleton=true.
  singleton: boolean("singleton").notNull().default(true).unique(),
  // Preço do plano mensal em centavos (regra do projeto: dinheiro = inteiro em
  // centavos). 0 = ainda não definido — o signup não exibe valor enquanto for 0.
  monthlyPriceCents: integer("monthly_price_cents").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Founder que definiu o preço pela última vez (auditoria). Nullable.
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
}, (t) => [
  // Trava de singleton no nível do banco: toda linha desta tabela é sempre a
  // linha única (singleton=true). Combinado com o UNIQUE, impede uma 2ª linha
  // (inclusive uma órfã com singleton=false que o upsert nunca atingiria).
  check("platform_settings_singleton", sql`${t.singleton} = true`),
]);

export type PlatformSettings = typeof platformSettings.$inferSelect;
export type NewPlatformSettings = typeof platformSettings.$inferInsert;
