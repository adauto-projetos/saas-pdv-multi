"use server";

import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/services/errors";
import { isUniqueViolation } from "@/lib/services/errors";
import {
  createUserWithTenant,
  getUserByEmail,
} from "@/lib/services/tenants/onboarding";

const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

const signUpSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(6, "A senha precisa de ao menos 6 caracteres"),
  tenantName: z.string().trim().min(1, "Informe o nome da loja"),
});

export async function loginAction(
  input: unknown,
): Promise<ActionResult<{ userId: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const user = await getUserByEmail(parsed.data.email);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { ok: false, error: "E-mail ou senha inválidos." };
  }
  await createSession(user.id);
  return { ok: true, data: { userId: user.id } };
}

export async function signUpAction(
  input: unknown,
): Promise<ActionResult<{ tenantId: string }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (await getUserByEmail(parsed.data.email)) {
    return { ok: false, error: "Já existe uma conta com esse e-mail." };
  }
  const passwordHash = await hashPassword(parsed.data.password);
  try {
    const { userId, tenantId } = await createUserWithTenant(
      parsed.data.email,
      passwordHash,
      parsed.data.tenantName,
    );
    await createSession(userId);
    return { ok: true, data: { tenantId } };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "Já existe uma conta com esse e-mail." };
    }
    throw error;
  }
}

export async function logoutAction(): Promise<void> {
  await destroySession();
}
