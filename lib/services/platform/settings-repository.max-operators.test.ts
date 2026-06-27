// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";

import { HAS_DB, withGlobalSettingsLock } from "@/db/__tests__/seed";

import { getMaxOperators, setMaxOperators } from "./settings-repository";

const suite = HAS_DB ? describe : describe.skip;

suite("getMaxOperators / setMaxOperators (RF01/RN01)", () => {
  // Restaura o default global ao terminar (singleton compartilhado entre testes).
  afterAll(async () => {
    await setMaxOperators(3, null);
  });

  it("lê um inteiro ≥ 1 (default 3 quando não definido)", async () => {
    const value = await getMaxOperators();
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(1);
  });

  it("upsert persiste o valor na linha singleton (roundtrip)", async () => {
    // Lock global: serializa com o teste de enforcement que também muta o teto.
    await withGlobalSettingsLock(async () => {
      await setMaxOperators(7, null);
      expect(await getMaxOperators()).toBe(7);
      await setMaxOperators(3, null);
      expect(await getMaxOperators()).toBe(3);
    });
  });
});
