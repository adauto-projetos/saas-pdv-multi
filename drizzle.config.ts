import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Carrega variáveis do .env.local (Supabase URL/keys, DATABASE_URL).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
