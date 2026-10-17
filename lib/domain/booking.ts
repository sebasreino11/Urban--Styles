import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnonClient } from "@/lib/supabase/anon";
import {
  bookingInputSchema,
  cancelTokenSchema,
  daysQuerySchema,
  slotsQuerySchema,
  type BookingInput,
  type DaysQuery,
  type SlotsQuery,
} from "@/lib/validation/booking";
import { DomainError, fromDbError } from "./errors";
import type { Booking, BookingSource, Slot, TokenAppointment } from "./types";

/**
 * LÓGICA DE RESERVA REUTILIZABLE
 *
 * Estas funciones no conocen formularios, React ni HTTP. Las llaman:
 *   - app/(public)/actions.ts   (formulario web)
 *   - app/api/v1/**             (API pública / futuro webhook de WhatsApp)
 * La autoridad final es Postgres (get_available_slots / book_appointment).
 * Las notificaciones son aparte (./notifications.ts) para que cada canal
 * decida cuándo enviarlas (p. ej. con `after()` en Next).
 */

export async function getAvailableSlots(shopId: string, query: SlotsQuery): Promise<Slot[]> {
  const q = slotsQuerySchema.parse(query);
  const { data, error } = await createAnonClient().rpc("get_available_slots", {
    p_shop: shopId,
    p_service: q.serviceId,
    p_date: q.date,
    p_barber: q.barberId,
  });
  if (error) throw fromDbError(error);
  return (data as { slot_start: string; slot_end: string; barber_ids: string[] }[]).map((s) => ({
    startsAt: new Date(s.slot_start).toISOString(),
    endsAt: new Date(s.slot_end).toISOString(),
    barberIds: s.barber_ids,
  }));
}

export async function getAvailableDays(
  shopId: string,
  query: DaysQuery,
): Promise<{ day: string; slotCount: number }[]> {
  const q = daysQuerySchema.parse(query);
  const { data, error } = await createAnonClient().rpc("get_available_days", {
    p_shop: shopId,
    p_service: q.serviceId,
    p_from: q.from,
    p_to: q.to,
    p_barber: q.barberId,
  });
  if (error) throw fromDbError(error);
  return (data as { day: string; slot_count: number }[]).map((d) => ({
    day: d.day,
    slotCount: d.slot_count,
  }));
}

/**
 * Crea una cita. El llamador es responsable de haber verificado al humano
 * (Turnstile en web; firma del proveedor en WhatsApp).
 */
export async function createBooking(
  shopId: string,
  input: BookingInput,
  source: BookingSource = "web",
): Promise<Booking> {
  const parsed = bookingInputSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("VALIDATION");
  const b = parsed.data;

  const { data, error } = await createAdminClient().rpc("book_appointment", {
    p_shop: shopId,
    p_service: b.serviceId,
    p_starts_at: b.startsAt,
    p_customer_name: b.name,
    p_customer_email: b.email,
    p_barber: b.barberId,
    p_customer_phone: b.phone,
    p_source: source,
  });
  if (error) throw fromDbError(error);
  return data as Booking;
}

export async function getBookingByToken(token: string): Promise<TokenAppointment | null> {
  if (!cancelTokenSchema.safeParse(token).success) return null;
  const { data, error } = await createAdminClient().rpc("get_appointment_by_token", {
    p_token: token,
  });
  if (error) throw fromDbError(error);
  return (data as TokenAppointment | null) ?? null;
}

export async function cancelBookingByToken(token: string): Promise<TokenAppointment> {
  if (!cancelTokenSchema.safeParse(token).success) throw new DomainError("APPOINTMENT_NOT_FOUND");
  const { data, error } = await createAdminClient().rpc("cancel_appointment_by_token", {
    p_token: token,
  });
  if (error) throw fromDbError(error);
  return data as TokenAppointment;
}
