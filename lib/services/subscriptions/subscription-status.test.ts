import { describe, expect, it } from "vitest";

import { getTenantStatus, resolveSubscriptionBanners } from "./subscription-status";

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);

describe("resolveSubscriptionBanners (RF04)", () => {
  it("loja SEM vencimento (validUntil null) não mostra aviso de expiração", () => {
    // Regressão: o default `daysLeft = 0` caía na checagem `daysLeft <= 3` e
    // exibia "Seu período expira hoje" para uma loja que nunca expira —
    // reportado na instalação local (0026F), onde a trava é removida.
    const banners = resolveSubscriptionBanners({
      status: "ativa",
      validUntil: null,
      impersonating: false,
    });

    expect(banners.showWarning).toBe(false);
    expect(banners.showTrial).toBe(false);
    expect(banners.showLocked).toBe(false);
  });

  it("loja em teste SEM vencimento também não mostra banner nenhum", () => {
    const banners = resolveSubscriptionBanners({
      status: "testando",
      validUntil: null,
      impersonating: false,
    });

    expect(banners.showWarning).toBe(false);
    expect(banners.showTrial).toBe(false);
  });

  it("avisa quando faltam 3 dias ou menos para o vencimento", () => {
    const banners = resolveSubscriptionBanners({
      status: "ativa",
      validUntil: inDays(2),
      impersonating: false,
    });

    expect(banners.showWarning).toBe(true);
    expect(banners.daysLeft).toBeLessThanOrEqual(3);
  });

  it("NÃO avisa quando ainda falta bastante tempo", () => {
    const banners = resolveSubscriptionBanners({
      status: "ativa",
      validUntil: inDays(20),
      impersonating: false,
    });

    expect(banners.showWarning).toBe(false);
  });

  it("em teste com folga mostra o banner informativo de trial", () => {
    const banners = resolveSubscriptionBanners({
      status: "testando",
      validUntil: inDays(10),
      impersonating: false,
    });

    expect(banners.showTrial).toBe(true);
    expect(banners.showWarning).toBe(false);
  });

  it("loja travada mostra só o banner de bloqueio", () => {
    const banners = resolveSubscriptionBanners({
      status: "travada",
      validUntil: inDays(-10),
      impersonating: false,
    });

    expect(banners.showLocked).toBe(true);
    expect(banners.showWarning).toBe(false);
    expect(banners.showTrial).toBe(false);
  });

  it("impersonando não mostra banner de assinatura da loja-alvo", () => {
    const banners = resolveSubscriptionBanners({
      status: "travada",
      validUntil: inDays(-10),
      impersonating: true,
    });

    expect(banners.showLocked).toBe(false);
    expect(banners.showWarning).toBe(false);
    expect(banners.showTrial).toBe(false);
  });

  it("sem tenant carregado (status null) não mostra nada", () => {
    const banners = resolveSubscriptionBanners({
      status: null,
      validUntil: null,
      impersonating: false,
    });

    expect(banners.showLocked).toBe(false);
    expect(banners.showWarning).toBe(false);
    expect(banners.showTrial).toBe(false);
  });
});

describe("getTenantStatus — coerência com o desbloqueio local (0026F)", () => {
  it("validUntil e suspendedAt nulos nunca resultam em 'travada'", () => {
    expect(getTenantStatus({ validUntil: null, suspendedAt: null }, false)).toBe("testando");
    expect(getTenantStatus({ validUntil: null, suspendedAt: null }, true)).toBe("ativa");
  });
});
