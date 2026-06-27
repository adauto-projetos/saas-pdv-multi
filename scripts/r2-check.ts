/**
 * Smoke test do Cloudflare R2 (feature 0016F). Roda o caminho REAL do app
 * (`lib/services/storage/r2-client`): grava um objeto de teste, confere que a URL
 * pública responde, e apaga. Serve pra validar credenciais/bucket/URL pública ANTES
 * de cadastrar foto de verdade — sem subir o app inteiro.
 *
 * Uso: preencha as vars R2_* em `.env.local` e rode `npm run r2:check`.
 * Não escreve nada permanente: o objeto de teste é removido ao final.
 */
import { del, publicUrl, put } from "@/lib/services/storage/r2-client";

const PREFIX = "_r2-check"; // prefixo separado: não colide com fotos reais (<tenantId>/...)

function mask(value: string | undefined): string {
  if (!value) return "(vazio)";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

async function main(): Promise<void> {
  // 1) Eco da config lida (com segredo mascarado) — ajuda a achar erro de digitação.
  console.log("Config R2 lida do .env.local:");
  console.log(`  R2_ACCOUNT_ID      = ${mask(process.env.R2_ACCOUNT_ID)}`);
  console.log(`  R2_BUCKET          = ${process.env.R2_BUCKET ?? "(vazio)"}`);
  console.log(`  R2_ACCESS_KEY_ID   = ${mask(process.env.R2_ACCESS_KEY_ID)}`);
  console.log(`  R2_SECRET_ACCESS_KEY = ${mask(process.env.R2_SECRET_ACCESS_KEY)}`);
  console.log(`  R2_PUBLIC_URL      = ${process.env.R2_PUBLIC_URL ?? "(vazio)"}`);
  console.log("");

  const key = `${PREFIX}/${Date.now()}.txt`;
  const body = Buffer.from(`r2-check ok @ ${new Date().toISOString()}`);

  // 2) PUT — escreve no bucket (valida Account ID + bucket + credenciais).
  process.stdout.write("→ PUT objeto de teste... ");
  await put(key, body, "text/plain");
  console.log("ok");

  // 3) GET pela URL pública — valida R2_PUBLIC_URL + acesso público habilitado.
  const url = publicUrl(key);
  process.stdout.write(`→ GET ${url} ... `);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `URL pública respondeu ${res.status}. Verifique R2_PUBLIC_URL e se o ` +
        `acesso público do bucket está habilitado (r2.dev ou domínio custom).`,
    );
  }
  const text = await res.text();
  if (text !== body.toString()) {
    throw new Error(`Conteúdo divergente da URL pública: "${text}"`);
  }
  console.log(`ok (${res.status})`);

  // 4) DELETE — limpa o objeto de teste (valida permissão de escrita/delete).
  process.stdout.write("→ DELETE objeto de teste... ");
  await del(key);
  console.log("ok");

  console.log("\n✅ R2 configurado corretamente — pode cadastrar foto de produto.");
}

main().catch((err) => {
  console.error("\n❌ Falha no smoke test do R2:");
  console.error(`   ${err instanceof Error ? err.message : String(err)}`);
  console.error(
    "\nChecklist: bucket existe? token tem Object Read & Write? acesso público ON? URL sem barra final?",
  );
  process.exit(1);
});
