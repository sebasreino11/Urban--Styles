#!/usr/bin/env node
/**
 * Prueba de concurrencia REAL contra Supabase: N reservas simultáneas al
 * mismo barbero y horario. Debe ganar exactamente una.
 * Úsalo SOLO contra el proyecto de desarrollo: crea y luego borra datos.
 *
 *   npm run test:race            (20 intentos)
 *   npm run test:race -- 50
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const N = Number(process.argv[2] ?? 20);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const { data: shop } = await db.from("barbershops").select("id, timezone").eq("slug", process.env.DEFAULT_SHOP_SLUG ?? "urban-styles").single();
const { data: link } = await db.from("barber_services").select("barber_id, service_id").eq("barbershop_id", shop.id).limit(1).single();

// Primer horario libre en los próximos días.
let slot = null;
for (let i = 1; i <= 14 && !slot; i++) {
  const date = new Date(Date.now() + i * 86400000).toLocaleDateString("en-CA", { timeZone: shop.timezone });
  const { data } = await db.rpc("get_available_slots", { p_shop: shop.id, p_service: link.service_id, p_date: date, p_barber: link.barber_id });
  slot = data?.[0] ?? null;
}
if (!slot) throw new Error("No hay horarios libres para probar");
console.log(`Disparando ${N} reservas simultáneas para ${slot.slot_start}…`);

const results = await Promise.all(
  Array.from({ length: N }, (_, i) =>
    db.rpc("book_appointment", {
      p_shop: shop.id,
      p_service: link.service_id,
      p_starts_at: slot.slot_start,
      p_customer_name: `Carrera ${i}`,
      p_customer_email: `race-${i}-${Date.now()}@example.com`,
      p_barber: link.barber_id,
    }),
  ),
);

const ok = results.filter((r) => !r.error);
const taken = results.filter((r) => /SLOT_TAKEN|SLOT_UNAVAILABLE/.test(r.error?.message ?? ""));
const other = results.filter((r) => r.error && !taken.includes(r));
console.log(`Éxitos: ${ok.length} · Rechazadas por ocupado: ${taken.length} · Otros errores: ${other.length}`);
other.slice(0, 3).forEach((r) => console.log("  ", r.error.message));

// Limpieza
const ids = ok.map((r) => r.data.appointment_id);
if (ids.length) await db.from("appointments").delete().in("id", ids);
await db.from("customers").delete().like("email", "race-%@example.com");

if (ok.length !== 1 || other.length) {
  console.error("✗ FALLÓ: debe haber exactamente 1 reserva exitosa");
  process.exit(1);
}
console.log("✓ La base de datos impidió la doble reserva");
