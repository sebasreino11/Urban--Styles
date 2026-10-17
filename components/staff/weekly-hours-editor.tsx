"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { saveBarberSchedule, saveBusinessHours } from "@/app/(staff)/actions";
import { WEEKDAYS } from "@/lib/format";
import { buttonClass, inputClass } from "./ui";

type Range = { start: string; end: string };
type Week = Record<string, Range[]>;

const ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Editor de horario semanal con varias franjas por día (p. ej. cerrar a
 * almorzar). Sirve para el horario comercial y para el de cada barbero.
 */
export function WeeklyHoursEditor({
  initial,
  target,
}: {
  initial: { weekday: number; start: string; end: string }[];
  target: { kind: "shop" } | { kind: "barber"; barberId: string };
}) {
  const [week, setWeek] = useState<Week>(() => {
    const w: Week = Object.fromEntries(ORDER.map((d) => [String(d), []]));
    for (const r of initial) w[String(r.weekday)].push({ start: r.start.slice(0, 5), end: r.end.slice(0, 5) });
    return w;
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const update = (day: number, fn: (ranges: Range[]) => Range[]) =>
    setWeek((w) => ({ ...w, [String(day)]: fn(w[String(day)]) }));

  const save = () =>
    start(async () => {
      const r = target.kind === "shop" ? await saveBusinessHours(week) : await saveBarberSchedule(target.barberId, week);
      setMessage(r.ok ? { ok: true, text: "Horario guardado." } : { ok: false, text: r.message });
    });

  return (
    <div className="grid gap-1">
      {ORDER.map((d) => {
        const ranges = week[String(d)];
        return (
          <div key={d} className="grid grid-cols-[6.5rem_1fr] items-start gap-3 border-b border-border py-2.5">
            <p className="pt-2 text-sm font-medium">{WEEKDAYS[d]}</p>
            <div className="grid gap-2">
              {ranges.length === 0 && <p className="pt-2 text-sm text-muted-foreground">Cerrado</p>}
              {ranges.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="time" step={900} className={`${inputClass} w-32`} value={r.start} aria-label={`${WEEKDAYS[d]} desde`}
                    onChange={(e) => update(d, (rs) => rs.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                  <span className="text-muted-foreground">a</span>
                  <input type="time" step={900} className={`${inputClass} w-32`} value={r.end} aria-label={`${WEEKDAYS[d]} hasta`}
                    onChange={(e) => update(d, (rs) => rs.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                  <button type="button" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Quitar franja"
                    onClick={() => update(d, (rs) => rs.filter((_, j) => j !== i))}>
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <button type="button" className="inline-flex items-center gap-1 justify-self-start text-sm font-medium text-primary hover:underline"
                onClick={() => update(d, (rs) => [...rs, rs.length ? { start: "14:00", end: "18:00" } : { start: "09:00", end: "18:00" }])}>
                <Plus className="size-3.5" /> {ranges.length ? "Agregar franja" : "Abrir este día"}
              </button>
            </div>
          </div>
        );
      })}
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className={buttonClass.primary} onClick={save} disabled={pending}>
          {pending ? "Guardando" : "Guardar horario"}
        </button>
        {message && <p role="status" className={message.ok ? "text-sm text-success" : "text-sm text-destructive"}>{message.text}</p>}
      </div>
    </div>
  );
}
