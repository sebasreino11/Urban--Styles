import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { BookingInput } from "@/lib/validation/booking";
import { fromDbError } from "./errors";
import type { Booking } from "./types";

/**
 * Reserva hecha por el staff (teléfono / mostrador). Usa la sesión del
 * usuario: book_appointment verifica en la BD que pertenezca a la barbería.
 * Mismas reglas de disponibilidad que la reserva pública.
 */
export async function createBookingAsStaff(shopId: string, b: BookingInput): Promise<Booking> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_shop: shopId,
    p_service: b.serviceId,
    p_starts_at: b.startsAt,
    p_customer_name: b.name,
    p_customer_email: b.email,
    p_barber: b.barberId,
    p_customer_phone: b.phone,
    p_source: "staff",
  });
  if (error) throw fromDbError(error);
  return data as Booking;
}
