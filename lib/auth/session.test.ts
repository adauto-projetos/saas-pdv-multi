import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dos cookies do Next com um store em memória.
const store = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      store.has(name) ? { name, value: store.get(name)! } : undefined,
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
  }),
}));

import { createSession, destroySession, getAuthUser } from "./session";

beforeEach(() => store.clear());

describe("session (cookie assinado)", () => {
  it("createSession + getAuthUser faz round-trip", async () => {
    await createSession("user-1");
    expect(await getAuthUser()).toEqual({ id: "user-1" });
  });

  it("sem cookie retorna null", async () => {
    expect(await getAuthUser()).toBeNull();
  });

  it("token adulterado retorna null", async () => {
    await createSession("user-1");
    const value = store.get("pdv_session")!;
    const tampered = value.slice(0, -1) + (value.endsWith("a") ? "b" : "a");
    store.set("pdv_session", tampered);
    expect(await getAuthUser()).toBeNull();
  });

  it("destroySession remove a sessão", async () => {
    await createSession("user-1");
    await destroySession();
    expect(await getAuthUser()).toBeNull();
  });
});
