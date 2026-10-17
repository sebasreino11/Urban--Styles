"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createBookingAsStaff } from "@/lib/domain/staff-booking";
import { DomainError, fromDbError, toActionError, type ActionResult } from "@/lib/domain/errors";
import { notifyBookingCreated, sendPush } from "@/lib/domain/notifications";
import { getStaffContext, type StaffContext } from "@/lib/domain/staff";
import type { AppRole } from "@/lib/domain/types";
import { env } from "@/lib/env";
import { zonedToUtc, addDays } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { bookingInputSchema } from "@/lib/validation/booking";
import {
  appointmentStatusSchema,
  barberProfileSchema,
  hookUrlSchema,
  inviteStaffSchema,
  memberRolesSchema,
  reviewTimeOffSchema,
  serviceSchema,
  shopProfileSchema,
  timeOffRequestSchema,
  weeklyHoursSchema,
} from "@/lib/validation/staff";

/*
 * Server Actions del portal de staff. Cada acción:
 *   1. obtiene el contexto (sesión + roles) y corta si no corresponde,
 *   2. valida la entrada con Zod,
 *   3. escribe con el cliente del usuario → RLS es quien realmente autoriza.
 * La verificación de rol aquí es solo para dar un error claro antes.
 */

async function ctxOrThrow(role?: AppRole): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) throw new DomainError("FORBIDDEN");
  if (role === "admin" && !ctx.isAdmin) throw new DomainError("FORBIDDEN");
  if (role === "barber" && !ctx.isBarber) throw new DomainError("FORBIDDEN");
  return ctx;
}

function invalid(error: z.ZodError): Extract<ActionResult, { ok: false }> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return {
    ok: false,
    code: "VALIDATION",
    message: error.issues[0]?.message ?? "Revisa los datos del formulario.",
    fieldErrors,
  };
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof z.ZodError) return invalid(e);
    return toActionError(e);
  }
}

// ===========================================================================
// Barbero (y admin)
// ===========================================================================

export async function updateAppointmentStatus(input: z.input<typeof appointmentStatusSchema>) {
  return run(async () => {
    await ctxOrThrow();
    const v = appointmentStatusSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .update({ status: v.status, cancel_reason: v.status === "cancelled" ? v.reason : undefined })
      .eq("id", v.id)
      .select("id");
    if (error) throw fromDbError(error);
    if (!data?.length) throw new DomainError("FORBIDDEN");
    revalidatePath("/agenda");
    revalidatePath("/admin", "layout");
  });
}

export async function requestTimeOff(input: z.input<typeof timeOffRequestSchema>) {
  return run(async () => {
    const ctx = await ctxOrThrow();
    const v = timeOffRequestSchema.parse(input);
    const tz = ctx.shop.timezone;
    const startsAt = zonedToUtc(v.fromDate, v.allDay ? "00:00" : v.fromTime!, tz);
    const endsAt = v.allDay
      ? zonedToUtc(addDays(v.toDate, 1), "00:00", tz)
      : zonedToUtc(v.toDate, v.toTime!, tz);
    if (endsAt <= startsAt) throw new DomainError("VALIDATION", "El fin debe ser posterior al inicio.");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("time_off_requests")
      .insert({
        barbershop_id: ctx.shop.id,
        barber_id: v.barberId,
        starts_at: startsAt,
        ends_at: endsAt,
        reason: v.reason,
      })
      .select("status")
      .single();
    if (error) throw fromDbError(error);
    revalidatePath("/agenda/bloqueos");
    revalidatePath("/admin/solicitudes");
    return { status: data.status as string };
  });
}

export async function withdrawTimeOff(id: string) {
  return run(async () => {
    await ctxOrThrow();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("time_off_requests")
      .delete()
      .eq("id", z.uuid().parse(id))
      .select("id");
    if (error) throw fromDbError(error);
    if (!data?.length) throw new DomainError("FORBIDDEN");
    revalidatePath("/agenda/bloqueos");
    revalidatePath("/admin/solicitudes");
  });
}

export async function saveHookUrl(input: z.input<typeof hookUrlSchema>) {
  return run(async () => {
    const ctx = await ctxOrThrow("barber");
    const v = hookUrlSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase.from("barber_private").upsert({
      barber_id: ctx.barberId!,
      barbershop_id: ctx.shop.id,
      hook_url: v.hookUrl || null,
    });
    if (error) throw fromDbError(error);
    revalidatePath("/agenda/notificaciones");
  });
}

export async function sendTestPush(input: z.input<typeof hookUrlSchema>) {
  return run(async () => {
    const ctx = await ctxOrThrow("barber");
    const v = hookUrlSchema.parse(input);
    if (!v.hookUrl) throw new DomainError("VALIDATION", "Pega primero tu URL de Hook.Notifier.");
    const r = await sendPush(v.hookUrl, {
      object: `${ctx.shop.name} · Prueba`,
      body: "Así te llegarán las nuevas citas.",
      redirectUrl: `${env.siteUrl()}/agenda`,
    });
    if (!r.ok) throw new DomainError("UNKNOWN", "Hook.Notifier rechazó la URL. Revisa que esté completa.");
  });
}

/** Cita tomada por teléfono o en mostrador (sin Turnstile; requiere sesión). */
export async function bookAsStaff(input: z.input<typeof bookingInputSchema>) {
  return run(async () => {
    const ctx = await ctxOrThrow();
    const booking = await createBookingAsStaff(ctx.shop.id, bookingInputSchema.parse(input));
    after(() => notifyBookingCreated(booking));
    revalidatePath("/agenda");
    revalidatePath("/admin/citas");
    return { barberName: booking.barber_name, startsAt: booking.starts_at };
  });
}

// ===========================================================================
// Administrador
// ===========================================================================

export async function reviewTimeOff(input: z.input<typeof reviewTimeOffSchema>) {
  return run(async () => {
    await ctxOrThrow("admin");
    const v = reviewTimeOffSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("time_off_requests")
      .update({ status: v.approve ? "approved" : "rejected", review_note: v.note })
      .eq("id", v.id)
      .eq("status", "pending")
      .select("id");
    if (error) throw fromDbError(error);
    if (!data?.length) throw new DomainError("VALIDATION", "La solicitud ya fue revisada.");
    revalidatePath("/admin/solicitudes");
    revalidatePath("/agenda/bloqueos");
  });
}

export async function saveService(input: z.input<typeof serviceSchema>) {
  return run(async () => {
    const ctx = await ctxOrThrow("admin");
    const v = serviceSchema.parse(input);
    const supabase = await createClient();
    const row = {
      barbershop_id: ctx.shop.id,
      name: v.name,
      description: v.description,
      duration_min: v.durationMin,
      price_cop: v.priceCop,
      active: v.active,
      sort_order: v.sortOrder,
    };
    if (v.id) {
      const { error } = await supabase.from("services").update(row).eq("id", v.id);
      if (error) throw fromDbError(error);
    } else {
      const { data, error } = await supabase.from("services").insert(row).select("id").single();
      if (error) throw fromDbError(error);
      // Un servicio nuevo lo pueden hacer todos los barberos activos; el
      // admin ajusta luego en cada barbero.
      const { data: barbers } = await supabase
        .from("barbers")
        .select("id")
        .eq("barbershop_id", ctx.shop.id)
        .eq("active", true);
      if (barbers?.length) {
        await supabase.from("barber_services").insert(
          barbers.map((b) => ({ barber_id: b.id, service_id: data.id, barbershop_id: ctx.shop.id })),
        );
      }
    }
    revalidatePath("/admin/servicios");
    revalidatePath("/");
  });
}

export async function saveShopProfile(input: z.input<typeof shopProfileSchema>) {
  return run(async () => {
    const ctx = await ctxOrThrow("admin");
    const v = shopProfileSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("barbershops")
      .update({
        name: v.name,
        tagline: v.tagline,
        about: v.about,
        phone: v.phone,
        whatsapp: v.whatsapp,
        email: v.email,
        address: v.address,
        city: v.city,
        maps_url: v.mapsUrl,
        instagram_url: v.instagramUrl,
        slot_interval_min: v.slotIntervalMin,
        booking_horizon_days: v.bookingHorizonDays,
        min_notice_min: v.minNoticeMin,
        cancel_notice_min: v.cancelNoticeMin,
      })
      .eq("id", ctx.shop.id);
    if (error) throw fromDbError(error);
    revalidatePath("/", "layout");
  });
}

/** Reemplaza el horario semanal (comercial o de un barbero) en una transacción. */
async function replaceWeekly(shopId: string, hours: z.infer<typeof weeklyHoursSchema>, barberId: string | null) {
  const ranges = Object.entries(hours).flatMap(([day, list]) =>
    list.map((r) => ({ weekday: Number(day), start: r.start, end: r.end })),
  );
  const supabase = await createClient();
  const { error } = await supabase.rpc("replace_weekly_hours", {
    p_shop: shopId,
    p_barber: barberId,
    p_ranges: ranges,
  });
  if (error) throw fromDbError(error);
}

export async function saveBusinessHours(hours: z.input<typeof weeklyHoursSchema>) {
  return run(async () => {
    const ctx = await ctxOrThrow("admin");
    await replaceWeekly(ctx.shop.id, weeklyHoursSchema.parse(hours), null);
    revalidatePath("/admin/barberia");
    revalidatePath("/");
  });
}

export async function saveBarberSchedule(barberId: string, hours: z.input<typeof weeklyHoursSchema>) {
  return run(async () => {
    const ctx = await ctxOrThrow("admin");
    await replaceWeekly(ctx.shop.id, weeklyHoursSchema.parse(hours), z.uuid().parse(barberId));
    revalidatePath(`/admin/barberos/${barberId}`);
  });
}

export async function saveBarberProfile(input: z.input<typeof barberProfileSchema>) {
  return run(async () => {
    const ctx = await ctxOrThrow("admin");
    const v = barberProfileSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("barbers")
      .update({ display_name: v.displayName, bio: v.bio, photo_url: v.photoUrl, active: v.active })
      .eq("id", v.id);
    if (error) throw fromDbError(error);

    const { error: delError } = await supabase.from("barber_services").delete().eq("barber_id", v.id);
    if (delError) throw fromDbError(delError);
    if (v.serviceIds.length) {
      const { error: insError } = await supabase.from("barber_services").insert(
        v.serviceIds.map((service_id) => ({ barber_id: v.id, service_id, barbershop_id: ctx.shop.id })),
      );
      if (insError) throw fromDbError(insError);
    }
    revalidatePath("/admin/barberos", "layout");
    revalidatePath("/");
  });
}

/** Crea un barbero sin cuenta (solo perfil). Útil para agendas sin login. */
export async function createBarberProfile(displayName: string) {
  return run(async () => {
    const ctx = await ctxOrThrow("admin");
    const name = z.string().trim().min(2).max(60).parse(displayName);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barbers")
      .insert({ barbershop_id: ctx.shop.id, display_name: name, active: false })
      .select("id")
      .single();
    if (error) throw fromDbError(error);
    revalidatePath("/admin/barberos");
    return { id: data.id as string };
  });
}

/**
 * Invita a una persona del equipo: crea su cuenta en Supabase Auth (le llega
 * un correo para definir contraseña), su membresía con roles y, si es
 * barbero, su perfil. Una sola cuenta aunque tenga ambos roles.
 */
export async function inviteStaff(input: z.input<typeof inviteStaffSchema>) {
  return run(async () => {
    const ctx = await ctxOrThrow("admin");
    const v = inviteStaffSchema.parse(input);
    const admin = createAdminClient();

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(v.email, {
      redirectTo: `${env.siteUrl()}/auth/confirm?next=/auth/update-password`,
      data: { display_name: v.displayName },
    });
    if (inviteError || !invited.user) {
      if (inviteError?.message?.toLowerCase().includes("already")) {
        throw new DomainError("VALIDATION", "Ese correo ya tiene una cuenta.");
      }
      console.error(inviteError);
      throw new DomainError("UNKNOWN", "No se pudo enviar la invitación. Revisa el correo e intenta de nuevo.");
    }

    const supabase = await createClient();
    const roles: AppRole[] = [...(v.isAdmin ? ["admin" as const] : []), ...(v.isBarber ? ["barber" as const] : [])];
    const { data: membership, error } = await supabase
      .from("memberships")
      .insert({ barbershop_id: ctx.shop.id, user_id: invited.user.id, email: v.email, roles })
      .select("id")
      .single();
    if (error) {
      await admin.auth.admin.deleteUser(invited.user.id);
      throw fromDbError(error);
    }

    if (v.isBarber) {
      const { data: barber, error: barberError } = await supabase
        .from("barbers")
        .insert({ barbershop_id: ctx.shop.id, membership_id: membership.id, display_name: v.displayName })
        .select("id")
        .single();
      if (barberError) throw fromDbError(barberError);
      const { data: services } = await supabase
        .from("services")
        .select("id")
        .eq("barbershop_id", ctx.shop.id)
        .eq("active", true);
      if (services?.length) {
        await supabase.from("barber_services").insert(
          services.map((s) => ({ barber_id: barber.id, service_id: s.id, barbershop_id: ctx.shop.id })),
        );
      }
    }
    revalidatePath("/admin/barberos");
  });
}

/** Vincula una cuenta invitada a un perfil de barbero existente (p. ej. datos demo). */
export async function linkBarberAccount(barberId: string, membershipId: string) {
  return run(async () => {
    await ctxOrThrow("admin");
    const supabase = await createClient();
    const { error } = await supabase
      .from("barbers")
      .update({ membership_id: z.uuid().parse(membershipId) })
      .eq("id", z.uuid().parse(barberId));
    if (error) throw fromDbError(error);
    revalidatePath("/admin/barberos", "layout");
  });
}

export async function updateMemberRoles(input: z.input<typeof memberRolesSchema>) {
  return run(async () => {
    const ctx = await ctxOrThrow("admin");
    const v = memberRolesSchema.parse(input);
    const roles: AppRole[] = [...(v.isAdmin ? ["admin" as const] : []), ...(v.isBarber ? ["barber" as const] : [])];
    if (!roles.length) throw new DomainError("VALIDATION", "Elige al menos un rol o desactiva la cuenta.");

    const supabase = await createClient();
    const { data: m, error } = await supabase
      .from("memberships")
      .update({ roles, active: v.active })
      .eq("id", v.membershipId)
      .select("id, email")
      .single();
    if (error) throw fromDbError(error);

    // Al dar el rol barber por primera vez se crea su perfil (inactivo hasta
    // que el admin defina horario y servicios).
    if (v.isBarber) {
      const { data: existing } = await supabase.from("barbers").select("id").eq("membership_id", m.id).maybeSingle();
      if (!existing) {
        const { error: insError } = await supabase.from("barbers").insert({
          barbershop_id: ctx.shop.id,
          membership_id: m.id,
          display_name: (m.email as string | null)?.split("@")[0] ?? "Barbero",
          active: false,
        });
        if (insError) throw fromDbError(insError);
      }
    }
    revalidatePath("/admin/barberos", "layout");
  });
}
