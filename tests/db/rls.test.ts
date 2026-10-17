import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  as,
  bogota,
  CAMILO,
  createStaff,
  createTestDb,
  JULIAN,
  nextWeekday,
  SERVICE_CUT,
  SHOP,
  VALENTINA,
} from "./harness";

const TUESDAY = nextWeekday(2);

let db: PGlite;
let camiloUser: string; // barbero
let valentinaUser: string; // barbero
let ownerUser: string; // admin + barbero (Julián es el dueño)

beforeEach(async () => {
  db = await createTestDb();
  camiloUser = await createStaff(db, { email: "camilo@us.co", roles: ["barber"], barberId: CAMILO });
  valentinaUser = await createStaff(db, {
    email: "valentina@us.co",
    roles: ["barber"],
    barberId: VALENTINA,
  });
  ownerUser = await createStaff(db, {
    email: "dueno@us.co",
    roles: ["admin", "barber"],
    barberId: JULIAN,
  });

  for (const [barber, time, email] of [
    [CAMILO, "10:00", "c1@example.com"],
    [VALENTINA, "12:00", "v1@example.com"],
    [JULIAN, "14:00", "j1@example.com"],
  ]) {
    await as(db, { role: "service_role" }, (tx) =>
      tx.query("select public.book_appointment($1, $2, $3, 'Cliente', $4, $5)", [
        SHOP,
        SERVICE_CUT,
        bogota(TUESDAY, time),
        email,
        barber,
      ]),
    );
  }
});

const user = (userId: string) => ({ role: "authenticated" as const, userId });

async function count(actor: Parameters<typeof as>[1], sql: string, params: unknown[] = []) {
  return as(db, actor, async (tx) => (await tx.query(sql, params)).rows.length);
}

describe("aislamiento de datos", () => {
  it("anon no ve citas, clientes, URLs de push ni horarios internos", async () => {
    const anon = { role: "anon" as const };
    // Ni siquiera tiene GRANT: error de permisos, no "0 filas".
    for (const table of [
      "appointments",
      "customers",
      "barber_private",
      "memberships",
      "time_off_requests",
      "barber_schedules",
      "notification_log",
    ]) {
      await expect(count(anon, `select * from public.${table}`)).rejects.toThrow(/permission denied/);
    }
    // Pero sí ve el catálogo público.
    expect(await count(anon, "select * from public.services")).toBe(6);
    expect(await count(anon, "select * from public.barbers")).toBe(3);
  });

  it("un barbero solo ve SUS citas y los clientes de sus citas", async () => {
    const rows = await as(db, user(camiloUser), (tx) =>
      tx.query<{ barber_id: string }>("select barber_id from public.appointments"),
    );
    expect(rows.rows.map((r) => r.barber_id)).toEqual([CAMILO]);

    const customers = await as(db, user(camiloUser), (tx) =>
      tx.query<{ email: string }>("select email from public.customers"),
    );
    expect(customers.rows.map((r) => r.email)).toEqual(["c1@example.com"]);
  });

  it("el admin ve todas las citas y, como barbero, su propia agenda", async () => {
    expect(await count(user(ownerUser), "select * from public.appointments")).toBe(3);
    expect(
      await count(
        user(ownerUser),
        "select * from public.appointments where barber_id in (select public.my_barber_ids())",
      ),
    ).toBe(1);
  });

  it("un barbero no puede modificar citas de otro barbero", async () => {
    const r = await as(db, user(camiloUser), (tx) =>
      tx.query("update public.appointments set status = 'cancelled' where barber_id = $1", [
        VALENTINA,
      ]),
    );
    expect(r.affectedRows).toBe(0);
  });

  it("el staff no puede mover horario, barbero ni precio de una cita", async () => {
    await expect(
      as(db, user(ownerUser), (tx) =>
        tx.query("update public.appointments set price_cop = 0"),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, user(camiloUser), (tx) =>
        tx.query(
          "insert into public.appointments (barbershop_id, barber_id, customer_id, starts_at, ends_at, service_name, price_cop) values ($1, $2, gen_random_uuid(), now(), now() + interval '1 hour', 'x', 0)",
          [SHOP, CAMILO],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("un barbero no puede leer la URL de push de otro", async () => {
    await db.query(
      "insert into public.barber_private (barber_id, barbershop_id, hook_url) values ($1, $2, 'https://hooknotifier.com/1/v'), ($3, $2, 'https://hooknotifier.com/2/c')",
      [VALENTINA, SHOP, CAMILO],
    );
    const r = await as(db, user(camiloUser), (tx) =>
      tx.query<{ barber_id: string }>("select barber_id from public.barber_private"),
    );
    expect(r.rows.map((x) => x.barber_id)).toEqual([CAMILO]);
  });
});

describe("estados de la cita", () => {
  it("no se puede completar una cita futura ni revivir una cancelada", async () => {
    await expect(
      as(db, user(camiloUser), (tx) => tx.query("update public.appointments set status = 'completed'")),
    ).rejects.toThrow(/APPOINTMENT_NOT_STARTED/);

    await as(db, user(camiloUser), (tx) =>
      tx.query("update public.appointments set status = 'cancelled', cancel_reason = 'Enfermo'"),
    );
    const row = await db.query<{ cancelled_by: string }>(
      "select cancelled_by from public.appointments where barber_id = $1",
      [CAMILO],
    );
    expect(row.rows[0].cancelled_by).toBe("staff");

    await expect(
      as(db, user(camiloUser), (tx) => tx.query("update public.appointments set status = 'confirmed'")),
    ).rejects.toThrow(/INVALID_TRANSITION/);
  });
});

describe("solicitudes de indisponibilidad", () => {
  const insertTimeOff = (userId: string, barber: string, status = "approved") =>
    as(db, user(userId), (tx) =>
      tx.query<{ status: string; reviewed_by: string | null }>(
        `insert into public.time_off_requests (barbershop_id, barber_id, starts_at, ends_at, reason, status)
         values ($1, $2, $3, $4, 'Vacaciones', $5) returning status, reviewed_by`,
        [SHOP, barber, bogota(TUESDAY, "08:00"), bogota(TUESDAY, "20:00"), status],
      ),
    );

  it("un barbero solo crea solicitudes PENDIENTES, aunque intente aprobarlas", async () => {
    const r = await insertTimeOff(camiloUser, CAMILO, "approved");
    expect(r.rows[0]).toEqual({ status: "pending", reviewed_by: null });
  });

  it("un barbero no puede solicitar por otro barbero", async () => {
    await expect(insertTimeOff(camiloUser, VALENTINA)).rejects.toThrow(/row-level security/);
  });

  it("un barbero no puede aprobar su propia solicitud", async () => {
    await insertTimeOff(camiloUser, CAMILO);
    const r = await as(db, user(camiloUser), (tx) =>
      tx.query("update public.time_off_requests set status = 'approved'"),
    );
    expect(r.affectedRows).toBe(0);
  });

  it("las solicitudes del dueño (admin) se aprueban solas con constancia", async () => {
    const r = await insertTimeOff(ownerUser, JULIAN, "pending");
    expect(r.rows[0]).toEqual({ status: "approved", reviewed_by: ownerUser });
  });

  it("el admin aprueba y ve las citas en conflicto", async () => {
    await insertTimeOff(camiloUser, CAMILO);
    const id = (await db.query<{ id: string }>("select id from public.time_off_requests")).rows[0].id;

    const conflicts = await as(db, user(ownerUser), (tx) =>
      tx.query("select * from public.time_off_conflicts($1)", [id]),
    );
    expect(conflicts.rows).toHaveLength(1);

    await as(db, user(ownerUser), (tx) =>
      tx.query("update public.time_off_requests set status = 'approved' where id = $1", [id]),
    );
    const row = await db.query<{ status: string; reviewed_by: string }>(
      "select status, reviewed_by from public.time_off_requests",
    );
    expect(row.rows[0]).toEqual({ status: "approved", reviewed_by: ownerUser });
  });
});

describe("administración", () => {
  it("la barbería nunca se queda sin administrador", async () => {
    await expect(
      as(db, user(ownerUser), (tx) =>
        tx.query("update public.memberships set roles = '{barber}' where user_id = $1", [ownerUser]),
      ),
    ).rejects.toThrow(/LAST_ADMIN/);
  });

  it("un barbero no puede darse rol admin ni crear servicios", async () => {
    const r = await as(db, user(camiloUser), (tx) =>
      tx.query("update public.memberships set roles = '{admin,barber}' where user_id = $1", [camiloUser]),
    );
    expect(r.affectedRows).toBe(0);
    await expect(
      as(db, user(camiloUser), (tx) =>
        tx.query(
          "insert into public.services (barbershop_id, name, duration_min, price_cop) values ($1, 'Gratis', 30, 0)",
          [SHOP],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("horario semanal: admin lo reemplaza atómicamente; un barbero no puede", async () => {
    const ranges = [
      { weekday: 1, start: "09:00", end: "13:00" },
      { weekday: 1, start: "14:00", end: "19:00" },
    ];
    await as(db, user(ownerUser), (tx) =>
      tx.query("select public.replace_weekly_hours($1, null, $2)", [SHOP, JSON.stringify(ranges)]),
    );
    expect((await db.query("select * from public.business_hours")).rows).toHaveLength(2);

    // Franjas solapadas → error y el horario anterior queda intacto.
    const overlapping = [...ranges, { weekday: 1, start: "12:00", end: "15:00" }];
    await expect(
      as(db, user(ownerUser), (tx) =>
        tx.query("select public.replace_weekly_hours($1, null, $2)", [SHOP, JSON.stringify(overlapping)]),
      ),
    ).rejects.toThrow(/OVERLAPPING_HOURS/);
    expect((await db.query("select * from public.business_hours")).rows).toHaveLength(2);

    await expect(
      as(db, user(camiloUser), (tx) =>
        tx.query("select public.replace_weekly_hours($1, $2, '[]')", [SHOP, CAMILO]),
      ),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("insights solo para admin", async () => {
    const from = bogota(TUESDAY, "00:00");
    const to = bogota(nextWeekday(3), "00:00");
    const r = await as(db, user(ownerUser), (tx) =>
      tx.query<{ r: { total: number; upcoming: number; expected_cop: number } }>(
        "select public.shop_insights($1, $2, $3) as r",
        [SHOP, from, to],
      ),
    );
    expect(r.rows[0].r).toMatchObject({ total: 3, upcoming: 3, expected_cop: 90000 });

    await expect(
      as(db, user(camiloUser), (tx) =>
        tx.query("select public.shop_insights($1, $2, $3)", [SHOP, from, to]),
      ),
    ).rejects.toThrow(/FORBIDDEN/);
  });

  it("el staff puede agendar citas por teléfono; un usuario ajeno no", async () => {
    const r = await as(db, user(valentinaUser), (tx) =>
      tx.query<{ r: { barber_id: string } }>(
        "select public.book_appointment($1, $2, $3, 'Walk In', 'walkin@example.com', $4, null, 'staff') as r",
        [SHOP, SERVICE_CUT, bogota(TUESDAY, "16:00"), VALENTINA],
      ),
    );
    expect(r.rows[0].r.barber_id).toBe(VALENTINA);

    const stranger = (
      await db.query<{ id: string }>("insert into auth.users (email) values ('x@x.co') returning id")
    ).rows[0].id;
    await expect(
      as(db, user(stranger), (tx) =>
        tx.query("select public.book_appointment($1, $2, $3, 'X Y', 'x@y.co', $4)", [
          SHOP,
          SERVICE_CUT,
          bogota(TUESDAY, "17:00"),
          VALENTINA,
        ]),
      ),
    ).rejects.toThrow(/FORBIDDEN/);
  });
});
