import { z } from "zod";

/**
 * Filtro da tela de Auditoria (0014F/SF04). Espelha `profitFilterSchema`: todos os
 * campos opcionais, datas como string ISO (atalhos "hoje"/"turno" são montados na
 * UI e chegam como from/to). `operatorId` opcional restringe a um operador.
 */
export const auditFilterSchema = z.object({
  operatorId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type AuditFilterInput = z.infer<typeof auditFilterSchema>;
