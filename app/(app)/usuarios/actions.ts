"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { requireAuthContext } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/permissions";
import { requireActiveTenant } from "@/lib/auth/tenant-guard";
import type { ActionResult } from "@/lib/services/errors";
import { toActionError } from "@/lib/services/errors";
import {
  changeOwnPassword,
  createOperator,
  deactivateOperator,
  listOperators,
  reactivateOperator,
  resetOperatorPassword,
  updateOperator,
  updateOperatorPermissions,
} from "@/lib/services/users/operator-service";
import {
  changeOwnPasswordSchema,
  createOperatorSchema,
  operatorIdSchema,
  resetOperatorPasswordSchema,
  updateOperatorPermissionsSchema,
  updateOperatorSchema,
} from "@/lib/validation/usuarios";
import type { OperatorDto } from "@/types/usuarios";

/** Mapeia erros do zod para { campo: mensagem } (mesmo padrão de produtos). */
function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** RF03 — lista operadores da loja. Gate: gerenciar_usuarios (RF10). */
export async function listOperatorsAction(): Promise<
  ActionResult<OperatorDto[]>
> {
  try {
    const ctx = await requireAuthContext();
    await requirePermission(ctx, "gerenciar_usuarios");
    return { ok: true, data: await listOperators(ctx) };
  } catch (error) {
    return toActionError(error);
  }
}

/** RF03/RF05/RN02 — cria operador com permissões. */
export async function createOperatorAction(
  input: unknown,
): Promise<ActionResult<OperatorDto>> {
  const parsed = createOperatorSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os campos do formulário.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    await requirePermission(ctx, "gerenciar_usuarios");
    const operator = await createOperator(ctx, parsed.data);
    revalidatePath("/usuarios");
    return { ok: true, data: operator };
  } catch (error) {
    return toActionError(error);
  }
}

/** Edita nome/email do operador (RF12: owner intocável). */
export async function updateOperatorAction(
  input: unknown,
): Promise<ActionResult<true>> {
  const parsed = updateOperatorSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os campos do formulário.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    await requirePermission(ctx, "gerenciar_usuarios");
    await updateOperator(ctx, parsed.data);
    revalidatePath("/usuarios");
    return { ok: true, data: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Regrava permissões do operador (RF05/RF13). */
export async function updateOperatorPermissionsAction(
  input: unknown,
): Promise<ActionResult<true>> {
  const parsed = updateOperatorPermissionsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira as permissões.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    await requirePermission(ctx, "gerenciar_usuarios");
    await updateOperatorPermissions(ctx, parsed.data);
    revalidatePath("/usuarios");
    return { ok: true, data: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Desativa o operador (RF14/RN05). */
export async function deactivateOperatorAction(
  input: unknown,
): Promise<ActionResult<true>> {
  const parsed = operatorIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Operador inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    await requirePermission(ctx, "gerenciar_usuarios");
    await deactivateOperator(ctx, parsed.data.userId);
    revalidatePath("/usuarios");
    return { ok: true, data: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Reativa o operador (RF16). */
export async function reactivateOperatorAction(
  input: unknown,
): Promise<ActionResult<true>> {
  const parsed = operatorIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Operador inválido." };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    await requirePermission(ctx, "gerenciar_usuarios");
    await reactivateOperator(ctx, parsed.data.userId);
    revalidatePath("/usuarios");
    return { ok: true, data: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Dono reseta a senha do operador para nova provisória (RF08/RN03). */
export async function resetOperatorPasswordAction(
  input: unknown,
): Promise<ActionResult<true>> {
  const parsed = resetOperatorPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira a nova senha.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const ctx = await requireAuthContext();
    await requireActiveTenant(ctx.tenantId);
    await requirePermission(ctx, "gerenciar_usuarios");
    await resetOperatorPassword(ctx, parsed.data);
    return { ok: true, data: true };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * RF08 — operador troca a PRÓPRIA senha ("Meu perfil"). Não exige
 * gerenciar_usuarios: é ação sobre si mesmo, qualquer usuário logado pode.
 */
export async function changeOwnPasswordAction(
  input: unknown,
): Promise<ActionResult<true>> {
  const parsed = changeOwnPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os campos.",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const ctx = await requireAuthContext();
    await changeOwnPassword(ctx, parsed.data);
    return { ok: true, data: true };
  } catch (error) {
    return toActionError(error);
  }
}
