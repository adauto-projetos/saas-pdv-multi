import { readdirSync, readFileSync } from "node:fs";

import { config } from "dotenv";
import postgres from "postgres";

// Aplica TODOS os db/migrations/*_rls.sql (em ordem). Rode com: npm run db:rls
config({ path: ".env.local" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "✗ DATABASE_URL ausente. Preencha o .env.local (veja .env.example).",
    );
    process.exit(1);
  }

  const dir = "db/migrations";
  const files = readdirSync(dir)
    .filter((f) => f.endsWith("_rls.sql"))
    .sort();

  const sql = postgres(url, { prepare: false });
  try {
    for (const file of files) {
      const sqlText = readFileSync(`${dir}/${file}`, "utf8");
      // simple() executa o script inteiro (vários statements + blocos DO $$).
      await sql.unsafe(sqlText).simple();
      console.log(`✓ RLS aplicada: ${file}`);
    }
  } catch (error) {
    console.error("✗ Falha ao aplicar a RLS:", error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
