// @vitest-environment node
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ValidationError } from "@/lib/services/errors";

// Mocka o cliente R2 — sem rede. put resolve; del é controlado por teste.
vi.mock("@/lib/services/storage/r2-client", () => ({
  put: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
  publicUrl: vi.fn((key: string) => `https://cdn.example/${key}`),
}));

import * as r2 from "@/lib/services/storage/r2-client";

import {
  IMAGE_SIZE,
  randomKey,
  slugifyStore,
  storeKeyPrefix,
  uploadImage,
  validateAndProcess,
} from "./image-service";

const TENANT = "t1";

/** Gera um PNG real (magic bytes válidos) de dimensões dadas. */
async function realPng(w = 1200, h = 800): Promise<Buffer> {
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer();
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("validateAndProcess (RN05/RNF01)", () => {
  it("T18 — aceita imagem real (magic bytes válidos)", async () => {
    const out = await validateAndProcess(await realPng());
    expect(out.length).toBeGreaterThan(0);
  });

  it("T19 — rejeita bytes que não são imagem (ValidationError)", async () => {
    await expect(
      validateAndProcess(Buffer.from("not an image")),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("T22 — saída é exatamente 600x600 WebP (contain)", async () => {
    const out = await validateAndProcess(await realPng(1200, 800));
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(IMAGE_SIZE);
    expect(meta.height).toBe(IMAGE_SIZE);
  });
});

describe("slugifyStore / storeKeyPrefix (RN03 — pasta por loja)", () => {
  it("limpa acento, espaço e caixa", () => {
    expect(slugifyStore("Açaí & Cia")).toBe("acai-cia");
    expect(slugifyStore("Bar do Zé")).toBe("bar-do-ze");
  });

  it("cai em 'loja' quando o nome só tem símbolos/emoji", () => {
    expect(slugifyStore("🍧🍧")).toBe("loja");
    expect(slugifyStore("   ")).toBe("loja");
  });

  it("monta a pasta <slug>-<tenantId> (única por loja)", () => {
    const prefix = storeKeyPrefix("Loja A", TENANT);
    expect(prefix).toBe(`loja-a-${TENANT}`);
  });

  it("duas lojas de mesmo nome não colidem (tenantId garante unicidade)", () => {
    expect(storeKeyPrefix("Bar do Zé", "t1")).not.toBe(
      storeKeyPrefix("Bar do Zé", "t2"),
    );
  });
});

describe("randomKey (RN03/RN04)", () => {
  it("T15/T17 — gera chave sob a pasta e chaves distintas", () => {
    const prefix = storeKeyPrefix("Loja A", TENANT);
    const k1 = randomKey(prefix);
    const k2 = randomKey(prefix);
    expect(k1.startsWith(`${prefix}/`)).toBe(true);
    expect(k1.endsWith(".webp")).toBe(true);
    expect(k1).not.toBe(k2);
  });
});

describe("uploadImage (RF06/RF09)", () => {
  it("T07 — grava no R2 e deleta a chave antiga quando presente", async () => {
    const { key, url } = await uploadImage(TENANT, await realPng(), "t1/old.webp");
    expect(r2.put).toHaveBeenCalledOnce();
    expect(r2.del).toHaveBeenCalledWith("t1/old.webp");
    expect(key.startsWith(`${TENANT}/`)).toBe(true);
    expect(url).toBe(`https://cdn.example/${key}`);
  });

  it("não deleta nada quando não há chave antiga", async () => {
    await uploadImage(TENANT, await realPng(), null);
    expect(r2.put).toHaveBeenCalledOnce();
    expect(r2.del).not.toHaveBeenCalled();
  });

  it("T11 — falha ao deletar a chave antiga é tolerada (RF09)", async () => {
    vi.mocked(r2.del).mockRejectedValueOnce(new Error("R2 down"));
    const result = await uploadImage(TENANT, await realPng(), "t1/old.webp");
    // Operação principal conclui; nova referência persiste apesar da falha no delete.
    expect(result.key.startsWith(`${TENANT}/`)).toBe(true);
    expect(r2.put).toHaveBeenCalledOnce();
  });
});
