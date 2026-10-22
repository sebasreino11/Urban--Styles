"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import {
  cancelBookingByToken,
  createBooking,
  getAvailableDays,
  getAvailableSlots,
  getRescheduleDays,
  getRescheduleSlots,
  rescheduleBookingByToken,
} from "@/lib/domain/booking";
import { DomainError, toActionError, type ActionResult } from "@/lib/domain/errors";
import {
  notifyBookingCancelled,
  notifyBookingCreated,
  notifyBookingRescheduled,
} from "@/lib/domain/notifications";
import { resolveShop } from "@/lib/domain/shop";
import type { RescheduledAppointment, Slot, TokenAppointment } from "@/lib/domain/types";
import { addDays, localDate } from "@/lib/format";
import { verifyTurnstile } from "@/lib/turnstile";
import { bookingInputSchema } from "@/lib/validation/booking";

/*
 * Server Actions del portal público. Son adaptadores delgados: resuelven la
 * barbería por host, verifican al humano y delegan en lib/domain.
 */

async function currentShop() {
  const h = await headers();
  return resolveShop(h.get("x-forwarded-host") ?? h.get("host"));
}

export async function loadAvailableDays(
  serviceId: string,
  barberId: string | null,
  from: string,
  to: string,
): Promise<ActionResult<{ day: string; slotCount: number }[]>> {
  try {
    const shop = await currentShop();
    return { ok: true, data: await getAvailableDays(shop.id, { serviceId, barberId, from, to }) };
  } catch (e) {
    return toActionError(e);
  }
}

export async function loadAvailableSlots(
  serviceId: string,
  barberId: string | null,
  date: string,
): Promise<ActionResult<Slot[]>> {
  try {
    const shop = await currentShop();
    return { ok: true, data: await getAvailableSlots(shop.id, { serviceId, barberId, date }) };
  } catch (e) {
    return toActionError(e);
  }
}

export interface BookingConfirmation {
  barberName: string;
  serviceName: string;
  startsAt: string;
  priceCop: number;
  email: string;
  manageToken: string;
}

export async function submitBooking(
  raw: unknown,
  turnstileToken: string | null,
): Promise<ActionResult<BookingConfirmation>> {
  const parsed = bookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, code: "VALIDATION", message: "Revisa los datos del formulario.", fieldErrors };
  }

  try {
    const h = await headers();
    const human = await verifyTurnstile(turnstileToken, h.get("cf-connecting-ip"));
    if (!human) throw new DomainError("CAPTCHA_FAILED");

    const shop = await currentShop();
    const booking = await createBooking(shop.id, parsed.data, "web");

    // Correo + push después de responder: el cliente no espera por Resend.
    after(() => notifyBookingCreated(booking));

    return {
      ok: true,
      data: {
        barberName: booking.barber_name,
        serviceName: booking.service_name,
        startsAt: booking.starts_at,
        priceCop: booking.price_cop,
        email: booking.customer_email,
        manageToken: booking.cancel_token,
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}

export async function loadRescheduleDays(token: string): Promise<ActionResult<{ day: string; slotCount: number }[]>> {
  try {
    const shop = await currentShop();
    const today = localDate(new Date(), shop.timezone);
    const days = await getRescheduleDays(shop.id, token, {
      from: today,
      to: addDays(today, shop.booking_horizon_days),
    });
    return { ok: true, data: days };
  } catch (e) {
    return toActionError(e);
  }
}

export async function loadRescheduleSlots(token: string, date: string): Promise<ActionResult<Slot[]>> {
  try {
    const shop = await currentShop();
    return { ok: true, data: await getRescheduleSlots(shop.id, token, date) };
  } catch (e) {
    return toActionError(e);
  }
}

export async function rescheduleBooking(
  token: string,
  startsAt: string,
): Promise<ActionResult<RescheduledAppointment>> {
  try {
    const appt = await rescheduleBookingByToken(token, startsAt);
    after(() => notifyBookingRescheduled(appt.appointment_id, appt.previous_starts_at, token));
    return { ok: true, data: appt };
  } catch (e) {
    return toActionError(e);
  }
}

export async function cancelBooking(token: string): Promise<ActionResult<TokenAppointment>> {
  try {
    const appt = await cancelBookingByToken(token);
    after(() => notifyBookingCancelled(appt.appointment_id));
    return { ok: true, data: appt };
  } catch (e) {
    return toActionError(e);
  }
}
