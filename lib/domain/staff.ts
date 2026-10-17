import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, StaffAppointment, TimeOffRequest } from "./types";

/**
 * Contexto del usuario de staff con sesión. Todas las consultas de este
 * módulo usan el cliente con la sesión del usuario: RLS decide qué filas ve.
 */

export interface StaffContext {
  userId: string;
  email: string | null;
  membershipId: string;
  shop: { id: string; name: string; slug: string; timezone: string };
  roles: AppRole[];
  isAdmin: boolean;
  isBarber: boolean;
  /** Perfil de barbero propio (null si no tiene rol barber). */
  barberId: string | null;
  barberName: string | null;
}

export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  // Hoy una cuenta pertenece a una barbería; con sucursales/multi-barbería se
  // elegirá la membresía activa desde una cookie.
  const { data: m } = await supabase
    .from("memberships")
    .select("id, roles, active, shop:barbershops(id, name, slug, timezone), barber:barbers(id, display_name)")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!m) return null;

  const roles = m.roles as AppRole[];
  type BarberRef = { id: string; display_name: string };
  const rawBarber = m.barber as unknown as BarberRef[] | BarberRef | null;
  const barber = (Array.isArray(rawBarber) ? rawBarber[0] : rawBarber) ?? null;
  const isBarber = roles.includes("barber") && !!barber;

  return {
    userId,
    email: (claims.claims.email as string | undefined) ?? null,
    membershipId: m.id,
    shop: m.shop as unknown as StaffContext["shop"],
    roles,
    isAdmin: roles.includes("admin"),
    isBarber,
    barberId: isBarber ? barber!.id : null,
    barberName: barber?.display_name ?? null,
  };
});

/** Para páginas: exige sesión de staff (y opcionalmente un rol). */
export async function requireStaff(role?: AppRole): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) redirect("/auth/login?error=sin-acceso");
  if (role === "admin" && !ctx.isAdmin) redirect("/agenda");
  if (role === "barber" && !ctx.isBarber) redirect("/admin");
  return ctx;
}

const APPOINTMENT_COLUMNS =
  "id, barber_id, starts_at, ends_at, status, service_name, price_cop, source, cancel_reason, cancelled_by, staff_note, customer:customers(name, email, phone), barber:barbers(display_name)";

export async function listAppointments(opts: {
  shopId: string;
  from?: string;
  to?: string;
  barberId?: string | null;
  statuses?: string[];
  limit?: number;
  ascending?: boolean;
}): Promise<StaffAppointment[]> {
  const supabase = await createClient();
  let q = supabase
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("barbershop_id", opts.shopId)
    .order("starts_at", { ascending: opts.ascending ?? true })
    .limit(opts.limit ?? 300);
  if (opts.from) q = q.gte("starts_at", opts.from);
  if (opts.to) q = q.lt("starts_at", opts.to);
  if (opts.barberId) q = q.eq("barber_id", opts.barberId);
  if (opts.statuses?.length) q = q.in("status", opts.statuses);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as StaffAppointment[];
}

export async function listTimeOff(opts: {
  shopId: string;
  barberId?: string | null;
  statuses?: string[];
}): Promise<TimeOffRequest[]> {
  const supabase = await createClient();
  let q = supabase
    .from("time_off_requests")
    .select("id, barber_id, starts_at, ends_at, reason, status, review_note, reviewed_at, created_at, barber:barbers(display_name)")
    .eq("barbershop_id", opts.shopId)
    .order("starts_at", { ascending: false })
    .limit(200);
  if (opts.barberId) q = q.eq("barber_id", opts.barberId);
  if (opts.statuses?.length) q = q.in("status", opts.statuses);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as TimeOffRequest[];
}

export async function getOwnHookUrl(barberId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("barber_private")
    .select("hook_url")
    .eq("barber_id", barberId)
    .maybeSingle();
  return data?.hook_url ?? null;
}
