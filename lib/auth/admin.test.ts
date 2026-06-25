import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnauthorizedError } from "@/lib/services/errors";

vi.mock("@/lib/auth/session", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { db } from "@/db";
import { getAuthUser } from "@/lib/auth/session";

import { requireFounder } from "./admin";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedDb = vi.mocked(db);

beforeEach(() => vi.resetAllMocks());

function mockDbSelect(isFounder: boolean | undefined) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(isFounder !== undefined ? [{ isFounder }] : []),
  };
  mockedDb.select = vi.fn().mockReturnValue(chain);
}

describe("requireFounder (RF01)", () => {
  it("T01 — lança UnauthorizedError quando não autenticado", async () => {
    mockedGetAuthUser.mockResolvedValue(null);
    await expect(requireFounder()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("T02 — lança UnauthorizedError quando is_founder = false", async () => {
    mockedGetAuthUser.mockResolvedValue({ id: "u1" });
    mockDbSelect(false);
    await expect(requireFounder()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("T03 — resolve com { userId } quando is_founder = true", async () => {
    mockedGetAuthUser.mockResolvedValue({ id: "u1" });
    mockDbSelect(true);
    await expect(requireFounder()).resolves.toEqual({ userId: "u1" });
  });
});
