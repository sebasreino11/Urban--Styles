import "server-only";
import { bookingConfirmationEmail, bookingRescheduledEmail } from "@/lib/email/templates";
import { env } from "@/lib/env";
import { formatDate, formatTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking } from "./types";

/**
 * Notificaciones salientes. Nunca lanzan: un correo o push fallido no debe
 * deshacer una reserva ya guardada. Todo queda en `notification_log`.
 *   - Cliente  → correo vía Resend (API HTTP, sin SDK).
 *   - Barbero  → push vía Hook.Notifier (POST JSON a su URL personal).
 */

type Channel = "email" | "push";
type Event = "booking_created" | "booking_cancelled" | "booking_rescheduled";

async function log(
  shopId: string,
  appointmentId: string,
  channel: Channel,
  event: Event,
  status: "sent" | "failed" | "skipped",
  detail?: string,
) {
  const { error } = await createAdminClient().from("notification_log").insert({
    barbershop_id: shopId,
    appointment_id: appointmentId,
    channel,
    event,
    status,
    detail: detail?.slice(0, 500) ?? null,
  });
  if (error) console.error("notification_log insert failed", error);
}

export async function sendEmail(to: string, msg: { subject: string; html: string; text: string }) {
  const apiKey = env.resendApiKey();
  if (!apiKey) return { ok: false as const, skipped: true, detail: "RESEND_API_KEY no configurada" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom(), to: [to], ...msg }),
  });
  if (!res.ok) return { ok: false as const, skipped: false, detail: `${res.status} ${await res.text()}` };
  return { ok: true as const };
}

export function isHookNotifierUrl(url: string) {
  return /^https:\/\/hooknotifier\.com\/[^/\s]+\/[^/\s]+\/?$/.test(url);
}

/** Envía un push al teléfono del barbero (formato del SDK oficial hook.notifier). */
export async function sendPush(
  hookUrl: string,
  payload: { object: string; body: string; priority?: "low" | "normal" | "high"; redirectUrl?: string },
) {
  const res = await fetch(hookUrl.replace(/\/+$/, ""), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags: "citas", color: "#D4A23A", ...payload }),
  });
  const text = await res.text();
  if (!res.ok || /"status"\s*:\s*"(?!ok)/.test(text)) {
    return { ok: false as const, detail: `${res.status} ${text}` };
  }
  return { ok: true as const };
}

async function getBarberHookUrl(barberId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("barber_private")
    .select("hook_url")
    .eq("barber_id", barberId)
    .maybeSingle();
  return data?.hook_url ?? null;
}

/** Correo al cliente + push al barbero tras crear una cita. */
export async function notifyBookingCreated(booking: Booking) {
  const site = env.siteUrl();
  const admin = createAdminClient();
  const { data: shop } = await admin
    .from("barbershops")
    .select("address, phone, cancel_notice_min")
    .eq("id", booking.barbershop_id)
    .single();

  const tasks: Promise<void>[] = [];

  tasks.push(
    (async () => {
      try {
        const msg = bookingConfirmationEmail({
          shopName: booking.shop_name,
          shopAddress: shop?.address ?? null,
          shopPhone: shop?.phone ?? null,
          customerName: booking.customer_name,
          serviceName: booking.service_name,
          barberName: booking.barber_name,
          startsAt: booking.starts_at,
          timezone: booking.timezone,
          priceCop: booking.price_cop,
          manageUrl: `${site}/cita/${booking.cancel_token}`,
          cancelNoticeMin: shop?.cancel_notice_min ?? 120,
        });
        const r = await sendEmail(booking.customer_email, msg);
        await log(
          booking.barbershop_id,
          booking.appointment_id,
          "email",
          "booking_created",
          r.ok ? "sent" : r.skipped ? "skipped" : "failed",
          r.ok ? booking.customer_email : r.detail,
        );
      } catch (e) {
        await log(booking.barbershop_id, booking.appointment_id, "email", "booking_created", "failed", String(e));
      }
    })(),
  );

  tasks.push(
    (async () => {
      try {
        const hookUrl = await getBarberHookUrl(booking.barber_id);
        if (!hookUrl) {
          await log(booking.barbershop_id, booking.appointment_id, "push", "booking_created", "skipped", "Barbero sin URL de Hook.Notifier");
          return;
        }
        const r = await sendPush(hookUrl, {
          object: `Nueva cita · ${formatTime(booking.starts_at, booking.timezone)}`,
          body: `${booking.customer_name} — ${booking.service_name}\n${formatDate(booking.starts_at, booking.timezone)}`,
          priority: "high",
          redirectUrl: `${site}/agenda`,
        });
        await log(booking.barbershop_id, booking.appointment_id, "push", "booking_created", r.ok ? "sent" : "failed", r.ok ? undefined : r.detail);
      } catch (e) {
        await log(booking.barbershop_id, booking.appointment_id, "push", "booking_created", "failed", String(e));
      }
    })(),
  );

  await Promise.all(tasks);
}

/** Texto para notification_log a partir de un error de PostgREST. */
function dbDetail(what: string, error: { code?: string; message?: string } | null) {
  return error ? `${what}: ${error.code ?? ""} ${error.message ?? ""}`.trim() : `${what}: no encontrada`;
}

/**
 * Correo al cliente + push al barbero cuando el cliente reprograma desde el
 * enlace. `token` es el del enlace (en la BD solo se guarda su hash).
 *
 * appointments no tiene FK directa a barbershops, así que la barbería se lee
 * aparte: embeberla (`shop:barbershops(...)`) hace fallar la consulta entera.
 */
export async function notifyBookingRescheduled(
  shopId: string,
  appointmentId: string,
  previousStartsAt: string,
  token: string,
) {
  try {
    const site = env.siteUrl();
    const admin = createAdminClient();
    const { data: a, error } = await admin
      .from("appointments")
      .select(
        "barbershop_id, barber_id, starts_at, service_name, price_cop, barber:barbers(display_name), customer:customers(name, email)",
      )
      .eq("id", appointmentId)
      .single();
    if (!a) {
      console.error("notifyBookingRescheduled: cita no leída", error);
      await log(shopId, appointmentId, "push", "booking_rescheduled", "failed", dbDetail("Cita", error));
      return;
    }
    const { data: shop, error: shopError } = await admin
      .from("barbershops")
      .select("name, address, phone, timezone, cancel_notice_min")
      .eq("id", a.barbershop_id)
      .single();
    if (!shop) {
      console.error("notifyBookingRescheduled: barbería no leída", shopError);
      await log(shopId, appointmentId, "push", "booking_rescheduled", "failed", dbDetail("Barbería", shopError));
      return;
    }
    const customer = a.customer as unknown as { name: string; email: string };
    const barber = a.barber as unknown as { display_name: string };

    const tasks: Promise<void>[] = [];

    tasks.push(
      (async () => {
        try {
          const msg = bookingRescheduledEmail({
            shopName: shop.name,
            shopAddress: shop.address,
            shopPhone: shop.phone,
            customerName: customer.name,
            serviceName: a.service_name,
            barberName: barber.display_name,
            startsAt: a.starts_at,
            previousStartsAt,
            timezone: shop.timezone,
            priceCop: a.price_cop,
            manageUrl: `${site}/cita/${token}`,
            cancelNoticeMin: shop.cancel_notice_min,
          });
          const r = await sendEmail(customer.email, msg);
          await log(
            a.barbershop_id,
            appointmentId,
            "email",
            "booking_rescheduled",
            r.ok ? "sent" : r.skipped ? "skipped" : "failed",
            r.ok ? customer.email : r.detail,
          );
        } catch (e) {
          await log(a.barbershop_id, appointmentId, "email", "booking_rescheduled", "failed", String(e));
        }
      })(),
    );

    tasks.push(
      (async () => {
        try {
          const hookUrl = await getBarberHookUrl(a.barber_id);
          if (!hookUrl) {
            await log(a.barbershop_id, appointmentId, "push", "booking_rescheduled", "skipped", "Barbero sin URL de Hook.Notifier");
            return;
          }
          const when = (iso: string) => `${formatDate(iso, shop.timezone)} · ${formatTime(iso, shop.timezone)}`;
          const r = await sendPush(hookUrl, {
            object: `Cita reprogramada · ${formatTime(a.starts_at, shop.timezone)}`,
            body: `${customer.name} — ${a.service_name}\nAntes: ${when(previousStartsAt)}\nAhora: ${when(a.starts_at)}`,
            priority: "normal",
            redirectUrl: `${site}/agenda`,
          });
          await log(a.barbershop_id, appointmentId, "push", "booking_rescheduled", r.ok ? "sent" : "failed", r.ok ? undefined : r.detail);
        } catch (e) {
          await log(a.barbershop_id, appointmentId, "push", "booking_rescheduled", "failed", String(e));
        }
      })(),
    );

    await Promise.all(tasks);
  } catch (e) {
    console.error("notifyBookingRescheduled failed", e);
  }
}

/** Push al barbero cuando el cliente cancela desde el enlace del correo. */
export async function notifyBookingCancelled(shopId: string, appointmentId: string) {
  try {
    const admin = createAdminClient();
    const { data: a, error } = await admin
      .from("appointments")
      .select("barbershop_id, barber_id, starts_at, service_name, customer:customers(name)")
      .eq("id", appointmentId)
      .single();
    if (!a) {
      console.error("notifyBookingCancelled: cita no leída", error);
      await log(shopId, appointmentId, "push", "booking_cancelled", "failed", dbDetail("Cita", error));
      return;
    }
    const { data: shop, error: shopError } = await admin
      .from("barbershops")
      .select("timezone")
      .eq("id", a.barbershop_id)
      .single();
    if (!shop) {
      console.error("notifyBookingCancelled: barbería no leída", shopError);
      await log(shopId, appointmentId, "push", "booking_cancelled", "failed", dbDetail("Barbería", shopError));
      return;
    }
    const tz = shop.timezone;
    const customer = (a.customer as unknown as { name: string }).name;

    const hookUrl = await getBarberHookUrl(a.barber_id);
    if (!hookUrl) {
      await log(a.barbershop_id, appointmentId, "push", "booking_cancelled", "skipped", "Barbero sin URL de Hook.Notifier");
      return;
    }
    const r = await sendPush(hookUrl, {
      object: `Cita cancelada · ${formatTime(a.starts_at, tz)}`,
      body: `${customer} canceló ${a.service_name}\n${formatDate(a.starts_at, tz)}`,
      priority: "normal",
      redirectUrl: `${env.siteUrl()}/agenda`,
    });
    await log(a.barbershop_id, appointmentId, "push", "booking_cancelled", r.ok ? "sent" : "failed", r.ok ? undefined : r.detail);
  } catch (e) {
    console.error("notifyBookingCancelled failed", e);
  }
}
