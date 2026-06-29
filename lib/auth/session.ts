import crypto from "node:crypto";

import { cookies } from "next/headers";

/**
 * Sessão local: cookie httpOnly com o id do usuário assinado por HMAC-SHA256
 * (segredo em SESSION_SECRET). Sem Supabase — o cookie é a fonte da sessão; o
 * `id` resolvido aqui alimenta o contexto de auth e a RLS (RN05).
 */
const COOKIE_NAME = "pdv_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

const DEV_SECRET = "dev-insecure-secret-change-me";
const MIN_SECRET_LEN = 32;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  // Em produção a chave HMAC do cookie é a ÚNICA barreira contra forjar sessão
  // (account takeover total). Sem fail-fast, um deploy sem SESSION_SECRET cairia
  // num default público — qualquer um assinaria o cookie de qualquer usuário.
  if (process.env.NODE_ENV === "production") {
    if (!value || value.length < MIN_SECRET_LEN || value === DEV_SECRET) {
      throw new Error(
        `SESSION_SECRET ausente, fraco ou igual ao default de dev em produção. ` +
          `Defina uma chave aleatória com pelo menos ${MIN_SECRET_LEN} caracteres.`,
      );
    }
    return value;
  }
  return value ?? DEV_SECRET;
}

function sign(userId: string): string {
  const mac = crypto.createHmac("sha256", secret()).update(userId).digest("hex");
  return `${userId}.${mac}`;
}

function verify(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const userId = token.slice(0, idx);
  const mac = token.slice(idx + 1);
  const expected = crypto
    .createHmac("sha256", secret())
    .update(userId)
    .digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Usuário autenticado atual (da sessão), ou null. */
export async function getAuthUser(): Promise<{ id: string } | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = verify(token);
  return userId ? { id: userId } : null;
}
