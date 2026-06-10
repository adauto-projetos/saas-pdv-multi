import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password (bcrypt)", () => {
  it("gera hash diferente da senha e verifica corretamente", async () => {
    const hash = await hashPassword("senha123");
    expect(hash).not.toBe("senha123");
    expect(await verifyPassword("senha123", hash)).toBe(true);
    expect(await verifyPassword("errada", hash)).toBe(false);
  });
});
