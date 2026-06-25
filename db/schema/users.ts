import { sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Usuário da aplicação (auth local, sem Supabase). Senha guardada como hash bcrypt.
 * A sessão é um cookie assinado com o `id` — ver `lib/auth/session.ts`.
 */
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // is_founder: marca o dono da plataforma (super admin). Semeado via
  // db/seeds/founder.ts lendo FOUNDER_EMAIL do ambiente (RF07).
  isFounder: boolean("is_founder").notNull().default(false),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
