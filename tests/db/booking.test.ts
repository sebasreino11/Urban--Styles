import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import {
  as,
  bogota,
  CAMILO,
  createTestDb,
  JULIAN,
  nextWeekday,
  SERVICE_COMBO,
  SERVICE_CUT,
  SHOP,
  VALENTINA,
} from "./harness";

type Slot = { slot_start: string; barber_ids: string[] };

const TUESDAY = nextWeekday(2);
const MONDAY = nextWeekday(1);

let db: PGlite;
beforeEach(async () => {
  db = await createTestDb();
});

async function slots(date: string, barber: string | null, service = SERVICE_CUT) {
  return as(db, { role: "anon" }, async (tx) => {
    const r = await tx.query<Slot>(
      "select slot_start, barber_ids from public.get_available_slots($1, $2, $3, $4)",
      [SHOP, service, date, barber],
    );
    return r.rows.map((s) => ({ at: new Date(s.slot_start).toISOString(), barbers: s.barber_ids }));
  });
}

async function book(
  startsAt: string,
  barber: string | null,
  email = "cliente@example.com",
  service = SERVICE_CUT,
) {
  return as(db, { role: "service_role" }, async (tx) => {
    const r = await tx.query<{ r: Record<string, string> }>(
      "select public.book_appointment($1, $2, $3, 'Cliente Demo', $4, $5) as r",
      [SHOP, service, startsAt, email, barber],
    );
    return r.rows[0].r;
  });
}

describe("get_available_slots", () => {
  it("intersecta horario comercial y laboral, y el servicio debe caber completo", async () => {
    const s = await slots(TUESDAY, CAMILO);
    // Camilo trabaja 09:00–18:00 los martes; un corte dura 45 min.
    expect(s[0].at).toBe(bogota(TUESDAY, "09:00"));
    expect(s.at(-1)!.at).toBe(bogota(TUESDAY, "17:15"));
    expect(s).toHaveLength(34); // 09:00 … 17:15 cada 15 min
  });

  it("'cualquier barbero' lista a todos los libres en cada horario", async () => {
    const s = await slots(TUESDAY, null);
    expect(s.find((x) => x.at === bogota(TUESDAY, "09:00"))!.barbers).toEqual([CAMILO]);
    expect(s.find((x) => x.at === bogota(TUESDAY, "11:00"))!.barbers.sort()).toEqual(
      [CAMILO, VALENTINA, JULIAN].sort(),
    );
    // Valentina trabaja hasta las 20:00: último corte posible 19:15.
    expect(s.at(-1)!.at).toBe(bogota(TUESDAY, "19:15"));
  });

  it("un barbero en su día de descanso no tiene horarios", async () => {
    expect(await slots(MONDAY, VALENTINA)).toHaveLength(0);
  });

  it("no ofrece fechas pasadas ni fuera del horizonte de reserva", async () => {
    expect(await slots("2020-01-07", CAMILO)).toHaveLength(0);
    expect(await slots(nextWeekday(2, 40), CAMILO)).toHaveLength(0);
  });

  it("una cita ocupa su duración completa", async () => {
    await book(bogota(TUESDAY, "10:00"), CAMILO);
    const at = (await slots(TUESDAY, CAMILO)).map((x) => x.at);
    // La cita bloquea 10:00–10:45 más 15 min de tiempo muerto (hasta 11:00), y
    // cada slot candidato también arrastra sus 15 min: 09:15 (10:00 + 15) y
    // 10:45 chocan; 09:00 y 11:00 no.
    expect(at).toContain(bogota(TUESDAY, "09:00"));
    expect(at).not.toContain(bogota(TUESDAY, "09:15"));
    expect(at).not.toContain(bogota(TUESDAY, "10:00"));
    expect(at).not.toContain(bogota(TUESDAY, "10:45"));
    expect(at).toContain(bogota(TUESDAY, "11:00"));
  });

  it("solo la indisponibilidad APROBADA bloquea la agenda", async () => {
    await db.query(
      `insert into public.time_off_requests (barbershop_id, barber_id, starts_at, ends_at, reason, status)
       values ($1, $2, $3, $4, 'Cita médica', 'pending')`,
      [SHOP, CAMILO, bogota(TUESDAY, "09:00"), bogota(TUESDAY, "12:00")],
    );
    expect((await slots(TUESDAY, CAMILO))[0].at).toBe(bogota(TUESDAY, "09:00"));

    await db.query("update public.time_off_requests set status = 'approved'");
    expect((await slots(TUESDAY, CAMILO))[0].at).toBe(bogota(TUESDAY, "12:00"));
  });
});

describe("get_available_days", () => {
  it("marca los días con disponibilidad y omite los de descanso", async () => {
    const from = nextWeekday(1); // lunes
    const to = new Date(Date.parse(`${from}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10); // domingo de esa semana
    const days = await as(db, { role: "anon" }, async (tx) =>
      (
        await tx.query<{ day: string | Date }>(
          "select day from public.get_available_days($1, $2, $3, $4, $5)",
          [SHOP, SERVICE_CUT, from, to, VALENTINA],
        )
      ).rows.map((r) => new Date(r.day).toISOString().slice(0, 10)),
    );
    expect(days).not.toContain(from); // Valentina descansa los lunes
    expect(days.length).toBeGreaterThanOrEqual(5);
  });
});

describe("book_appointment", () => {
  it("el público (anon) no puede reservar directamente contra la BD", async () => {
    await expect(
      as(db, { role: "anon" }, (tx) =>
        tx.query("select public.book_appointment($1, $2, $3, 'X Y', 'x@y.co')", [
          SHOP,
          SERVICE_CUT,
          bogota(TUESDAY, "10:00"),
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("crea la cita confirmada y guarda solo el hash del token", async () => {
    const r = await book(bogota(TUESDAY, "10:00"), CAMILO, "Ana@Example.com ");
    expect(r.barber_id).toBe(CAMILO);
    expect(r.price_cop).toBe(30000);
    expect(r.customer_email).toBe("ana@example.com");
    expect(r.cancel_token).toMatch(/^[0-9a-f]{64}$/);

    const row = await db.query<{ status: string; cancel_token_hash: string }>(
      "select status, cancel_token_hash from public.appointments",
    );
    expect(row.rows[0].status).toBe("confirmed");
    expect(row.rows[0].cancel_token_hash).not.toBe(r.cancel_token);
  });

  it("rechaza un horario ya ocupado y uno que no existe en la grilla", async () => {
    await book(bogota(TUESDAY, "10:00"), CAMILO);
    await expect(book(bogota(TUESDAY, "10:15"), CAMILO, "otro@example.com")).rejects.toThrow(
      /SLOT_UNAVAILABLE/,
    );
    await expect(book(bogota(TUESDAY, "10:07"), JULIAN)).rejects.toThrow(/SLOT_UNAVAILABLE/);
  });

  it("'cualquier barbero' asigna al que tiene menos citas ese día", async () => {
    await book(bogota(TUESDAY, "11:00"), CAMILO, "a@example.com");
    await book(bogota(TUESDAY, "12:00"), VALENTINA, "b@example.com");
    const r = await book(bogota(TUESDAY, "15:00"), null, "c@example.com");
    expect(r.barber_id).toBe(JULIAN);
  });

  it("la constraint de exclusión impide solapes aunque se salte la validación", async () => {
    await book(bogota(TUESDAY, "10:00"), CAMILO);
    // Inserción directa simulando una carrera que pasó la revalidación.
    await expect(
      db.query(
        `insert into public.appointments (barbershop_id, barber_id, customer_id, starts_at, ends_at, service_name, price_cop)
         select $1, $2, id, $3, $4, 'x', 0 from public.customers limit 1`,
        [SHOP, CAMILO, bogota(TUESDAY, "10:30"), bogota(TUESDAY, "11:00")],
      ),
    ).rejects.toThrow(/appointments_no_overlap/);
  });

  it("una cita cancelada libera el horario", async () => {
    const r = await book(bogota(TUESDAY, "10:00"), CAMILO);
    await as(db, { role: "service_role" }, (tx) =>
      tx.query("select public.cancel_appointment_by_token($1)", [r.cancel_token]),
    );
    const again = await book(bogota(TUESDAY, "10:00"), CAMILO, "otro@example.com");
    expect(again.barber_id).toBe(CAMILO);
  });

  it("servicios largos solo caben si hay espacio suficiente", async () => {
    // Corte + barba = 75 min; Camilo sale a las 18:00 → último inicio 16:45.
    const s = await slots(TUESDAY, CAMILO, SERVICE_COMBO);
    expect(s.at(-1)!.at).toBe(bogota(TUESDAY, "16:45"));
  });
});

describe("cancelación por token", () => {
  it("cancela una vez y marca cancelled_by = customer", async () => {
    const r = await book(bogota(TUESDAY, "10:00"), CAMILO);
    const cancel = (token: string) =>
      as(db, { role: "service_role" }, (tx) =>
        tx.query<{ r: { status: string } }>("select public.cancel_appointment_by_token($1) as r", [
          token,
        ]),
      );
    expect((await cancel(r.cancel_token)).rows[0].r.status).toBe("cancelled");
    await expect(cancel(r.cancel_token)).rejects.toThrow(/NOT_CANCELLABLE/);
    await expect(cancel("token-falso")).rejects.toThrow(/APPOINTMENT_NOT_FOUND/);

    const row = await db.query<{ cancelled_by: string }>("select cancelled_by from public.appointments");
    expect(row.rows[0].cancelled_by).toBe("customer");
  });

  it("anon no puede consultar ni cancelar por token directamente", async () => {
    await expect(
      as(db, { role: "anon" }, (tx) => tx.query("select public.get_appointment_by_token('x')")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("reprogramación por token", () => {
  const reschedule = (token: string, startsAt: string) =>
    as(db, { role: "service_role" }, (tx) =>
      tx.query<{ r: Record<string, string> }>(
        "select public.reschedule_appointment_by_token($1, $2) as r",
        [token, startsAt],
      ),
    );

  it("mueve la misma cita: conserva id, estado, barbero y token", async () => {
    const r = await book(bogota(TUESDAY, "10:00"), CAMILO);
    const moved = (await reschedule(r.cancel_token, bogota(TUESDAY, "15:00"))).rows[0].r;

    expect(moved.appointment_id).toBe(r.appointment_id);
    expect(moved.status).toBe("confirmed");
    expect(moved.barber_id).toBe(CAMILO);
    expect(new Date(moved.starts_at).toISOString()).toBe(bogota(TUESDAY, "15:00"));
    expect(new Date(moved.previous_starts_at).toISOString()).toBe(bogota(TUESDAY, "10:00"));

    // El enlace original sigue funcionando y el horario viejo queda libre.
    const again = await as(db, { role: "service_role" }, (tx) =>
      tx.query<{ r: { starts_at: string } }>("select public.get_appointment_by_token($1) as r", [r.cancel_token]),
    );
    expect(new Date(again.rows[0].r.starts_at).toISOString()).toBe(bogota(TUESDAY, "15:00"));
    expect((await slots(TUESDAY, CAMILO)).map((s) => s.at)).toContain(bogota(TUESDAY, "10:00"));
  });

  it("permite moverse a un horario que se solapa con el actual", async () => {
    const r = await book(bogota(TUESDAY, "10:00"), CAMILO);
    // Sin excluir la propia cita, 10:15 estaría ocupado por ella misma.
    expect((await slots(TUESDAY, CAMILO)).map((s) => s.at)).not.toContain(bogota(TUESDAY, "10:15"));
    const moved = (await reschedule(r.cancel_token, bogota(TUESDAY, "10:15"))).rows[0].r;
    expect(new Date(moved.starts_at).toISOString()).toBe(bogota(TUESDAY, "10:15"));
  });

  it("rechaza horario ocupado, mismo horario, token falso y citas no reprogramables", async () => {
    const a = await book(bogota(TUESDAY, "10:00"), CAMILO, "a@example.com");
    await book(bogota(TUESDAY, "12:00"), CAMILO, "b@example.com");

    await expect(reschedule(a.cancel_token, bogota(TUESDAY, "12:00"))).rejects.toThrow(/SLOT_UNAVAILABLE/);
    await expect(reschedule(a.cancel_token, bogota(TUESDAY, "10:00"))).rejects.toThrow(/SAME_SLOT/);
    await expect(reschedule("token-falso", bogota(TUESDAY, "15:00"))).rejects.toThrow(/APPOINTMENT_NOT_FOUND/);

    await as(db, { role: "service_role" }, (tx) =>
      tx.query("select public.cancel_appointment_by_token($1)", [a.cancel_token]),
    );
    await expect(reschedule(a.cancel_token, bogota(TUESDAY, "15:00"))).rejects.toThrow(/NOT_RESCHEDULABLE/);
  });

  it("solo deja reprogramar una vez; cancelar sigue disponible", async () => {
    const r = await book(bogota(TUESDAY, "10:00"), CAMILO);
    const byToken = async () =>
      (
        await as(db, { role: "service_role" }, (tx) =>
          tx.query<{ r: { starts_at: string; can_reschedule: boolean; can_cancel: boolean; rescheduled_at: string | null } }>(
            "select public.get_appointment_by_token($1) as r",
            [r.cancel_token],
          ),
        )
      ).rows[0].r;

    const before = await byToken();
    expect(before.can_reschedule).toBe(true);
    expect(before.rescheduled_at).toBeNull();

    const moved = (await reschedule(r.cancel_token, bogota(TUESDAY, "15:00"))).rows[0].r;
    expect(moved.can_reschedule).toBe(false);
    expect(moved.rescheduled_at).not.toBeNull();

    await expect(reschedule(r.cancel_token, bogota(TUESDAY, "16:00"))).rejects.toThrow(/ALREADY_RESCHEDULED/);
    // El intento fallido no movió la cita.
    const after = await byToken();
    expect(new Date(after.starts_at).toISOString()).toBe(bogota(TUESDAY, "15:00"));
    expect(after.can_reschedule).toBe(false);
    expect(after.can_cancel).toBe(true);

    const cancelled = await as(db, { role: "service_role" }, (tx) =>
      tx.query<{ r: { status: string } }>("select public.cancel_appointment_by_token($1) as r", [r.cancel_token]),
    );
    expect(cancelled.rows[0].r.status).toBe("cancelled");
  });

  it("un intento de reprogramar que falla no gasta la reprogramación", async () => {
    const a = await book(bogota(TUESDAY, "10:00"), CAMILO, "a@example.com");
    await book(bogota(TUESDAY, "12:00"), CAMILO, "b@example.com");
    await expect(reschedule(a.cancel_token, bogota(TUESDAY, "12:00"))).rejects.toThrow(/SLOT_UNAVAILABLE/);
    const moved = (await reschedule(a.cancel_token, bogota(TUESDAY, "15:00"))).rows[0].r;
    expect(new Date(moved.starts_at).toISOString()).toBe(bogota(TUESDAY, "15:00"));
  });

  it("no deja reprogramar dentro de la ventana de aviso", async () => {
    const r = await book(bogota(TUESDAY, "10:00"), CAMILO);
    await db.query("update public.appointments set starts_at = now() + interval '30 minutes', ends_at = now() + interval '75 minutes'");
    await expect(reschedule(r.cancel_token, bogota(TUESDAY, "15:00"))).rejects.toThrow(/TOO_LATE_TO_RESCHEDULE/);
  });

  it("anon no puede reprogramar directamente", async () => {
    await expect(
      as(db, { role: "anon" }, (tx) =>
        tx.query("select public.reschedule_appointment_by_token('x', now())"),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
