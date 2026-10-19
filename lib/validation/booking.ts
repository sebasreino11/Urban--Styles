import { z } from "zod";

/**
 * Esquemas de entrada de la reserva pública. Compartidos por la Server Action
 * del formulario web y por /api/v1 (y a futuro por el bot de WhatsApp).
 * La BD vuelve a validar todo; esto solo da mensajes claros al usuario.
 */

const uuid = z.guid({ message: "Identificador inválido" });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");

export const slotsQuerySchema = z.object({
  serviceId: uuid,
  barberId: uuid.nullable().default(null),
  date: isoDate,
});

export const daysQuerySchema = z.object({
  serviceId: uuid,
  barberId: uuid.nullable().default(null),
  from: isoDate,
  to: isoDate,
});

export const bookingInputSchema = z.object({
  serviceId: uuid,
  barberId: uuid.nullable().default(null),
  startsAt: z.iso.datetime({ offset: true, message: "Horario inválido" }),
  name: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre")
    .max(80, "El nombre es muy largo"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: "Escribe un correo válido" }))
    .refine((v) => v.length <= 120, "El correo es muy largo"),
  phone: z
    .string()
    .trim()
    .max(30)
    .nullish()
    .transform((v) => (v ? v : null)),
});

export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
export type DaysQuery = z.infer<typeof daysQuerySchema>;
export type BookingInput = z.infer<typeof bookingInputSchema>;

export const cancelTokenSchema = z.string().regex(/^[0-9a-f]{64}$/, "Enlace inválido");
