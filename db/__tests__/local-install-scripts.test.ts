// @vitest-environment node
// Structural test — no DB connection needed. Does NOT gate on HAS_DB/DATABASE_URL
// (mesmo padrão de db/__tests__/migration-strategy.test.ts).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Testes estruturais dos scripts de empacotamento local (feature 0026F).
 *
 * script-SC01-install-script-structure: scripts/install-local.sh tem os
 *   passos/guardas esperados e não toca código do app.
 * script-SC02-secrets-generated: scripts/install-local.sh gera SESSION_SECRET
 *   e POSTGRES_PASSWORD fortes via openssl, não hardcoded.
 * script-SC08-update-script-structure: scripts/update-local.sh não toca
 *   dados, só reconstrói/reinicia o app.
 * script-SC10-docs-exist: SETUP.md (founder) e UPDATE.md (cliente) existem
 *   como arquivos distintos.
 */

const root = process.cwd();
const featureDocsDir = join(root, "docs", "features", "0026F-instalacao-local");

describe("install-local.sh — estrutura e guardas (script-SC01)", () => {
  const scriptPath = join(root, "scripts", "install-local.sh");
  const content = readFileSync(scriptPath, "utf-8");

  it("script-SC01-install-script-structure — aborta se .env já existe, orientando update-local.sh", () => {
    expect(content).toMatch(/-f\s+\.env/);
    expect(content).toMatch(/update-local\.sh/);
  });

  it("script-SC01-install-script-structure — usa docker-compose.prod.yml", () => {
    expect(content).toMatch(/docker-compose\.prod\.yml/);
  });

  it("script-SC01-install-script-structure — roda db:setup + import-tenant.ts + verify:prod dentro do container app, antes de subir o app final", () => {
    expect(content).toMatch(/db:setup/);
    expect(content).toMatch(/import-tenant\.ts/);
    expect(content).toMatch(/verify:prod/);
    expect(content).toMatch(/docker compose[^\n]*run\s+--rm/);

    const runIdx = content.indexOf("run --rm");
    const finalUpIdx = content.lastIndexOf("up -d app");
    expect(runIdx).toBeGreaterThan(-1);
    expect(finalUpIdx).toBeGreaterThan(runIdx);
  });

  it("script-SC01-install-script-structure — não referencia código do app (app/, lib/, components/, db/schema/)", () => {
    expect(content).not.toMatch(/\bapp\//);
    expect(content).not.toMatch(/\blib\//);
    expect(content).not.toMatch(/\bcomponents\//);
    expect(content).not.toMatch(/db\/schema\//);
  });

  it("script-SC02-secrets-generated — gera SESSION_SECRET e POSTGRES_PASSWORD via openssl rand -hex 32", () => {
    const opensslMatches = content.match(/openssl rand -hex 32/g) ?? [];
    expect(opensslMatches.length).toBeGreaterThanOrEqual(2);
    expect(content).toMatch(/SESSION_SECRET=\$\(openssl rand -hex 32\)/);
    expect(content).toMatch(/POSTGRES_PASSWORD=\$\(openssl rand -hex 32\)/);
  });

  it("script-SC02-secrets-generated — grava os segredos gerados no .env, sem literal fixo/default de dev", () => {
    expect(content).toMatch(/>>\s*\.env/);
    expect(content).not.toMatch(/troque-por-um-valor-aleatorio-bem-longo/);
    expect(content).not.toMatch(/dev-insecure-secret-change-me/);
  });
});

describe("update-local.sh — estrutura e guardas (script-SC08)", () => {
  const scriptPath = join(root, "scripts", "update-local.sh");
  const content = readFileSync(scriptPath, "utf-8");

  it("script-SC08-update-script-structure — aborta se .env não existe, orientando install-local.sh", () => {
    expect(content).toMatch(/!\s*-f\s+\.env/);
    expect(content).toMatch(/install-local\.sh/);
  });

  it("script-SC08-update-script-structure — faz git fetch/checkout + docker compose build app + up -d app", () => {
    expect(content).toMatch(/git fetch/);
    expect(content).toMatch(/git checkout/);
    expect(content).toMatch(/docker compose[^\n]*build\s+app/);
    expect(content).toMatch(/docker compose[^\n]*up -d app/);
  });

  it("script-SC08-update-script-structure — NÃO chama db:setup/import-tenant.ts/verify:prod diretamente", () => {
    expect(content).not.toMatch(/db:setup/);
    expect(content).not.toMatch(/import-tenant\.ts/);
    expect(content).not.toMatch(/verify:prod/);
  });
});

describe("documentação de instalação/atualização (script-SC10-docs-exist)", () => {
  it("script-SC10-docs-exist — SETUP.md (founder) existe", () => {
    expect(existsSync(join(featureDocsDir, "SETUP.md"))).toBe(true);
  });

  it("script-SC10-docs-exist — UPDATE.md (cliente) existe, em arquivo distinto de SETUP.md", () => {
    expect(existsSync(join(featureDocsDir, "UPDATE.md"))).toBe(true);
  });
});

describe("coletar-logs.sh — estrutura e guardas (chore 0027C)", () => {
  const scriptPath = join(root, "scripts", "coletar-logs.sh");
  const content = readFileSync(scriptPath, "utf-8");

  it("aborta se .env não existe, mesma guarda de update-local.sh", () => {
    expect(content).toMatch(/!\s*-f\s+\.env/);
  });

  it("usa docker-compose.prod.yml e coleta ps + logs de app e db", () => {
    expect(content).toMatch(/docker-compose\.prod\.yml/);
    expect(content).toMatch(/docker compose[^\n]*ps/);
    expect(content).toMatch(/docker compose[^\n]*logs[^\n]*\bapp\b/);
    expect(content).toMatch(/docker compose[^\n]*logs[^\n]*\bdb\b/);
  });

  it("grava a coleta num arquivo .txt, não só imprime no terminal", () => {
    expect(content).toMatch(/>\s*"?\$OUT"?/);
    expect(content).toMatch(/logs-pdv-.*\.txt/);
  });

  it("não referencia código do app (app/, lib/, components/, db/schema/) — só leitura de logs", () => {
    expect(content).not.toMatch(/\bapp\//);
    expect(content).not.toMatch(/\blib\//);
    expect(content).not.toMatch(/\bcomponents\//);
    expect(content).not.toMatch(/db\/schema\//);
  });
});
