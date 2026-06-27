import { z } from "zod";

/**
 * Catálogo de permissões e schemas de operador (0014F/SF01). Os códigos são
 * `text` no banco (sem enum) para o catálogo crescer sem migração — a validação
 * vive aqui (RN01). Tenant/userId NUNCA vêm do cliente; vêm do AuthContext (RN05).
 */

/** Os 8 códigos de permissão granular do catálogo (RN01). */
export const PERMISSION_CODES = [
  "vendas",
  "comanda",
  "caixa",
  "produtos",
  "estoque",
  "financeiro",
  "loja",
  "gerenciar_usuarios",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

/** Rótulo de exibição de cada permissão (UI + mensagens de erro). */
export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  vendas: "Vendas",
  comanda: "Comanda",
  caixa: "Caixa",
  produtos: "Produtos",
  estoque: "Estoque",
  financeiro: "Financeiro",
  loja: "Loja",
  gerenciar_usuarios: "Gerenciar usuários",
};

/** Zod: só aceita um dos 8 códigos do catálogo (RN01). */
export const permissionCodeSchema = z.enum(PERMISSION_CODES);

/**
 * Presets de conjuntos comuns (RF06): pré-marcam a seleção, editável antes de salvar.
 * - Caixa: opera o balcão (vendas + comanda).
 * - Gerente: tudo MENOS "loja" (configurações sensíveis ficam só com o dono).
 */
export const PERMISSION_PRESETS = {
  caixa: ["vendas", "comanda"],
  gerente: [
    "vendas",
    "comanda",
    "caixa",
    "produtos",
    "estoque",
    "financeiro",
    "gerenciar_usuarios",
  ],
} satisfies Record<string, PermissionCode[]>;

export type PresetKey = keyof typeof PERMISSION_PRESETS;

const permissionsArray = z
  .array(permissionCodeSchema)
  .min(1, "Selecione ao menos uma permissão")
  .refine((codes) => new Set(codes).size === codes.length, {
    message: "Permissões duplicadas",
  });

/** RF03/RN02 — cria operador (nome, email, senha provisória, ≥1 permissão). */
export const createOperatorSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do operador"),
  email: z.email("E-mail inválido"),
  password: z.string().min(6, "A senha precisa de ao menos 6 caracteres"),
  permissions: permissionsArray,
});

/** Edição de dados cadastrais do operador (nome/email). */
export const updateOperatorSchema = z.object({
  userId: z.string().uuid("Operador inválido"),
  name: z.string().trim().min(1, "Informe o nome do operador"),
  email: z.email("E-mail inválido"),
});

/** Edição do conjunto de permissões do operador (RF05). */
export const updateOperatorPermissionsSchema = z.object({
  userId: z.string().uuid("Operador inválido"),
  permissions: permissionsArray,
});

/** Ativar/desativar/identificar um operador pelo userId (RF14/RF16). */
export const operatorIdSchema = z.object({
  userId: z.string().uuid("Operador inválido"),
});

/** RF08 — dono reseta a senha do operador para uma nova provisória. */
export const resetOperatorPasswordSchema = z.object({
  userId: z.string().uuid("Operador inválido"),
  password: z.string().min(6, "A senha precisa de ao menos 6 caracteres"),
});

/** RF08 — operador troca a própria senha em "Meu perfil". */
export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual"),
  newPassword: z.string().min(6, "A nova senha precisa de ao menos 6 caracteres"),
});

export type CreateOperatorInput = z.infer<typeof createOperatorSchema>;
export type UpdateOperatorInput = z.infer<typeof updateOperatorSchema>;
export type UpdateOperatorPermissionsInput = z.infer<
  typeof updateOperatorPermissionsSchema
>;
export type OperatorIdInput = z.infer<typeof operatorIdSchema>;
export type ResetOperatorPasswordInput = z.infer<
  typeof resetOperatorPasswordSchema
>;
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;
