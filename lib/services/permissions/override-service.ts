import { withUserRls } from "@/db/rls";
import { hasPermission } from "@/lib/auth/permissions";
import { verifyPassword } from "@/lib/auth/password";
import { selectPermissionCodes } from "@/lib/services/permissions/permission-data";
import {
  overrideCredentialsSchema,
  SENSITIVE_ACTIONS,
  type SensitiveActionCode,
} from "@/lib/validation/override";
import type { AuthContext } from "@/types/product";

import {
  insertOverrideLog,
  selectAuthorizerByEmail,
} from "./override-data";

/**
 * Resultado do gate de override (0014F/SF02). Sucesso traz o dado da ação original.
 * Falha pode sinalizar `overrideRequired` (UI abre o diálogo) ou ser um erro comum.
 */
export type OverrideResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      overrideRequired?: boolean;
      actionCode?: SensitiveActionCode;
      targetRef?: string;
    };

interface RunWithOverrideOptions<T> {
  actionCode: SensitiveActionCode;
  targetRef?: string;
  /** Credenciais do autorizador (do diálogo). Ausentes na 1ª tentativa. */
  credentials?: unknown;
  /** A ação original — roda UMA vez no caminho permitido/autorizado. */
  run: () => Promise<T>;
}

/**
 * Confere se o autorizador é válido: mesma loja, ativo, distinto do operador
 * bloqueado (RN02), `owner` ou com `gerenciar_usuarios`, e senha bcrypt correta.
 * Roda na conexão `db` (owner) — ver override-data. Retorna o userId ou null.
 */
async function validateAuthorizer(
  tenantId: string,
  actorUserId: string,
  email: string,
  password: string,
): Promise<string | null> {
  const row = await selectAuthorizerByEmail(tenantId, email);
  if (!row) return null;
  if (!row.isActive) return null; // RF04 — desativado não autoriza
  if (row.userId === actorUserId) return null; // RN02 — não pode ser o próprio operador

  // RF04 — papel: owner OU operador com 'gerenciar_usuarios'.
  let authorized = row.role === "owner";
  if (!authorized) {
    const codes = await selectPermissionCodes(tenantId, row.userId);
    authorized = codes.includes("gerenciar_usuarios");
  }
  if (!authorized) return null;

  // RF05 — senha conferida ANTES de qualquer mutação.
  const passwordOk = await verifyPassword(password, row.passwordHash);
  if (!passwordOk) return null;

  return row.userId;
}

/**
 * Gate de override síncrono e reutilizável (RF01/RF06). Fluxo:
 *  1. Operador tem o código? → roda a ação direto, SEM log (não é exceção).
 *  2. Não tem + sem credenciais → sinal `overrideRequired` (UI abre o diálogo).
 *  3. Não tem + credenciais → valida o autorizador; inválido → erro SEM mutação;
 *     válido → roda a ação (autoria do operador) e grava `override_log` (RF07).
 */
export async function runWithOverride<T>(
  ctx: AuthContext,
  opts: RunWithOverrideOptions<T>,
): Promise<OverrideResult<T>> {
  const { actionCode, targetRef, credentials, run } = opts;
  const permissionCode = SENSITIVE_ACTIONS[actionCode];

  // 1. Operador autorizado pelo próprio código (ou owner) — sem override.
  if (await hasPermission(ctx, permissionCode)) {
    return { ok: true, data: await run() };
  }

  // 2. Sem credenciais → sinaliza que o override é necessário.
  if (credentials == null) {
    return {
      ok: false,
      overrideRequired: true,
      actionCode,
      targetRef,
      error: "Esta ação exige autorização de um administrador.",
    };
  }

  // 3. Credenciais presentes → valida o autorizador.
  const parsed = overrideCredentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Credenciais inválidas.",
    };
  }

  const authorizerUserId = await validateAuthorizer(
    ctx.tenantId,
    ctx.userId,
    parsed.data.authorizerEmail,
    parsed.data.password,
  );
  if (!authorizerUserId) {
    // RF05/RF08/RN01 — sem mutação, sem log.
    return {
      ok: false,
      error: "Autorização negada: administrador, senha ou permissão inválidos.",
    };
  }

  // Autorizado: roda a ação (autoria = operador) e grava o log (RF06/RF07).
  const data = await run();
  await withUserRls(ctx.userId, (tx) =>
    insertOverrideLog(tx, {
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      authorizerUserId,
      actionCode,
      targetRef: targetRef ?? null,
    }),
  );
  return { ok: true, data };
}
