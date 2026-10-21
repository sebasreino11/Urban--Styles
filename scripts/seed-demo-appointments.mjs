#!/usr/bin/env node
/**
 * Carga citas demo para que la agenda, el panel admin y las métricas se vean
 * con vida durante una presentación. NO envía correos ni push.
 *
 *   npm run seed-demo                 # 4 semanas de historial + 10 días por delante
 *   npm run seed-demo -- --reset      # borra las citas demo anteriores y vuelve a cargar
 *   npm run seed-demo -- --remove     # solo borra las citas demo
 *   Opcional: --shop urban-styles  --past-days 28  --future-days 10
 *
 * Los clientes demo usan correos @demo.example.com; así se identifican y se
 * pueden borrar sin tocar citas reales. Las citas pasadas se insertan con su
 * estado final; las futuras pasan por book_appointment (mismas reglas que la web).
 * Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY de .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { values: args } = parseArgs({
  options: {
    shop: { type: "string", default: process.env.DEFAULT_SHOP_SLUG ?? "urban-styles" },
    reset: { type: "boolean", default: false },
    remove: { type: "boolean", default: false },
    "past-days": { type: "string", default: "28" },
    "future-days": { type: "string", default: "10" },
  },
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false } });
const fail = (msg, err) => {
  console.error(`✗ ${msg}`, err?.message ?? "");
  process.exit(1);
};

const DEMO_DOMAIN = "demo.example.com";
const CUSTOMERS = [
  "Santiago Herrera", "Mateo Restrepo", "Sebastián Cárdenas", "Nicolás Duarte", "Alejandro Vélez",
  "Daniel Pardo", "Samuel Quintero", "Tomás Arango", "Felipe Salazar", "Juan Pablo Méndez",
  "David Castaño", "Andrés Guzmán", "Esteban Rincón", "Martín Ospina", "Gabriel Toro",
  "Lucas Benítez", "Emilio Cifuentes", "Simón Barrera", "Diego Montoya", "Julián Patiño",
  "Laura Gómez", "Mariana Jiménez", "Camila Ruiz", "Óscar Linares",
];

// Aleatorio reproducible: la misma corrida genera la misma agenda.
let seed = 20261020;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];

// ---------------------------------------------------------------------------
const { data: shop, error: shopErr } = await db
  .from("barbershops")
  .select("id, name, timezone")
  .eq("slug", args.shop)
  .single();
if (shopErr) fail(`No existe la barbería "${args.shop}". ¿Corriste las migraciones y el seed?`, shopErr);

// Las reglas de agenda viven en las migraciones: con migraciones pendientes,
// las citas se crearían con reglas viejas y bloquearían las nuevas. Se usa la
// función de la última migración como marcador.
const { error: migErr } = await db.rpc("save_barber_profile", {
  p_barber: "00000000-0000-0000-0000-000000000000",
  p_display_name: "--",
  p_bio: null,
  p_photo_url: null,
  p_active: false,
  p_service_ids: [],
});
if (!args.remove && migErr?.code === "PGRST202") fail("Hay migraciones sin aplicar. Corre primero `npm run db:push`.");

async function removeDemo() {
  const { data: demo, error } = await db
    .from("customers")
    .select("id")
    .eq("barbershop_id", shop.id)
    .like("email", `%@${DEMO_DOMAIN}`);
  if (error) fail("No se pudieron leer los clientes demo", error);
  const ids = demo.map((c) => c.id);
  if (!ids.length) return 0;
  const { count, error: aErr } = await db
    .from("appointments")
    .delete({ count: "exact" })
    .in("customer_id", ids);
  if (aErr) fail("No se pudieron borrar las citas demo", aErr);
  const { error: cErr } = await db.from("customers").delete().in("id", ids);
  if (cErr) fail("No se pudieron borrar los clientes demo", cErr);
  return count ?? 0;
}

if (args.remove || args.reset) {
  const removed = await removeDemo();
  console.log(`✓ ${removed} citas demo borradas`);
  if (args.remove) process.exit(0);
} else {
  const { count } = await db
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", shop.id)
    .like("email", `%@${DEMO_DOMAIN}`);
  if (count) fail("Ya hay datos demo. Usa --reset para volver a cargarlos o --remove para borrarlos.");
}

// --- Catálogo -----------------------------------------------------------------
const [{ data: services }, { data: barbers }, { data: links }, { data: hours }, { data: schedules }] =
  await Promise.all([
    db.from("services").select("id, name, duration_min, price_cop").eq("barbershop_id", shop.id).eq("active", true),
    db.from("barbers").select("id, display_name").eq("barbershop_id", shop.id).eq("active", true),
    db.from("barber_services").select("barber_id, service_id").eq("barbershop_id", shop.id),
    db.from("business_hours").select("weekday, opens_at, closes_at").eq("barbershop_id", shop.id),
    db.from("barber_schedules").select("barber_id, weekday, starts_at, ends_at").eq("barbershop_id", shop.id),
  ]);
if (!services?.length || !barbers?.length) fail("La barbería no tiene servicios o barberos activos.");

// Los servicios cortos y baratos salen menos que los cortes.
const WEIGHT = { 15: 1, 30: 2, 45: 4, 60: 3, 75: 3 };
const servicesOf = (barberId) => {
  const own = new Set(links.filter((l) => l.barber_id === barberId).map((l) => l.service_id));
  return services
    .filter((s) => own.has(s.id))
    .flatMap((s) => Array(WEIGHT[s.duration_min] ?? 2).fill(s));
};

const { data: customers, error: custErr } = await db
  .from("customers")
  .upsert(
    CUSTOMERS.map((name) => ({
      barbershop_id: shop.id,
      name,
      email: `${name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, ".")}@${DEMO_DOMAIN}`,
      phone: `+57 3${Math.floor(10 + rand() * 90)} ${Math.floor(100 + rand() * 900)} ${Math.floor(1000 + rand() * 9000)}`,
    })),
    { onConflict: "barbershop_id,email" },
  )
  .select("id, name, email, phone");
if (custErr) fail("No se pudieron crear los clientes demo", custErr);

// --- Fechas en la zona horaria de la barbería --------------------------------
const localDate = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: shop.timezone }).format(d);
const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const offset = (date) => {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: shop.timezone, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName").value;
  return name === "GMT" ? "+00:00" : name.slice(3);
};
const instant = (date, min) =>
  new Date(`${date}T${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00${offset(date)}`);

/** Franjas [inicio, fin) en minutos: horario comercial ∩ horario del barbero. */
function windows(barberId, date) {
  const wd = weekday(date);
  return schedules
    .filter((s) => s.barber_id === barberId && s.weekday === wd)
    .flatMap((s) =>
      hours
        .filter((h) => h.weekday === wd)
        .map((h) => [Math.max(toMin(s.starts_at), toMin(h.opens_at)), Math.min(toMin(s.ends_at), toMin(h.closes_at))])
        .filter(([a, b]) => a < b),
    );
}

// --- Historial: citas ya atendidas, canceladas o sin asistencia ---------------
const today = localDate(new Date());
const now = Date.now();
const past = [];
for (let i = Number(args["past-days"]); i >= 1; i--) {
  const date = addDays(today, -i);
  // Los viernes y sábados hay más movimiento.
  const busy = [5, 6].includes(weekday(date)) ? 0.85 : 0.6;
  for (const barber of barbers) {
    const menu = servicesOf(barber.id);
    if (!menu.length) continue;
    for (const [start, end] of windows(barber.id, date)) {
      let cursor = start + pick([0, 15, 30, 45, 60]);
      while (true) {
        const svc = pick(menu);
        if (cursor + svc.duration_min > end) break;
        if (rand() < busy) {
          const startsAt = instant(date, cursor);
          if (startsAt.getTime() >= now) break;
          const r = rand();
          const status = r < 0.8 ? "completed" : r < 0.88 ? "no_show" : "cancelled";
          const cancelledByCustomer = rand() < 0.7;
          past.push({
            barbershop_id: shop.id,
            barber_id: barber.id,
            service_id: svc.id,
            customer_id: pick(customers).id,
            starts_at: startsAt.toISOString(),
            ends_at: new Date(startsAt.getTime() + svc.duration_min * 60_000).toISOString(),
            status,
            service_name: svc.name,
            price_cop: svc.price_cop,
            source: rand() < 0.75 ? "web" : "staff",
            ...(status === "cancelled" && {
              cancelled_at: new Date(startsAt.getTime() - (2 + Math.floor(rand() * 40)) * 3_600_000).toISOString(),
              cancelled_by: cancelledByCustomer ? "customer" : "staff",
              cancel_reason: cancelledByCustomer ? "Cancelada por el cliente" : "Reprogramada por teléfono",
            }),
          });
          // Duración + 15 min de tiempo muerto obligatorio entre citas.
          cursor += svc.duration_min + 15;
        } else {
          cursor += 15 * pick([1, 2, 3, 4]);
        }
      }
    }
  }
}

let inserted = 0;
let skipped = 0;
// Se insertan una a una: si una choca con una cita real (23P01) se omite sola.
for (const row of past) {
  const { error } = await db.from("appointments").insert(row);
  if (!error) inserted++;
  else if (error.code === "23P01") skipped++;
  else fail("No se pudo insertar una cita del historial", error);
}
console.log(`✓ Historial: ${inserted} citas en ${args["past-days"]} días${skipped ? ` (${skipped} omitidas por choque)` : ""}`);

// --- Próximos días: reservas reales vía book_appointment ---------------------
let booked = 0;
for (let i = 0; i <= Number(args["future-days"]); i++) {
  const date = addDays(today, i);
  for (const barber of barbers) {
    const menu = servicesOf(barber.id);
    if (!menu.length) continue;
    const wanted = 2 + Math.floor(rand() * (i < 3 ? 4 : 3)); // más llenos los primeros días
    for (let n = 0; n < wanted; n++) {
      const svc = pick(menu);
      const { data: slots, error } = await db.rpc("get_available_slots", {
        p_shop: shop.id,
        p_service: svc.id,
        p_date: date,
        p_barber: barber.id,
      });
      if (error) fail("No se pudo consultar la disponibilidad", error);
      if (!slots.length) break;
      const customer = pick(customers);
      const { error: bookErr } = await db.rpc("book_appointment", {
        p_shop: shop.id,
        p_service: svc.id,
        p_starts_at: pick(slots).slot_start,
        p_customer_name: customer.name,
        p_customer_email: customer.email,
        p_barber: barber.id,
        p_customer_phone: customer.phone,
        p_source: rand() < 0.8 ? "web" : "staff",
      });
      if (!bookErr) booked++;
      else if (!/SLOT_(UNAVAILABLE|TAKEN)/.test(bookErr.message)) fail("No se pudo reservar una cita futura", bookErr);
    }
  }
}
console.log(`✓ Próximos ${args["future-days"]} días: ${booked} citas confirmadas`);
console.log(`\nListo. Para quitarlas: npm run seed-demo -- --remove`);
