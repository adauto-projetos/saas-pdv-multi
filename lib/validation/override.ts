import { z } from "zod";

import type { PermissionCode } from "@/lib/validation/usuarios";

/**
 * Catálogo de ações sensíveis e schema das credenciais do autorizador (0014F/SF02).
 * Cada ação sensível mapeia para o código de permissão que normalmente a libera;
 * quando o operador não tem o código, o override pede a senha de um Administrador.
 */

/** Ações sensíveis do MVP → código de permissão correspondente (SF01). */
export const SENSITIVE_ACTIONS = {
  cancelar_comanda: "comanda",
  remover_item_comanda: "comanda",
  fechar_caixa: "caixa",
} satisfies Record<string, PermissionCode>;

export type SensitiveActionCode = keyof typeof SENSITIVE_ACTIONS;

export const sensitiveActionCodeSchema = z.enum(
  Object.keys(SENSITIVE_ACTIONS) as [SensitiveActionCode, ...SensitiveActionCode[]],
);

/**
 * Credenciais do autorizador enviadas pelo diálogo de override (RF02): email de
 * identificação + senha. Validadas no servidor antes de qualquer mutação (RN01).
 */
export const overrideCredentialsSchema = z.object({
  authorizerEmail: z.email("Informe o e-mail do administrador"),
  password: z.string().min(1, "Informe a senha do administrador"),
});

export type OverrideCredentials = z.infer<typeof overrideCredentialsSchema>;
