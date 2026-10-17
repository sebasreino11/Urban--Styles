import { PGlite, type Transaction } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const MIGRATIONS = join(ROOT, "supabase", "migrations");

export const SHOP = "00000000-0000-4000-a000-000000000001";
export const SERVICE_CUT = "00000000-0000-4000-b000-000000000001"; // 45 min
export const SERVICE_COMBO = "00000000-0000-4000-b000-000000000004"; // 75 min
export const CAMILO = "00000000-0000-4000-c000-000000000001";
export const VALENTINA = "00000000-0000-4000-c000-000000000002";
export const JULIAN = "00000000-0000-4000-c000-000000000003";

export type Actor =
  | { role: "anon" }
  | { role: "service_role" }
  | { role: "authenticated"; userId: string };

/**
 * Base de datos Postgres real (WASM) con el entorno mínimo de Supabase, todas
 * las migraciones y el seed aplicados.
 */
export async function createTestDb() {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(readFileSync(join(__dirname, "supabase-stub.sql"), "utf8"));
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  await db.exec(readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8"));
  return db;
}

/** Ejecuta `fn` dentro de una transacción con el rol y usuario indicados. */
export async function as<T>(
  db: PGlite,
  actor: Actor,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.role', $1, true)", [actor.role]);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [
      actor.role === "authenticated" ? actor.userId : "",
    ]);
    await tx.exec(`set local role ${actor.role}`);
    return fn(tx);
  });
}

/** Crea un usuario de auth con membresía; opcionalmente lo vincula a un barbero. */
export async function createStaff(
  db: PGlite,
  opts: { email: string; roles: ("admin" | "barber")[]; barberId?: string },
) {
  const user = await db.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [opts.email],
  );
  const userId = user.rows[0].id;
  const m = await db.query<{ id: string }>(
    "insert into public.memberships (barbershop_id, user_id, roles) values ($1, $2, $3::public.app_role[]) returning id",
    [SHOP, userId, `{${opts.roles.join(",")}}`],
  );
  if (opts.barberId) {
    await db.query("update public.barbers set membership_id = $1 where id = $2", [
      m.rows[0].id,
      opts.barberId,
    ]);
  }
  return userId;
}

/** Fecha local (YYYY-MM-DD) del próximo `weekday` (0=domingo) a ≥ `minDaysAhead` días. */
export function nextWeekday(weekday: number, minDaysAhead = 2): string {
  const now = new Date();
  const bogota = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  const d = new Date(bogota);
  d.setDate(d.getDate() + minDaysAhead);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Instante ISO para una hora local de Bogotá (UTC-5, sin horario de verano). */
export function bogota(date: string, time: string): string {
  return new Date(`${date}T${time}:00-05:00`).toISOString();
}
