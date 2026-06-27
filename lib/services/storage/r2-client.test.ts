// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocka o SDK da AWS — nenhuma chamada de rede. Captura a config do S3Client e o send.
const sendMock = vi.fn(async () => ({}));
const ctorArgs: unknown[] = [];

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    constructor(args: unknown) {
      ctorArgs.push(args);
    }
    send = sendMock;
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

import * as r2 from "./r2-client";

const ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_URL",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  r2.__resetForTests();
  sendMock.mockClear();
  ctorArgs.length = 0;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  r2.__resetForTests();
});

function setEnv(): void {
  process.env.R2_ACCOUNT_ID = "acc123";
  process.env.R2_BUCKET = "bucket1";
  process.env.R2_ACCESS_KEY_ID = "key1";
  process.env.R2_SECRET_ACCESS_KEY = "secret1";
  process.env.R2_PUBLIC_URL = "https://cdn.example";
}

describe("r2-client (RNF02)", () => {
  it("T23 — lê credenciais do process.env e monta o endpoint da conta", async () => {
    setEnv();
    await r2.put("t1/x.webp", Buffer.from("data"), "image/webp");
    expect(sendMock).toHaveBeenCalledOnce();
    const args = ctorArgs[0] as {
      endpoint: string;
      region: string;
      credentials: { accessKeyId: string; secretAccessKey: string };
    };
    expect(args.endpoint).toBe("https://acc123.r2.cloudflarestorage.com");
    expect(args.region).toBe("auto");
    expect(args.credentials.accessKeyId).toBe("key1");
    expect(args.credentials.secretAccessKey).toBe("secret1");
  });

  it("T23 — falha graciosamente quando as vars R2 estão ausentes (sem valor hardcoded)", async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    r2.__resetForTests();
    await expect(
      r2.put("t1/x.webp", Buffer.from("data"), "image/webp"),
    ).rejects.toThrow(/Configuração do R2 ausente/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("publicUrl compõe PUBLIC_URL + key", () => {
    setEnv();
    expect(r2.publicUrl("t1/abc.webp")).toBe("https://cdn.example/t1/abc.webp");
  });

  it("del envia DeleteObjectCommand para o bucket configurado", async () => {
    setEnv();
    await r2.del("t1/abc.webp");
    expect(sendMock).toHaveBeenCalledOnce();
  });
});
