import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Em dev local carrega do .env.local; em produção (Docker) as vars já estão no process.env.
if (process.env.NODE_ENV !== "production") {
  config({ path: ".env.local" });
}

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
