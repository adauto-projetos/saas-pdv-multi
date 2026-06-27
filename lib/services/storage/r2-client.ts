import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Cliente do Cloudflare R2 (object storage S3-compatible) para as fotos de produto
 * (feature 0016F). Todas as credenciais vêm de variáveis de ambiente (RNF02) — nunca
 * hardcoded. O endpoint é montado a partir do account id da Cloudflare.
 *
 * Inicialização preguiçosa: o `S3Client` só é construído na primeira operação. Assim
 * o módulo importa sem crashar quando as vars R2 estão ausentes (ex.: build estático,
 * ambiente sem R2). A falha aparece — graciosamente — apenas no caminho de upload, que
 * a feature já degrada (RF08: foto opcional, cadastro não bloqueia).
 */

type R2Config = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
};

/** Lê e valida a config do R2 do `process.env` (RNF02). Lança se algo faltar. */
function readConfig(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicUrl = process.env.R2_PUBLIC_URL;

  const missing = Object.entries({
    R2_ACCOUNT_ID: accountId,
    R2_BUCKET: bucket,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_PUBLIC_URL: publicUrl,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(
      `Configuração do R2 ausente: ${missing.join(", ")} (defina em .env.local)`,
    );
  }

  return {
    accountId: accountId!,
    bucket: bucket!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    // Sem barra final — `publicUrl(key)` compõe `${publicUrl}/${key}`.
    publicUrl: publicUrl!.replace(/\/$/, ""),
  };
}

let cachedClient: { client: S3Client; config: R2Config } | null = null;

/** Constrói (uma vez) o S3Client apontado ao R2. Lança se a config estiver incompleta. */
function getClient(): { client: S3Client; config: R2Config } {
  if (cachedClient) return cachedClient;
  const config = readConfig();
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  cachedClient = { client, config };
  return cachedClient;
}

/** Grava (ou sobrescreve) o objeto sob `key`. `bytes` é o WebP já processado. */
export async function put(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const { client, config } = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
}

/** Remove o objeto sob `key` (RF06/RF07). */
export async function del(key: string): Promise<void> {
  const { client, config } = getClient();
  await client.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
  );
}

/** URL pública de exibição do objeto: `${R2_PUBLIC_URL}/${key}` (RN03). */
export function publicUrl(key: string): string {
  const { config } = getClient();
  return `${config.publicUrl}/${key}`;
}

/** Reseta o cliente memoizado — usado só em testes ao trocar as vars de ambiente. */
export function __resetForTests(): void {
  cachedClient = null;
}
