#!/usr/bin/env node
/**
 * Crea la cuenta del dueño (roles admin + barber) en una barbería existente.
 * Es el único paso de "bootstrap": después, el dueño invita al resto del
 * equipo desde el panel.
 *
 *   npm run create-owner -- --email dueno@barberia.co --name "Andrés Gómez" --password "******"
 *   Opcional: --shop urban-styles   --barber-id <uuid de un barbero existente>
 *
 * Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY de .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { values: args } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    password: { type: "string" },
    shop: { type: "string", default: process.env.DEFAULT_SHOP_SLUG ?? "urban-styles" },
    "barber-id": { type: "string" },
  },
});

if (!args.email || !args.name || !args.password) {
  console.error('Uso: npm run create-owner -- --email x@y.co --name "Nombre" --password "clave-segura"');
  process.exit(1);
}
if (args.password.length < 8) {
  console.error("La contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}

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

const { data: shop, error: shopErr } = await db.from("barbershops").select("id, name").eq("slug", args.shop).single();
if (shopErr) fail(`No existe la barbería "${args.shop}". ¿Corriste las migraciones y el seed?`, shopErr);

const { data: created, error: userErr } = await db.auth.admin.createUser({
  email: args.email.toLowerCase(),
  password: args.password,
  email_confirm: true,
  user_metadata: { display_name: args.name },
});
if (userErr) fail("No se pudo crear el usuario", userErr);
const userId = created.user.id;

const { data: membership, error: mErr } = await db
  .from("memberships")
  .insert({ barbershop_id: shop.id, user_id: userId, email: args.email.toLowerCase(), roles: ["admin", "barber"] })
  .select("id")
  .single();
if (mErr) {
  await db.auth.admin.deleteUser(userId);
  fail("No se pudo crear la membresía", mErr);
}

let barberId = args["barber-id"];
if (barberId) {
  const { error } = await db.from("barbers").update({ membership_id: membership.id }).eq("id", barberId).eq("barbershop_id", shop.id);
  if (error) fail("No se pudo vincular el barbero indicado", error);
} else {
  const { data: barber, error } = await db
    .from("barbers")
    .insert({ barbershop_id: shop.id, membership_id: membership.id, display_name: args.name, sort_order: 0 })
    .select("id")
    .single();
  if (error) fail("No se pudo crear el perfil de barbero", error);
  barberId = barber.id;

  // Por defecto: hace todos los servicios y trabaja en el horario comercial.
  const [{ data: services }, { data: hours }] = await Promise.all([
    db.from("services").select("id").eq("barbershop_id", shop.id),
    db.from("business_hours").select("weekday, opens_at, closes_at").eq("barbershop_id", shop.id),
  ]);
  if (services?.length) {
    await db.from("barber_services").insert(services.map((s) => ({ barber_id: barberId, service_id: s.id, barbershop_id: shop.id })));
  }
  if (hours?.length) {
    await db.from("barber_schedules").insert(
      hours.map((h) => ({ barbershop_id: shop.id, barber_id: barberId, weekday: h.weekday, starts_at: h.opens_at, ends_at: h.closes_at })),
    );
  }
}

console.log(`✓ Dueño creado en ${shop.name}`);
console.log(`  Correo:  ${args.email}`);
console.log(`  Roles:   admin + barber (una sola cuenta)`);
console.log(`  Barbero: ${barberId}`);
console.log(`  Entra en /auth/login`);
