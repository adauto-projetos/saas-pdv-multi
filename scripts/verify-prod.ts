import { config } from "dotenv";
import postgres from "postgres";

// ============================================================================
// verify-prod.ts — guarda de boot de produção (hotfix 0019H, Unidade 1)
// ----------------------------------------------------------------------------
// Roda no startup do container, DEPOIS de `npm run db:setup`, e ANTES de
// `npm start` (ver Dockerfile CMD). Falha o boot (exit ≠ 0) se:
//
//   1. SESSION_SECRET ausente/fraco em produção — fail-fast espelhando o guard
//      de lib/auth/session.ts, mas no boot (antes de servir qualquer request).
//   2. Alguma tabela de negócio (que tem coluna `tenant_id`) estiver sem RLS
//      habilitada OU sem a policy `tenant_isolation`. Isso pega o footgun do
//      `drizzle-kit push`, que apaga as policies: se o apply-rls não as repôs,
//      o container NÃO sobe — em vez de servir com lojas se enxergando.
//
// Como o orquestrador (Coolify/Docker) reinicia o container até dar certo,
// "travar o boot" aqui é a barreira mais segura (não existe pipeline de CI).
// ============================================================================

// Em prod as vars vêm do ambiente do container; em dev, do .env.local.
config({ path: ".env.local" });

const MIN_SECRET_LEN = 32;
const DEV_SECRET = "dev-insecure-secret-change-me";

function verifySessionSecret(): string[] {
  if (process.env.NODE_ENV !== "production") return [];
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < MIN_SECRET_LEN || value === DEV_SECRET) {
    return [
      `SESSION_SECRET ausente, fraco (<${MIN_SECRET_LEN} chars) ou igual ao default de dev.`,
    ];
  }
  return [];
}

async function verifyRlsPolicies(url: string): Promise<string[]> {
  const sql = postgres(url, { prepare: false });
  try {
    // Toda tabela de public com coluna `tenant_id` é tabela de negócio e DEVE
    // ter RLS habilitada + ao menos uma policy de isolamento. Checamos a EXISTÊNCIA
    // de qualquer policy (não o nome): a maioria usa `tenant_isolation`, mas
    // tenant_members usa `tenant_member_isolation`. O footgun do `drizzle-kit push`
    // apaga TODAS as policies — então "zero policies" é exatamente o que pegamos.
    const rows = await sql<{ table_name: string; rowsecurity: boolean; has_policy: boolean }[]>`
      SELECT c.relname AS table_name,
             c.relrowsecurity AS rowsecurity,
             EXISTS (
               SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
             ) AS has_policy
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND a.attname = 'tenant_id'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY c.relname
    `;

    if (rows.length === 0) {
      return [
        "Nenhuma tabela com coluna tenant_id encontrada — schema não materializado?",
      ];
    }

    const problems: string[] = [];
    for (const r of rows) {
      if (!r.rowsecurity) problems.push(`${r.table_name}: RLS desabilitada`);
      else if (!r.has_policy)
        problems.push(`${r.table_name}: sem nenhuma policy de isolamento`);
    }
    return problems;
  } finally {
    await sql.end();
  }
}

async function main() {
  const errors: string[] = [...verifySessionSecret()];

  const url = process.env.DATABASE_URL;
  if (!url) {
    errors.push("DATABASE_URL ausente.");
  } else {
    errors.push(...(await verifyRlsPolicies(url)));
  }

  if (errors.length > 0) {
    console.error("✗ verify-prod FALHOU — boot abortado:");
    for (const e of errors) console.error(`  • ${e}`);
    process.exit(1);
  }

  console.log("✓ verify-prod OK — SESSION_SECRET e RLS validados.");
}

void main();
