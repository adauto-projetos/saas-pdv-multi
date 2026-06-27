import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { ValidationError } from "@/lib/services/errors";
import * as r2 from "@/lib/services/storage/r2-client";

/**
 * Pipeline de imagem da feature 0016F. Puro de HTTP: o route handler/service passa
 * bytes e recebe bytes/chaves de volta. Cobre:
 *  - RN05: validação real por magic bytes (sharp falha em não-imagem);
 *  - RNF01: resize para 600x600 *contain* (foto inteira, sem corte), sobra em fundo
 *    branco, convertido para WebP;
 *  - RN03/RN04: chave aleatória sob uma pasta por loja `<slug-da-loja>-<tenantId>/<uuid>.webp`;
 *  - RF06/RF09: ao trocar a foto, remove o arquivo antigo do R2 tolerando falha.
 */

/** Lado fixo do thumbnail quadrado (RNF01). */
export const IMAGE_SIZE = 600;
export const IMAGE_CONTENT_TYPE = "image/webp";

/**
 * Valida que `bytes` é uma imagem real (RN05) e a normaliza para WebP 600x600
 * contain com fundo branco (RNF01). Lança ValidationError em bytes não-imagem.
 */
export async function validateAndProcess(bytes: Buffer): Promise<Buffer> {
  // sharp lê os magic bytes; metadata() falha (ou não traz formato) se não for imagem.
  try {
    const meta = await sharp(bytes).metadata();
    if (!meta.format) {
      throw new ValidationError("Arquivo não é uma imagem válida");
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("Arquivo não é uma imagem válida");
  }

  return sharp(bytes)
    .resize(IMAGE_SIZE, IMAGE_SIZE, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .webp()
    .toBuffer();
}

/**
 * "Limpa" o nome da loja para uso seguro como pasta no R2: tira acentos, baixa caixa,
 * troca tudo que não é letra/dígito por hífen e apara as pontas. Limita o tamanho e
 * cai em "loja" se sobrar vazio (nome só com símbolos/emoji). É só a parte LEGÍVEL da
 * pasta — a unicidade vem do tenantId que vai junto (ver storeKeyPrefix).
 */
export function slugifyStore(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
  return slug || "loja";
}

/**
 * Prefixo (pasta) por loja: `<slug-legível>-<tenantId>`. O slug deixa a pasta
 * reconhecível no painel do R2; o tenantId (imutável e único) garante que duas lojas
 * de mesmo nome NUNCA se misturem e que renomear a loja não vaze entre tenants (RN03).
 */
export function storeKeyPrefix(storeName: string, tenantId: string): string {
  return `${slugifyStore(storeName)}-${tenantId}`;
}

/** Chave aleatória e imprevisível sob a pasta da loja (RN03/RN04). */
export function randomKey(keyPrefix: string): string {
  return `${keyPrefix}/${randomUUID()}.webp`;
}

/**
 * Pipeline completo de upload: valida+processa os bytes, grava no R2 sob uma chave
 * nova aleatória dentro da pasta da loja (`keyPrefix` = `<slug>-<tenantId>`), e — se
 * havia um arquivo antigo (`oldKey`) — tenta removê-lo, ENGOLINDO qualquer falha
 * (RF06 troca / RF09 tolera órfão). Retorna a chave e a URL pública da nova foto.
 */
export async function uploadImage(
  keyPrefix: string,
  bytes: Buffer,
  oldKey: string | null,
): Promise<{ key: string; url: string }> {
  const processed = await validateAndProcess(bytes);
  const key = randomKey(keyPrefix);
  await r2.put(key, processed, IMAGE_CONTENT_TYPE);

  if (oldKey && oldKey !== key) {
    await safeDelete(oldKey);
  }

  return { key, url: r2.publicUrl(key) };
}

/**
 * Remove um objeto do R2 tolerando falha (RF09): órfão raro é custo operacional
 * aceito — nunca derruba a operação principal (troca/remoção/exclusão de produto).
 */
export async function safeDelete(key: string): Promise<void> {
  try {
    await r2.del(key);
  } catch {
    // Tolerado por design (RF09): sem job de limpeza; arquivo órfão fica no bucket.
  }
}
