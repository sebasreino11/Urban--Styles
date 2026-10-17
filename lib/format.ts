/**
 * Formato de moneda y fechas en la zona horaria de la barbería.
 * Se usa Intl (disponible en Workers y navegadores) en lugar de librerías de
 * fechas para mantener el bundle dentro del límite del plan gratuito.
 */

const LOCALE = "es-CO";

export function formatCOP(value: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(iso))
    .replace(/\s?a\.\s?m\./i, " a. m.")
    .replace(/\s?p\.\s?m\./i, " p. m.");
}

export function formatDate(iso: string, timeZone: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...opts,
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, timeZone: string): string {
  return `${formatDate(iso, timeZone)} · ${formatTime(iso, timeZone)}`;
}

/** Fecha local YYYY-MM-DD de un instante en la zona dada. */
export function localDate(iso: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
  return parts; // en-CA produce YYYY-MM-DD
}

/** Suma días a una fecha YYYY-MM-DD (aritmética de calendario, sin zona). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha YYYY-MM-DD. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/**
 * Convierte fecha + hora locales de la barbería a un instante ISO (UTC).
 * Calcula el desfase real de la zona en esa fecha (soporta horario de verano
 * si una barbería futura está en una zona que lo use).
 */
export function zonedToUtc(date: string, time: string, timeZone: string): string {
  const naive = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}Z`);
  const asLocal = new Date(naive.toLocaleString("en-US", { timeZone }));
  const asUtc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = asLocal.getTime() - asUtc.getTime();
  return new Date(naive.getTime() - offset).toISOString();
}

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function formatHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "p. m." : "a. m.";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
