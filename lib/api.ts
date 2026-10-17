import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainError, ERROR_MESSAGES } from "@/lib/domain/errors";

/** Utilidades de las API Routes /api/v1 (respuestas JSON consistentes). */

const STATUS: Partial<Record<keyof typeof ERROR_MESSAGES, number>> = {
  VALIDATION: 400,
  FORBIDDEN: 403,
  SHOP_NOT_FOUND: 404,
  SERVICE_NOT_FOUND: 404,
  APPOINTMENT_NOT_FOUND: 404,
  SLOT_UNAVAILABLE: 409,
  SLOT_TAKEN: 409,
  NOT_CANCELLABLE: 409,
  TOO_LATE_TO_CANCEL: 409,
};

export function apiError(e: unknown) {
  if (e instanceof z.ZodError) {
    return NextResponse.json({ error: { code: "VALIDATION", message: e.issues[0]?.message, issues: e.issues } }, { status: 400 });
  }
  if (e instanceof DomainError) {
    return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: STATUS[e.code] ?? 500 });
  }
  console.error(e);
  return NextResponse.json({ error: { code: "UNKNOWN", message: ERROR_MESSAGES.UNKNOWN } }, { status: 500 });
}

/**
 * Las escrituras por API exigen `Authorization: Bearer <INTEGRATION_API_KEY>`
 * (p. ej. el futuro bot de WhatsApp). Sin la variable, quedan deshabilitadas.
 */
export function requireIntegrationKey(request: Request) {
  const key = process.env.INTEGRATION_API_KEY;
  if (!key) throw new DomainError("FORBIDDEN", "La API de integraciones no está habilitada.");
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (given.length !== key.length || !timingSafeEqual(given, key)) throw new DomainError("FORBIDDEN");
}

function timingSafeEqual(a: string, b: string) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
