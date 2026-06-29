import { z } from "zod";

/** Login: e-mail válido + senha não-vazia (a verificação real é por hash). */
export const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

/** Cadastro de loja: cria usuário + tenant. Senha mínima de 6 caracteres (RN). */
export const signUpSchema = z.object({
  email: z.email("E-mail inválido"),
  password: z.string().min(6, "A senha precisa de ao menos 6 caracteres"),
  tenantName: z.string().trim().min(1, "Informe o nome da loja"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
