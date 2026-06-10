import { describe, expect, it } from "vitest";

import {
  ConflictError,
  isUniqueViolation,
  NotFoundError,
  toActionError,
  ValidationError,
} from "./errors";

describe("toActionError", () => {
  it("ValidationError preserva fieldErrors", () => {
    const result = toActionError(new ValidationError("inválido", { name: "x" }));
    expect(result).toEqual({
      ok: false,
      error: "inválido",
      fieldErrors: { name: "x" },
    });
  });

  it("ConflictError vira fieldError do campo", () => {
    const result = toActionError(new ConflictError("duplicado", "barcode"));
    expect(result).toEqual({
      ok: false,
      error: "duplicado",
      fieldErrors: { barcode: "duplicado" },
    });
  });

  it("AppError genérico mapeia só a mensagem", () => {
    const result = toActionError(new NotFoundError("não achou"));
    expect(result).toEqual({ ok: false, error: "não achou" });
  });

  it("erro desconhecido vira mensagem genérica", () => {
    const result = toActionError(new Error("boom"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/inesperado/i);
  });
});

describe("isUniqueViolation", () => {
  it("detecta 23505 direto e via cause", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
    expect(isUniqueViolation({ cause: { cause: { code: "23505" } } })).toBe(true);
  });

  it("retorna false para outros erros", () => {
    expect(isUniqueViolation(new Error("x"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
