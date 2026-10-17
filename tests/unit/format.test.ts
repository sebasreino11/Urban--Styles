import { describe, expect, it } from "vitest";
import { addDays, formatCOP, localDate, weekdayOf, zonedToUtc } from "@/lib/format";
import { safeNext } from "@/lib/safe-redirect";
import { bookingInputSchema } from "@/lib/validation/booking";

describe("formato y zonas horarias", () => {
  it("formatea pesos colombianos sin decimales", () => {
    expect(formatCOP(35000).replace(/\s/g, " ")).toBe("$ 35.000");
  });

  it("convierte hora local de Bogotá (UTC-5) a UTC", () => {
    expect(zonedToUtc("2026-11-03", "09:00", "America/Bogota")).toBe("2026-11-03T14:00:00.000Z");
    expect(zonedToUtc("2026-11-03", "00:00", "America/Bogota")).toBe("2026-11-03T05:00:00.000Z");
  });

  it("respeta el horario de verano en zonas que lo usan", () => {
    expect(zonedToUtc("2026-07-01", "09:00", "America/New_York")).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "09:00", "America/New_York")).toBe("2026-12-01T14:00:00.000Z");
  });

  it("obtiene la fecha local aunque en UTC ya sea el día siguiente", () => {
    expect(localDate("2026-11-04T03:00:00Z", "America/Bogota")).toBe("2026-11-03");
  });

  it("aritmética de calendario", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOf("2026-11-03")).toBe(2); // martes
  });
});

describe("validación de reserva", () => {
  const base = {
    serviceId: "00000000-0000-4000-b000-000000000001",
    barberId: null,
    startsAt: "2026-11-03T14:00:00.000Z",
    name: "  Ana Pérez ",
    email: " ANA@Example.com ",
  };

  it("normaliza nombre y correo", () => {
    const r = bookingInputSchema.parse(base);
    expect(r.name).toBe("Ana Pérez");
    expect(r.email).toBe("ana@example.com");
    expect(r.phone).toBeNull();
  });

  it("rechaza correo inválido y nombre vacío", () => {
    expect(bookingInputSchema.safeParse({ ...base, email: "ana@" }).success).toBe(false);
    expect(bookingInputSchema.safeParse({ ...base, name: " " }).success).toBe(false);
  });
});

describe("redirecciones seguras", () => {
  it("solo permite rutas internas", () => {
    expect(safeNext("/admin", "/agenda")).toBe("/admin");
    expect(safeNext("https://evil.com", "/agenda")).toBe("/agenda");
    expect(safeNext("//evil.com", "/agenda")).toBe("/agenda");
    expect(safeNext(null, "/agenda")).toBe("/agenda");
  });
});
