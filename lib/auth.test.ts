import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnauthorizedError } from "@/lib/services/errors";

vi.mock("@/lib/auth/session", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/services/tenants/onboarding", () => ({
  getUserTenantId: vi.fn(),
}));

import { getAuthUser } from "@/lib/auth/session";
import { getUserTenantId } from "@/lib/services/tenants/onboarding";

import { requireAuthContext } from "./auth";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetUserTenantId = vi.mocked(getUserTenantId);

beforeEach(() => vi.resetAllMocks());

describe("requireAuthContext (RN05)", () => {
  it("lança Unauthorized sem sessão", async () => {
    mockedGetAuthUser.mockResolvedValue(null);
    await expect(requireAuthContext()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("lança Unauthorized sem loja associada", async () => {
    mockedGetAuthUser.mockResolvedValue({ id: "u1" });
    mockedGetUserTenantId.mockResolvedValue(null);
    await expect(requireAuthContext()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("retorna o contexto com userId + tenantId da sessão", async () => {
    mockedGetAuthUser.mockResolvedValue({ id: "u1" });
    mockedGetUserTenantId.mockResolvedValue("t1");
    expect(await requireAuthContext()).toEqual({ userId: "u1", tenantId: "t1" });
  });
});
