import { afterEach, describe, expect, it, vi } from "vitest";

import { endOfTodayBrazil, startOfTodayBrazil, todayBrazilIso } from "./business-day";

/**
 * Hotfix 0027H — reproduz o bug real: "hoje" virava "amanhã" às 21h no
 * horário do Brasil (UTC-3), porque o código antigo usava getters locais do
 * runtime (`getFullYear`/`getMonth`/`getDate`), que em produção (Docker sem
 * `TZ`) refletem UTC, não o fuso de negócio. Estes testes fixam o instante
 * via `vi.setSystemTime` e comparam contra strings ISO (UTC) esperadas —
 * determinístico em qualquer máquina/CI, independente do fuso do runtime que
 * roda o teste (a implementação corrigida nunca lê getters locais).
 */
describe("business-day (fuso Brasil, UTC-3) — hotfix 0027H", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("às 21h30 BRT (00h30 UTC do dia seguinte) o dia comercial ainda é o de ontem em UTC", () => {
    // 2026-08-06 21:30 BRT = 2026-08-07 00:30 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T00:30:00.000Z"));

    expect(startOfTodayBrazil().toISOString()).toBe("2026-08-06T03:00:00.000Z");
    expect(endOfTodayBrazil().toISOString()).toBe("2026-08-07T03:00:00.000Z");
    expect(todayBrazilIso()).toBe("2026-08-06");
  });

  it("uma venda das 10h BRT do mesmo dia comercial cai DENTRO do intervalo [início, fim) mesmo consultada às 21h30 BRT", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T00:30:00.000Z")); // 21h30 BRT

    const start = startOfTodayBrazil();
    const end = endOfTodayBrazil();
    const saleEarlierToday = new Date("2026-08-06T13:00:00.000Z"); // 10h BRT

    expect(saleEarlierToday >= start && saleEarlierToday < end).toBe(true);
  });

  it("antes das 21h BRT (controle) o dia comercial bate com o dia UTC corrente", () => {
    // 2026-08-06 12:00 BRT = 2026-08-06 15:00 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T15:00:00.000Z"));

    expect(startOfTodayBrazil().toISOString()).toBe("2026-08-06T03:00:00.000Z");
    expect(todayBrazilIso()).toBe("2026-08-06");
  });

  it("logo após a virada real da meia-noite no Brasil (00h01 BRT = 03h01 UTC) o dia já avançou", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T03:01:00.000Z")); // 00h01 BRT do dia 07

    expect(startOfTodayBrazil().toISOString()).toBe("2026-08-07T03:00:00.000Z");
    expect(todayBrazilIso()).toBe("2026-08-07");
  });
});
