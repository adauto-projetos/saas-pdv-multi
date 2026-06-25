import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnauthorizedError } from "@/lib/services/errors";

vi.mock("@/lib/auth/session", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/services/tenants/onboarding", () => ({
  getUserTenantId: vi.fn(),
}));
vi.mock("@/lib/auth/impersonation", () => ({
  getImpersonatedTenantId: vi.fn(),
}));
vi.mock("@/lib/services/subscriptions/repository", () => ({
  selectIsFounder: vi.fn(),
}));

import { getAuthUser } from "@/lib/auth/session";
import { getUserTenantId } from "@/lib/services/tenants/onboarding";
import { getImpersonatedTenantId } from "@/lib/auth/impersonation";
import { selectIsFounder } from "@/lib/services/subscriptions/repository";

import { requireAuthContext } from "./auth";

const mockedGetAuthUser = vi.mocked(getAuthUser);
const mockedGetUserTenantId = vi.mocked(getUserTenantId);
const mockedGetImpersonatedTenantId = vi.mocked(getImpersonatedTenantId);
const mockedSelectIsFounder = vi.mocked(selectIsFounder);

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetImpersonatedTenantId.mockResolvedValue(null);
  mockedSelectIsFounder.mockResolvedValue(false);
});

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

  it("T06 — founder sem loja própria + cookie impersona o tenant-alvo (SF03 RF11)", async () => {
    mockedGetAuthUser.mockResolvedValue({ id: "founder1" });
    mockedGetUserTenantId.mockResolvedValue(null);
    mockedGetImpersonatedTenantId.mockResolvedValue("tImp");
    mockedSelectIsFounder.mockResolvedValue(true);
    expect(await requireAuthContext()).toEqual({ userId: "founder1", tenantId: "tImp" });
  });

  it("T06b — não-founder com cookie de impersonação é ignorado (RN01)", async () => {
    mockedGetAuthUser.mockResolvedValue({ id: "u2" });
    mockedGetUserTenantId.mockResolvedValue(null);
    mockedGetImpersonatedTenantId.mockResolvedValue("tImp");
    mockedSelectIsFounder.mockResolvedValue(false);
    await expect(requireAuthContext()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
