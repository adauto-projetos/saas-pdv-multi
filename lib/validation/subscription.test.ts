import { describe, expect, it } from "vitest";

import { releaseMonthsSchema } from "./subscription";

describe("releaseMonthsSchema (0013F, RN01)", () => {
  it("T54 — meses=0 rejeitado", () => {
    expect(releaseMonthsSchema.safeParse({ months: 0 }).success).toBe(false);
  });

  it("T55 — meses=1 aceito (mínimo)", () => {
    expect(releaseMonthsSchema.safeParse({ months: 1 }).success).toBe(true);
  });

  it("T56 — meses=24 aceito (máximo)", () => {
    expect(releaseMonthsSchema.safeParse({ months: 24 }).success).toBe(true);
  });

  it("T57 — meses=25 rejeitado (acima do teto)", () => {
    expect(releaseMonthsSchema.safeParse({ months: 25 }).success).toBe(false);
  });

  it("T58 — não-inteiro / Infinity / negativo rejeitados", () => {
    expect(releaseMonthsSchema.safeParse({ months: 1.5 }).success).toBe(false);
    expect(releaseMonthsSchema.safeParse({ months: Infinity }).success).toBe(false);
    expect(releaseMonthsSchema.safeParse({ months: -3 }).success).toBe(false);
  });
});
