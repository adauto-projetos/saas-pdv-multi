import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Conexão direta ao Postgres (Docker local ou self-hosted) para o data layer (Drizzle)
// e migrations. A connection string usa o papel `postgres` (dono), que executa DDL e
// bypassa RLS. O acesso a dados de negócio roda sob o papel `app_user` via `withUserRls`
// (ver ./rls.ts) — é assim que a RLS é respeitada em runtime. `prepare: false` evita
// prepared statements, recomendado quando há reuso de conexão por pooler.
const connectionString = process.env.DATABASE_URL ?? "";

export const queryClient = postgres(connectionString, { prepare: false });

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
export { schema };
