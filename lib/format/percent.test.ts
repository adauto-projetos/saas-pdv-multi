import { describe, expect, it } from "vitest";

import { formatPercent, parsePercent } from "./percent";

describe("percent format (T19)", () => {
  it("round-trip number -> texto -> number", () => {
    expect(parsePercent(formatPercent(30))).toBe(30);
    expect(parsePercent(formatPercent(33.33))).toBe(33.33);
  });

  it("formata com 2 casas", () => {
    expect(formatPercent(30)).toBe("30,00");
  });
});
