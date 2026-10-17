import { addDays, formatDate } from "@/lib/format";

/**
 * Gráficos mínimos en HTML/CSS (sin librerías: el bundle del Worker es
 * limitado). Una sola serie por gráfico → un solo tono (verde botella), sin
 * leyenda; valores rotulados directamente y tabla accesible.
 */

export function HBar({
  label,
  value,
  max,
  display,
  detail,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  detail?: string;
}) {
  const width = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="grid gap-1" title={`${label}: ${display}${detail ? ` · ${detail}` : ""}`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{display}</span>
          {detail && <span className="ml-2 text-muted-foreground">{detail}</span>}
        </span>
      </div>
      <div className="h-2 rounded-r bg-muted">
        <div className="h-2 rounded-r bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function DailyBars({
  daily,
  fromDate,
  days,
  timezone,
}: {
  daily: { day: string; booked: number; cancelled: number }[];
  fromDate: string;
  days: number;
  timezone: string;
}) {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = addDays(fromDate, i);
    return { day, booked: byDay.get(day)?.booked ?? 0, cancelled: byDay.get(day)?.cancelled ?? 0 };
  });
  const max = Math.max(1, ...series.map((d) => d.booked));
  const label = (day: string) => formatDate(`${day}T17:00:00Z`, timezone, { weekday: "short", month: "short" });

  return (
    <figure>
      <div className="flex h-40 items-end gap-[2px] border-b border-border" aria-hidden>
        {series.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80"
              style={{ height: d.booked ? `${(d.booked / max) * 100}%` : 0 }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
              <span className="capitalize">{label(d.day)}</span>: {d.booked} {d.booked === 1 ? "cita" : "citas"}
              {d.cancelled > 0 && ` · ${d.cancelled} canc.`}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-xs capitalize text-muted-foreground">
        <span>{label(series[0].day)}</span>
        <span>máx. {max} por día</span>
        <span>{label(series.at(-1)!.day)}</span>
      </figcaption>
      <table className="sr-only">
        <caption>Citas por día</caption>
        <thead>
          <tr><th>Día</th><th>Citas</th><th>Canceladas</th></tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.day}><td>{d.day}</td><td>{d.booked}</td><td>{d.cancelled}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
