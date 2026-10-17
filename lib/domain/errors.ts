/**
 * Errores de negocio. Los códigos coinciden con los `raise exception` de
 * supabase/migrations/*_business_logic.sql.
 */
export const ERROR_MESSAGES = {
  SLOT_UNAVAILABLE: "Ese horario ya no está disponible. Elige otro, por favor.",
  SLOT_TAKEN: "Alguien acaba de reservar ese horario. Elige otro, por favor.",
  SHOP_NOT_FOUND: "No encontramos la barbería.",
  SERVICE_NOT_FOUND: "Ese servicio ya no está disponible.",
  APPOINTMENT_NOT_FOUND: "No encontramos la cita. Revisa el enlace de tu correo.",
  NOT_CANCELLABLE: "Esta cita ya no se puede cancelar.",
  TOO_LATE_TO_CANCEL: "Ya es muy tarde para cancelar en línea. Comunícate con la barbería.",
  INVALID_TRANSITION: "Ese cambio de estado no es válido.",
  APPOINTMENT_NOT_STARTED: "No puedes cerrar una cita que todavía no ha empezado.",
  OVERLAPPING_HOURS: "Hay franjas que se solapan o cuyo cierre es antes de la apertura.",
  LAST_ADMIN:"La barbería debe conservar al menos un administrador activo.",
  FORBIDDEN: "No tienes permiso para hacer esto.",
  CAPTCHA_FAILED: "No pudimos verificar que eres humano. Recarga la página e intenta de nuevo.",
  VALIDATION: "Revisa los datos del formulario.",
  UNKNOWN: "Algo salió mal. Intenta de nuevo en un momento.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "DomainError";
  }
}

/** Convierte un error de PostgREST/Postgres en DomainError. */
export function fromDbError(error: { message?: string; code?: string } | null): DomainError {
  const raw = error?.message ?? "";
  const code = (Object.keys(ERROR_MESSAGES) as ErrorCode[]).find((c) => raw.includes(c));
  if (code) return new DomainError(code);
  if (error?.code === "23P01") return new DomainError("SLOT_TAKEN");
  if (error?.code === "42501") return new DomainError("FORBIDDEN");
  console.error("Error de base de datos no mapeado:", error);
  return new DomainError("UNKNOWN");
}

/** Resultado serializable para Server Actions. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> };

export function toActionError(e: unknown): Extract<ActionResult, { ok: false }> {
  if (e instanceof DomainError) return { ok: false, code: e.code, message: e.message };
  console.error(e);
  return { ok: false, code: "UNKNOWN", message: ERROR_MESSAGES.UNKNOWN };
}
