import type { PermissionCode } from "@/lib/validation/usuarios";

/**
 * DTO de operador exposto à UI (0014F/SF01). `permissions` é o conjunto de códigos
 * concedidos (vazio para o owner, que tem tudo implícito). `isOwner` distingue o
 * dono — a UI não permite editar/desativar (RF12).
 */
export type OperatorDto = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  isOwner: boolean;
  isActive: boolean;
  permissions: PermissionCode[];
  createdAt: string;
};
