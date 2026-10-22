import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresión: las notificaciones de cancelación y reprogramación embebían
 * `shop:barbershops(...)` en la consulta de appointments. Sin FK directa,
 * PostgREST respondía PGRST200 y el push al barbero se perdía sin dejar rastro.
 */

type Result = { data: unknown; error: { code?: string; message?: string } | null };

const selects: Record<string, string[]> = {};
const inserts: Record<string, unknown>[] = [];
let results: Record<string, Result>;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    siteUrl: () => "https://barberia.test",
    resendApiKey: () => "re_test",
    emailFrom: () => "Barbería <citas@barberia.test>",
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q = {
        select: (cols: string) => {
          (selects[table] ??= []).push(cols);
          return q;
        },
        eq: () => q,
        single: async () => results[table],
        maybeSingle: async () => results[table],
        insert: async (row: Record<string, unknown>) => {
          inserts.push(row);
          return { error: null };
        },
      };
      return q;
    },
  }),
}));

import { notifyBookingCancelled, notifyBookingRescheduled } from "@/lib/domain/notifications";

const SHOP = "00000000-0000-4000-a000-000000000001";
const APPT = "11111111-1111-4111-a111-111111111111";
const HOOK = "https://hooknotifier.com/123/clave";

const fetchMock = vi.fn();

beforeEach(() => {
  for (const k of Object.keys(selects)) delete selects[k];
  inserts.length = 0;
  fetchMock.mockReset().mockImplementation(async () => new Response('{"status":"ok"}'));
  vi.stubGlobal("fetch", fetchMock);
  results = {
    appointments: {
      data: {
        barbershop_id: SHOP,
        barber_id: "b1",
        starts_at: "2026-10-27T20:00:00Z",
        service_name: "Corte",
        price_cop: 30000,
        barber: { display_name: "Camilo" },
        customer: { name: "Ana Pérez", email: "ana@example.com" },
      },
      error: null,
    },
    barbershops: {
      data: { name: "Urban Styles", address: "Calle 1", phone: null, timezone: "America/Bogota", cancel_notice_min: 120 },
      error: null,
    },
    barber_private: { data: { hook_url: HOOK }, error: null },
  };
});

const urls = () => fetchMock.mock.calls.map((c) => String(c[0]));

describe("notifyBookingCancelled", () => {
  it("envía el push al barbero y lo registra como enviado", async () => {
    await notifyBookingCancelled(SHOP, APPT);
    expect(urls()).toEqual([HOOK]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).object).toMatch(/^Cita cancelada/);
    expect(inserts).toEqual([expect.objectContaining({ channel: "push", event: "booking_cancelled", status: "sent" })]);
  });

  it("no embebe barbershops en la consulta de la cita", async () => {
    await notifyBookingCancelled(SHOP, APPT);
    expect(selects.appointments.join()).not.toMatch(/barbershops\(/);
  });

  it("si la consulta falla, deja un registro 'failed' en vez de callar", async () => {
    results.appointments = { data: null, error: { code: "PGRST200", message: "Could not find a relationship" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    await notifyBookingCancelled(SHOP, APPT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(inserts).toEqual([
      expect.objectContaining({
        barbershop_id: SHOP,
        event: "booking_cancelled",
        status: "failed",
        detail: expect.stringContaining("PGRST200"),
      }),
    ]);
  });
});

describe("notifyBookingRescheduled", () => {
  it("envía el push al barbero y el correo al cliente", async () => {
    await notifyBookingRescheduled(SHOP, APPT, "2026-10-27T15:00:00Z", "token-del-enlace");
    expect(urls()).toEqual(expect.arrayContaining([HOOK, "https://api.resend.com/emails"]));
    expect(inserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "push", event: "booking_rescheduled", status: "sent" }),
        expect.objectContaining({ channel: "email", event: "booking_rescheduled", status: "sent" }),
      ]),
    );
    expect(selects.appointments.join()).not.toMatch(/barbershops\(/);
  });

  it("si la barbería no se puede leer, lo registra como 'failed'", async () => {
    results.barbershops = { data: null, error: { code: "PGRST116", message: "0 rows" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    await notifyBookingRescheduled(SHOP, APPT, "2026-10-27T15:00:00Z", "token-del-enlace");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(inserts).toEqual([
      expect.objectContaining({ event: "booking_rescheduled", status: "failed", detail: expect.stringContaining("PGRST116") }),
    ]);
  });
});
