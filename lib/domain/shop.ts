import "server-only";
import { cache } from "react";
import { env } from "@/lib/env";
import { createAnonClient } from "@/lib/supabase/anon";
import { DomainError } from "./errors";
import type { BusinessHours, PublicBarber, Service, Shop } from "./types";

const SHOP_COLUMNS =
  "id, slug, name, tagline, about, phone, whatsapp, email, address, city, maps_url, instagram_url, timezone, currency, slot_interval_min, booking_horizon_days, min_notice_min, cancel_notice_min";

/**
 * Resuelve la barbería del request: primero por dominio propio
 * (barbershops.custom_domain), si no, la barbería por defecto del despliegue.
 * Es el punto de entrada multi-tenant del portal público.
 */
export const resolveShop = cache(async (host?: string | null): Promise<Shop> => {
  const supabase = createAnonClient();
  const hostname = host?.split(":")[0]?.toLowerCase();

  if (hostname) {
    const { data } = await supabase
      .from("barbershops")
      .select(SHOP_COLUMNS)
      .eq("custom_domain", hostname)
      .maybeSingle();
    if (data) return data as Shop;
  }

  const { data } = await supabase
    .from("barbershops")
    .select(SHOP_COLUMNS)
    .eq("slug", env.defaultShopSlug())
    .maybeSingle();
  if (!data) throw new DomainError("SHOP_NOT_FOUND");
  return data as Shop;
});

export interface PublicCatalog {
  services: Service[];
  barbers: PublicBarber[];
  hours: BusinessHours[];
}

/** Catálogo público: servicios activos, barberos activos y horario comercial. */
export const getPublicCatalog = cache(async (shopId: string): Promise<PublicCatalog> => {
  const supabase = createAnonClient();
  const [services, barbers, links, hours] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, description, duration_min, price_cop, active, sort_order")
      .eq("barbershop_id", shopId)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("barbers")
      .select("id, display_name, bio, photo_url")
      .eq("barbershop_id", shopId)
      .eq("active", true)
      .order("sort_order"),
    supabase.from("barber_services").select("barber_id, service_id").eq("barbershop_id", shopId),
    supabase
      .from("business_hours")
      .select("id, weekday, opens_at, closes_at")
      .eq("barbershop_id", shopId)
      .order("weekday")
      .order("opens_at"),
  ]);

  const byBarber = new Map<string, string[]>();
  for (const l of links.data ?? []) {
    byBarber.set(l.barber_id, [...(byBarber.get(l.barber_id) ?? []), l.service_id]);
  }

  return {
    services: (services.data ?? []) as Service[],
    barbers: (barbers.data ?? []).map((b) => ({ ...b, service_ids: byBarber.get(b.id) ?? [] })),
    hours: (hours.data ?? []) as BusinessHours[],
  };
});
