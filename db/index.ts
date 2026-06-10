import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Conexão direta ao Postgres (Supabase) para o data layer (Drizzle) e migrations.
// A connection string usa o papel `postgres`, que consegue assumir o papel
// `authenticated` por transação — é assim que a RLS é respeitada em runtime
// (ver `withUserRls` em ./rls.ts). `prepare: false` é exigido pelo pooler do Supabase.
const connectionString = process.env.DATABASE_URL ?? "";

export const queryClient = postgres(connectionString, { prepare: false });

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
export { schema };
