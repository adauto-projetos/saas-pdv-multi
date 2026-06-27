import { requireAuthContext } from "@/lib/auth";
import { requirePermission } from "@/lib/auth/permissions";
import { AppError, NotFoundError, ValidationError } from "@/lib/services/errors";
import * as service from "@/lib/services/products/product-service";
import { uploadProductImageSchema } from "@/lib/validation/storage";

/**
 * Upload/troca da foto de um produto (feature 0016F). Recebe `multipart/form-data`
 * com o campo `file` e responde `{ imageUrl }`. Primeiro route handler do repo —
 * é a única camada que conhece HTTP: traduz erros de domínio em status codes.
 *
 * sharp precisa do runtime Node (não edge) — daí o `runtime = "nodejs"`.
 */
export const runtime = "nodejs";

/** Resposta de erro padronizada (ApiErrorDto): `{ error }`. */
function errorJson(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // params é uma Promise no Next 15+/16.
  const { id } = await params;

  // 1. Autenticação (401) e autorização (403) — antes de tocar no corpo.
  let ctx;
  try {
    ctx = await requireAuthContext();
  } catch {
    return errorJson("Sessão inválida ou expirada", 401);
  }
  try {
    await requirePermission(ctx, "produtos");
  } catch {
    return errorJson("Permissão necessária para esta ação", 403);
  }

  // 2. Lê o FormData e valida (400). MIME é falsificável — a checagem real (imagem
  //    de verdade, RN05) acontece no image-service via sharp.
  let file: unknown;
  try {
    const form = await req.formData();
    file = form.get("file");
  } catch {
    return errorJson("Requisição inválida", 400);
  }

  const parsed = uploadProductImageSchema.safeParse({ id, file });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Arquivo inválido";
    return errorJson(message, 400);
  }

  // 3. Processa + persiste. Mapeia erros de domínio para status HTTP.
  try {
    const bytes = Buffer.from(await parsed.data.file.arrayBuffer());
    const product = await service.uploadProductImage(ctx, parsed.data.id, bytes);
    return Response.json({ imageUrl: product.imageUrl }, { status: 200 });
  } catch (error) {
    if (error instanceof NotFoundError) return errorJson(error.message, 404);
    if (error instanceof ValidationError) return errorJson(error.message, 400);
    if (error instanceof AppError) return errorJson(error.message, 400);
    return errorJson("Falha ao enviar a foto. Tente novamente.", 500);
  }
}
