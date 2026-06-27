import { describe, expect, it } from "vitest";

import {
  overrideCredentialsSchema,
  SENSITIVE_ACTIONS,
  sensitiveActionCodeSchema,
} from "./override";

describe("catálogo de ações sensíveis (RF03)", () => {
  it("contém as 3 ações do MVP mapeadas ao código de permissão", () => {
    expect(SENSITIVE_ACTIONS).toEqual({
      cancelar_comanda: "comanda",
      remover_item_comanda: "comanda",
      fechar_caixa: "caixa",
    });
  });

  it("zod aceita um código de ação do catálogo", () => {
    expect(sensitiveActionCodeSchema.safeParse("fechar_caixa").success).toBe(true);
  });

  it("zod rejeita um código fora do catálogo", () => {
    expect(sensitiveActionCodeSchema.safeParse("apagar_loja").success).toBe(false);
  });
});

describe("credenciais do autorizador (RF02)", () => {
  it("aceita email + senha válidos", () => {
    const r = overrideCredentialsSchema.safeParse({
      authorizerEmail: "admin@example.com",
      password: "secret1",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita senha vazia", () => {
    const r = overrideCredentialsSchema.safeParse({
      authorizerEmail: "admin@example.com",
      password: "",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita email inválido", () => {
    const r = overrideCredentialsSchema.safeParse({
      authorizerEmail: "não-email",
      password: "secret1",
    });
    expect(r.success).toBe(false);
  });
});
