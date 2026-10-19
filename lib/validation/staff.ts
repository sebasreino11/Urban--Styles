import { z } from "zod";

/** Esquemas de los formularios del portal de staff (barbero y admin). */

const uuid = z.guid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const time = z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const appointmentStatusSchema = z.object({
  id: uuid,
  status: z.enum(["completed", "cancelled", "no_show"]),
  reason: optionalText(300),
});

export const timeOffRequestSchema = z
  .object({
    barberId: uuid,
    fromDate: date,
    toDate: date,
    allDay: z.boolean(),
    fromTime: time.optional(),
    toTime: time.optional(),
    reason: z.string().trim().min(3, "Explica brevemente el motivo").max(500),
  })
  .refine((v) => v.allDay || (v.fromTime && v.toTime), {
    message: "Indica la hora de inicio y fin",
    path: ["fromTime"],
  });

export const reviewTimeOffSchema = z.object({
  id: uuid,
  approve: z.boolean(),
  note: optionalText(300),
});

export const hookUrlSchema = z.object({
  hookUrl: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^https:\/\/hooknotifier\.com\/[^/\s]+\/[^/\s]+\/?$/.test(v),
      "Pega la URL completa de Hook.Notifier (https://hooknotifier.com/…/…)",
    ),
});

export const serviceSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "Nombre muy corto").max(80),
  description: optionalText(200),
  durationMin: z.coerce.number().int().min(5, "Mínimo 5 minutos").max(480),
  priceCop: z.coerce.number().int().min(0, "El precio no puede ser negativo"),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().default(0),
});

const range = z
  .object({ start: time, end: time })
  .refine((r) => r.end > r.start, { message: "La hora de cierre debe ser posterior a la de apertura" });

/** Horario semanal: por día (0 = domingo) una lista de franjas. */
export const weeklyHoursSchema = z.record(z.string().regex(/^[0-6]$/), z.array(range));

export const shopProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: optionalText(140),
  about: optionalText(1200),
  phone: optionalText(30),
  whatsapp: optionalText(30),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .pipe(z.email().nullable()),
  address: optionalText(160),
  city: optionalText(80),
  mapsUrl: optionalText(500),
  instagramUrl: optionalText(200),
  slotIntervalMin: z.coerce.number().int().min(5).max(60),
  bookingHorizonDays: z.coerce.number().int().min(1).max(180),
  minNoticeMin: z.coerce.number().int().min(0).max(2880),
  cancelNoticeMin: z.coerce.number().int().min(0).max(2880),
});

export const barberProfileSchema = z.object({
  id: uuid,
  displayName: z.string().trim().min(2).max(60),
  bio: optionalText(300),
  photoUrl: optionalText(500),
  active: z.boolean(),
  serviceIds: z.array(uuid),
});

export const inviteStaffSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Correo inválido" })),
  displayName: z.string().trim().min(2, "Escribe el nombre").max(60),
  isAdmin: z.boolean(),
  isBarber: z.boolean(),
}).refine((v) => v.isAdmin || v.isBarber, { message: "Elige al menos un rol", path: ["isBarber"] });

export const memberRolesSchema = z.object({
  membershipId: uuid,
  isAdmin: z.boolean(),
  isBarber: z.boolean(),
  active: z.boolean(),
});
