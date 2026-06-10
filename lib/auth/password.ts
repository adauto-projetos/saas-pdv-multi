import bcrypt from "bcryptjs";

/** Hash/verificação de senha com bcrypt (auth local, sem Supabase). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
