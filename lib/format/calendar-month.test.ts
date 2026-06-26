import { describe, expect, it } from "vitest";

import { addCalendarMonths } from "./calendar-month";

describe("addCalendarMonths (0013F, RN02)", () => {
  it("T49 — soma simples avança o mesmo dia", () => {
    const r = addCalendarMonths(new Date(2026, 0, 15), 2);
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(2); // março
    expect(r.getDate()).toBe(15);
  });

  it("T50 — overflow de fim-de-mês clampa (jan 31 +1 → fev 28)", () => {
    const r = addCalendarMonths(new Date(2026, 0, 31), 1);
    expect(r.getMonth()).toBe(1); // fevereiro
    expect(r.getDate()).toBe(28); // último dia de fev/2026
  });

  it("T51 — overflow em ano bissexto clampa para 29", () => {
    const r = addCalendarMonths(new Date(2024, 0, 31), 1);
    expect(r.getMonth()).toBe(1);
    expect(r.getDate()).toBe(29); // fev/2024 bissexto
  });

  it("T52 — virada de ano com clamp (nov 30 +3 → fev 28)", () => {
    const r = addCalendarMonths(new Date(2025, 10, 30), 3);
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(1); // fevereiro
    expect(r.getDate()).toBe(28);
  });

  it("T53 — preserva hora/minuto da base", () => {
    const base = new Date(2026, 0, 15, 10, 30, 0);
    const r = addCalendarMonths(base, 1);
    expect(r.getHours()).toBe(10);
    expect(r.getMinutes()).toBe(30);
  });
});
