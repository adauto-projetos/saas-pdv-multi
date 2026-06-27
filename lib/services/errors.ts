/**
 * Erros de domínio tipados. As Server Actions os traduzem para resultados seguros
 * ({ ok: false, error, fieldErrors }) — nunca vazam stack/detalhes do banco ao cliente.
 */

export type ErrorCode =
  | "VALIDATION"
  | "CONFLICT"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "TENANT_LOCKED";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message, "VALIDATION");
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message, "CONFLICT");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Registro não encontrado") {
    super(message, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sessão inválida ou expirada") {
    super(message, "UNAUTHORIZED");
  }
}

/** Resultado seguro de uma Server Action. */
export type ActionResult<T> =
  | { ok: true; data: T; printWarning?: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      // Override de ação sensível (0014F/SF02): quando uma ação sensível falha por
      // falta de permissão, a action sinaliza que a UI deve abrir o diálogo de
      // autorização em vez de mostrar um erro seco. `actionCode`/`targetRef`
      // permitem reenviar a MESMA ação com as credenciais do autorizador.
      overrideRequired?: boolean;
      actionCode?: string;
      targetRef?: string;
    };

/** Código de erro do Postgres para violação de unique constraint. */
export const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: unknown): boolean {
  // O Drizzle embrulha o erro do Postgres (DrizzleQueryError); o SQLSTATE 23505
  // fica em `.cause`. Percorre a cadeia de causas.
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current != null; depth++) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: string }).code === PG_UNIQUE_VIOLATION
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Mapeia qualquer erro para um ActionResult seguro. */
export function toActionError<T>(error: unknown): ActionResult<T> {
  if (error instanceof ValidationError) {
    return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
  }
  if (error instanceof ConflictError) {
    return {
      ok: false,
      error: error.message,
      fieldErrors: error.field ? { [error.field]: error.message } : undefined,
    };
  }
  if (error instanceof AppError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Ocorreu um erro inesperado. Tente novamente." };
}
