import { describe, expect, it } from "vitest";

import { brlToCents, centsToBRL } from "./money";

describe("money format (T19)", () => {
  it("round-trip centavos -> BRL -> centavos", () => {
    expect(brlToCents(centsToBRL(1050))).toBe(1050);
    expect(brlToCents(centsToBRL(105050))).toBe(105050);
    expect(brlToCents(centsToBRL(0))).toBe(0);
  });

  it("formata centavos para string BRL", () => {
    expect(centsToBRL(1050)).toContain("10,50");
  });

  it("parseia entrada com R$ e milhar", () => {
    expect(brlToCents("R$ 1.050,50")).toBe(105050);
    expect(brlToCents("10,50")).toBe(1050);
  });
});
