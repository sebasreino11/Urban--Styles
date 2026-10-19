import { describe, expect, it } from "vitest";
import { barberProfileSchema, timeOffRequestSchema } from "@/lib/validation/staff";

// IDs del seed: los barberos usan el nibble de variante "c", que z.uuid() estricto rechaza.
const BARBER_ID = "00000000-0000-4000-c000-000000000001";
const SERVICE_ID = "00000000-0000-4000-b000-000000000001";

describe("validación de staff con IDs del seed", () => {
  it("acepta el perfil de un barbero del seed", () => {
    const r = barberProfileSchema.safeParse({
      id: BARBER_ID,
      displayName: "Camilo Rojas",
      bio: "",
      photoUrl: "",
      active: true,
      serviceIds: [SERVICE_ID],
    });
    expect(r.success).toBe(true);
  });

  it("acepta una solicitud de día libre de un barbero del seed", () => {
    const r = timeOffRequestSchema.safeParse({
      barberId: BARBER_ID,
      fromDate: "2026-10-20",
      toDate: "2026-10-20",
      allDay: true,
      reason: "Cita médica",
    });
    expect(r.success).toBe(true);
  });

  it("sigue rechazando IDs vacíos", () => {
    expect(timeOffRequestSchema.safeParse({ barberId: "", fromDate: "2026-10-20", toDate: "2026-10-20", allDay: true, reason: "Motivo" }).success).toBe(false);
  });
});
