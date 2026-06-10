import { describe, expect, it } from "vitest";

import {
  calculateSalePrice,
  resolvePriceOnCreate,
  suggestPriceOnCostChange,
} from "./markup";

describe("calculateSalePrice (RF02)", () => {
  it("T03 — calcula preço a partir de custo + margem", () => {
    expect(calculateSalePrice(1000, 30)).toBe(1300);
  });

  it("T04 — arredonda half-up ao centavo", () => {
    // 1000 + 1000*33.33/100 = 1333.3 -> 1333
    expect(calculateSalePrice(1000, 33.33)).toBe(1333);
    // garante half-up: 1000 + 1000*0.05/100 = 1000.5 -> 1001
    expect(calculateSalePrice(1000, 0.05)).toBe(1001);
  });
});

describe("resolvePriceOnCreate (RF03/RF04)", () => {
  it("T05 — preço manual vence o cálculo e marca priceIsManual", () => {
    const result = resolvePriceOnCreate({
      costCents: 1000,
      markupPercent: 30,
      salePriceCents: 1500,
    });
    expect(result).toEqual({ salePriceCents: 1500, priceIsManual: true });
  });

  it("calcula via markup quando não há preço manual", () => {
    const result = resolvePriceOnCreate({ costCents: 1000, markupPercent: 30 });
    expect(result).toEqual({ salePriceCents: 1300, priceIsManual: false });
  });
});

describe("suggestPriceOnCostChange (RF06 preview)", () => {
  it("T10 — preview não persiste e sugere a partir da margem armazenada", () => {
    const product = {
      salePriceCents: 1300,
      markupPercent: 30,
      priceIsManual: false,
    };
    const dto = suggestPriceOnCostChange(product, 2000);
    expect(dto.suggestedSalePriceCents).toBe(2600);
    expect(dto.newCostCents).toBe(2000);
    expect(dto.warnManualOverride).toBe(false);
    // função pura: o objeto de entrada não é mutado.
    expect(product.salePriceCents).toBe(1300);
  });

  it("T13 — avisa quando o preço atual é manual", () => {
    const product = {
      salePriceCents: 1500,
      markupPercent: 30,
      priceIsManual: true,
    };
    const dto = suggestPriceOnCostChange(product, 2000);
    expect(dto.warnManualOverride).toBe(true);
  });
});
