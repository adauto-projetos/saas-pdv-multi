// @vitest-environment node
// Structural test — no DB connection needed. Does NOT gate on HAS_DB.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Testes estruturais de estratégia de migration (RN01/RN02).
 *
 * mig-RN01-pushonly: Garante que push-only é a estratégia oficial documentada:
 *   - package.json tem db:setup contendo 'drizzle-kit push' e 'apply-rls'
 *   - CLAUDE.md menciona 'push-only'
 *
 * mig-RN02-no-migrate: Garante que db:migrate e a migration 0000 stale foram removidos:
 *   - package.json NÃO tem chave db:migrate nos scripts
 *   - db/migrations/0000_perfect_mikhail_rasputin.sql NÃO existe
 *   - arquivos *_rls.sql AINDA existem (não foram apagados por engano)
 */
describe("migration strategy — push-only oficial (RN01/RN02)", () => {
  const root = process.cwd();
  const pkgPath = join(root, "package.json");
  const claudeMdPath = join(root, "CLAUDE.md");

  it("mig-RN01-pushonly — db:setup existe e usa drizzle-kit push + apply-rls", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};

    expect(scripts["db:setup"]).toBeDefined();
    expect(scripts["db:setup"]).toMatch(/drizzle-kit push/);
    expect(scripts["db:setup"]).toMatch(/apply-rls/);
  });

  it("mig-RN01-pushonly — CLAUDE.md documenta push-only como estratégia oficial", () => {
    const content = readFileSync(claudeMdPath, "utf-8");
    expect(content).toMatch(/push-only/i);
  });

  it("mig-RN02-no-migrate — package.json não tem script db:migrate", () => {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};

    expect(Object.prototype.hasOwnProperty.call(scripts, "db:migrate")).toBe(false);
  });

  it("mig-RN02-no-migrate — migration stale 0000 não existe mais", () => {
    const staleMigration = join(
      root,
      "db",
      "migrations",
      "0000_perfect_mikhail_rasputin.sql",
    );
    expect(existsSync(staleMigration)).toBe(false);
  });

  it("mig-RN02-no-migrate — arquivos *_rls.sql preservados (0011_override_rls.sql existe)", () => {
    const lastRls = join(
      root,
      "db",
      "migrations",
      "0011_override_rls.sql",
    );
    expect(existsSync(lastRls)).toBe(true);
  });
});
