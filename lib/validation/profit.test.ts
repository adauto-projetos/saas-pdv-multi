import { describe, expect, it } from "vitest";

import {
  closeSessionSchema,
  openSessionSchema,
  profitFilterSchema,
} from "./profit";

// Schemas zod puros — rodam sempre (não tocam o banco).
describe("profit validation", () => {
  it("val-RN02-opening-non-negative: openSessionSchema exige inteiro ≥ 0", () => {
    expect(openSessionSchema.safeParse({ openingBalanceCents: -1 }).success).toBe(
      false,
    );
    expect(openSessionSchema.safeParse({ openingBalanceCents: 0 }).success).toBe(
      true,
    );
    expect(
      openSessionSchema.safeParse({ openingBalanceCents: 1000 }).success,
    ).toBe(true);
  });

  it("val-RN02-counted-non-negative: closeSessionSchema exige inteiro ≥ 0", () => {
    expect(closeSessionSchema.safeParse({ countedCents: -1 }).success).toBe(false);
    expect(closeSessionSchema.safeParse({ countedCents: 0 }).success).toBe(true);
    expect(closeSessionSchema.safeParse({ countedCents: 5000 }).success).toBe(
      true,
    );
  });

  it("val-profit-filter-optional: profitFilterSchema aceita from/to opcionais", () => {
    expect(profitFilterSchema.safeParse({}).success).toBe(true);
    expect(
      profitFilterSchema.safeParse({
        from: "2026-06-01",
        to: "2026-06-12",
      }).success,
    ).toBe(true);
  });
});
