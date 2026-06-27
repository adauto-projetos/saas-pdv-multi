import { describe, expect, it } from "vitest";

import {
  createOperatorSchema,
  PERMISSION_CODES,
  PERMISSION_PRESETS,
  permissionCodeSchema,
} from "./usuarios";

describe("catálogo de permissões (RN01)", () => {
  it("tem exatamente os 8 códigos do catálogo", () => {
    expect(PERMISSION_CODES).toHaveLength(8);
    expect([...PERMISSION_CODES]).toEqual([
      "vendas",
      "comanda",
      "caixa",
      "produtos",
      "estoque",
      "financeiro",
      "loja",
      "gerenciar_usuarios",
    ]);
  });

  it("zod aceita um código válido do catálogo", () => {
    expect(permissionCodeSchema.safeParse("vendas").success).toBe(true);
  });

  it("zod rejeita um código fora do catálogo (RN01)", () => {
    expect(permissionCodeSchema.safeParse("superpoder").success).toBe(false);
    expect(permissionCodeSchema.safeParse("admin").success).toBe(false);
  });
});

describe("presets (RF06)", () => {
  it("preset Caixa = vendas + comanda", () => {
    expect(PERMISSION_PRESETS.caixa).toEqual(["vendas", "comanda"]);
  });

  it("preset Gerente = tudo menos loja", () => {
    expect(PERMISSION_PRESETS.gerente).not.toContain("loja");
    expect(new Set(PERMISSION_PRESETS.gerente)).toEqual(
      new Set(PERMISSION_CODES.filter((c) => c !== "loja")),
    );
  });

  it("todo preset só usa códigos válidos do catálogo", () => {
    for (const codes of Object.values(PERMISSION_PRESETS)) {
      for (const code of codes) {
        expect(PERMISSION_CODES).toContain(code);
      }
    }
  });
});

describe("createOperatorSchema (RN02)", () => {
  it("rejeita cadastro sem nenhuma permissão (RN02)", () => {
    const result = createOperatorSchema.safeParse({
      name: "João",
      email: "joao@example.com",
      password: "secret1",
      permissions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita senha com menos de 6 caracteres", () => {
    const result = createOperatorSchema.safeParse({
      name: "João",
      email: "joao@example.com",
      password: "123",
      permissions: ["vendas"],
    });
    expect(result.success).toBe(false);
  });

  it("aceita cadastro válido com ≥1 permissão", () => {
    const result = createOperatorSchema.safeParse({
      name: "João",
      email: "joao@example.com",
      password: "secret1",
      permissions: ["vendas", "comanda"],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita um código inválido dentro da lista de permissões (RN01)", () => {
    const result = createOperatorSchema.safeParse({
      name: "João",
      email: "joao@example.com",
      password: "secret1",
      permissions: ["vendas", "hackear"],
    });
    expect(result.success).toBe(false);
  });
});
