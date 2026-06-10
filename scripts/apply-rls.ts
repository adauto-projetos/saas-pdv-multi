import { readFileSync } from "node:fs";

import { config } from "dotenv";
import postgres from "postgres";

// Aplica db/migrations/0001_rls.sql no banco. Rode com: npm run db:rls
config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "✗ DATABASE_URL ausente. Preencha o .env.local (veja .env.example).",
    );
    process.exit(1);
  }

  const sqlText = readFileSync("db/migrations/0001_rls.sql", "utf8");
  const sql = postgres(url, { prepare: false });

  try {
    // simple() executa o script inteiro (vários statements + blocos DO $$) de uma vez.
    await sql.unsafe(sqlText).simple();
    console.log("✓ RLS aplicada com sucesso (0001_rls.sql)");
  } catch (error) {
    console.error("✗ Falha ao aplicar a RLS:", error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
