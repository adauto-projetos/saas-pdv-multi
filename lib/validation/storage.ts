import { z } from "zod";

/** Tamanho máximo de upload: 5 MB por arquivo (RN06). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Conjunto grosseiro de MIME types aceitos. NÃO é a validação autoritativa: o MIME
 * informado pelo cliente é falsificável (RN05). A checagem real de "é imagem mesmo"
 * acontece no image-service via sharp (magic bytes). Este whitelist só barra cedo o
 * obviamente errado, sem confiar nele para segurança.
 */
export const ACCEPTED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/**
 * Valida o FormData do upload (RN06): id de produto válido + arquivo não vazio e
 * ≤5MB. O tipo real (imagem de verdade, RN05) é verificado depois no image-service
 * por magic bytes — aqui só checamos presença/tamanho, que é o que o handler HTTP
 * consegue afirmar com segurança.
 */
export const uploadProductImageSchema = z.object({
  id: z.uuid("Produto inválido"),
  file: z
    .instanceof(File, { message: "Arquivo obrigatório" })
    .refine((f) => f.size > 0, "Arquivo vazio")
    .refine((f) => f.size <= MAX_UPLOAD_BYTES, "Máximo 5 MB"),
});

/** Entrada da server action de remover foto (RF02): só o id do produto. */
export const imageRemoveSchema = z.object({
  id: z.uuid("Produto inválido"),
});

export type UploadProductImageInput = z.infer<typeof uploadProductImageSchema>;
export type ImageRemoveInput = z.infer<typeof imageRemoveSchema>;
