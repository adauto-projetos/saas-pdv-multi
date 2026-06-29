// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * admin-RF01-no-drizzle (0020F): assert estrutural — as actions do super-admin
 * acessam dados SÓ via services (`lib/services/admin/`), nunca tocando Drizzle
 * diretamente. Lê o fonte da action e garante zero import/uso de `db`/`tenants`/
 * drizzle. Não precisa de banco (lê o arquivo, não executa). Trava regressão:
 * se alguém reintroduzir uma query inline na action, este teste fica vermelho.
 */
describe("actions super-admin sem Drizzle (admin-RF01-no-drizzle)", () => {
  const source = readFileSync(
    join(process.cwd(), "app/(admin)/superadmin/actions.ts"),
    "utf8",
  );

  it("não importa o cliente db de @/db", () => {
    expect(source).not.toMatch(/from\s+["']@\/db["']/);
  });

  it("não importa a tabela tenants (nem nada) de @/db/schema", () => {
    expect(source).not.toMatch(/from\s+["']@\/db\/schema["']/);
  });

  it("não importa de drizzle-orm (eq, and, sql, etc.)", () => {
    expect(source).not.toMatch(/from\s+["']drizzle-orm["']/);
  });

  it("não chama db.transaction/select/update/insert/delete diretamente", () => {
    expect(source).not.toMatch(/\bdb\.(transaction|select|update|insert|delete|execute)\b/);
  });
});
