import { describe, expect, it } from "vitest";

import { MAX_UPLOAD_BYTES, uploadProductImageSchema } from "./storage";

const VALID_ID = "123e4567-e89b-12d3-a456-426614174000";

function fileOfSize(bytes: number, type = "image/jpeg"): File {
  return new File([new Uint8Array(bytes)], "x.jpg", { type });
}

describe("uploadProductImageSchema (RN06)", () => {
  it("T20 — rejeita arquivo acima de 5MB", () => {
    const file = fileOfSize(MAX_UPLOAD_BYTES + 1);
    const result = uploadProductImageSchema.safeParse({ id: VALID_ID, file });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Máximo 5 MB")).toBe(
        true,
      );
    }
  });

  it("T21 — rejeita arquivo vazio (0 bytes)", () => {
    const file = fileOfSize(0);
    const result = uploadProductImageSchema.safeParse({ id: VALID_ID, file });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Arquivo vazio")).toBe(
        true,
      );
    }
  });

  it("T21 — aceita arquivo não-vazio até 5MB", () => {
    const file = fileOfSize(4 * 1024 * 1024);
    const result = uploadProductImageSchema.safeParse({ id: VALID_ID, file });
    expect(result.success).toBe(true);
  });

  it("aceita exatamente no limite de 5MB (boundary)", () => {
    const file = fileOfSize(MAX_UPLOAD_BYTES);
    const result = uploadProductImageSchema.safeParse({ id: VALID_ID, file });
    expect(result.success).toBe(true);
  });

  it("rejeita id inválido", () => {
    const file = fileOfSize(1024);
    const result = uploadProductImageSchema.safeParse({ id: "not-a-uuid", file });
    expect(result.success).toBe(false);
  });

  it("rejeita quando file não é um File", () => {
    const result = uploadProductImageSchema.safeParse({
      id: VALID_ID,
      file: "string",
    });
    expect(result.success).toBe(false);
  });
});
