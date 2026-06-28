// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Raiz do repositório (este arquivo vive em <root>/tests/).
const ROOT = path.resolve(__dirname, "..");

/** Coleta recursivamente os arquivos .ts/.tsx sob `dir` (ignora node_modules/.next). */
function collectSource(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSource(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const WEBP_MAGIC_RIFF = "RIFF";
const WEBP_MAGIC_WEBP = "WEBP";
const MAX_LOGO_BYTES = 102_400; // 100 KB

function isWebp(file: string): boolean {
  const buf = readFileSync(file);
  return (
    buf.toString("ascii", 0, 4) === WEBP_MAGIC_RIFF &&
    buf.toString("ascii", 8, 12) === WEBP_MAGIC_WEBP
  );
}

describe("0018F rebrand assets (RF01/RF06/RNF01)", () => {
  it("T01 — nenhuma ocorrência de 'PDV.multi' em app/ e components/", () => {
    const files = [
      ...collectSource(path.join(ROOT, "app")),
      ...collectSource(path.join(ROOT, "components")),
    ];
    const offenders = files.filter((f) =>
      readFileSync(f, "utf8").includes("PDV.multi"),
    );
    expect(offenders).toEqual([]);
  });

  it("T07 — background.webp do login < 100 KB", () => {
    const size = statSync(path.join(ROOT, "public/background.webp")).size;
    expect(size).toBeLessThan(MAX_LOGO_BYTES);
  });

  it("T08 — logo-full.webp e logo-icon.webp < 100 KB", () => {
    expect(
      statSync(path.join(ROOT, "public/logo-full.webp")).size,
    ).toBeLessThan(MAX_LOGO_BYTES);
    expect(
      statSync(path.join(ROOT, "public/logo-icon.webp")).size,
    ).toBeLessThan(MAX_LOGO_BYTES);
  });

  it("T09 — os assets da marca são WebP (RIFF/WEBP)", () => {
    expect(isWebp(path.join(ROOT, "public/background.webp"))).toBe(true);
    expect(isWebp(path.join(ROOT, "public/logo-full.webp"))).toBe(true);
    expect(isWebp(path.join(ROOT, "public/logo-icon.webp"))).toBe(true);
  });

  it("T10 — PNGs originais removidos", () => {
    expect(existsSync(path.join(ROOT, "public/logo (1).png"))).toBe(false);
    expect(existsSync(path.join(ROOT, "public/logo (2).png"))).toBe(false);
  });

  it("T11 — favicon app/icon.png presente", () => {
    expect(existsSync(path.join(ROOT, "app/icon.png"))).toBe(true);
  });
});
