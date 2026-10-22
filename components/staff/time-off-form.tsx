"use client";

import { useState, useTransition } from "react";
import { requestTimeOff } from "@/app/(staff)/actions";
import { buttonClass, Field, inputClass } from "./ui";

export function TimeOffForm({
  barberId,
  today,
  autoApproved,
}: {
  barberId: string;
  today: string;
  autoApproved: boolean;
}) {
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [allDay, setAllDay] = useState(true);
  const [fromTime, setFromTime] = useState("12:00");
  const [toTime, setToTime] = useState("14:00");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await requestTimeOff({ barberId, fromDate, toDate, allDay, fromTime, toTime, reason });
      if (r.ok) {
        setReason("");
        setMessage({
          ok: true,
          text:
            r.data.status === "approved"
              ? "Listo. Ese tiempo ya no se puede reservar."
              : "Solicitud enviada. Te avisaremos aquí cuando el administrador la revise.",
        });
      } else setMessage({ ok: false, text: r.message });
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4 self-start rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-2xl font-extrabold uppercase text-primary">
        {autoApproved ? "Bloquear tiempo" : "Nueva solicitud"}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde">
          <input type="date" className={inputClass} value={fromDate} min={today} required
            onChange={(e) => { setFromDate(e.target.value); if (e.target.value > toDate) setToDate(e.target.value); }} />
        </Field>
        <Field label="Hasta">
          <input type="date" className={inputClass} value={toDate} min={fromDate} required onChange={(e) => setToDate(e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-[hsl(var(--primary))]" />
        Días completos
      </label>
      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hora inicio" hint={fromDate}>
            <input type="time" className={inputClass} value={fromTime} step={900} required onChange={(e) => setFromTime(e.target.value)} />
          </Field>
          <Field label="Hora fin" hint={toDate}>
            <input type="time" className={inputClass} value={toTime} step={900} required onChange={(e) => setToTime(e.target.value)} />
          </Field>
        </div>
      )}
      <Field label="Motivo" hint="Ayuda al administrador a decidir.">
        <textarea className={`${inputClass} h-20 py-2`} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} />
      </Field>
      <button className={buttonClass.primary} disabled={pending}>
        {pending ? "Enviando" : autoApproved ? "Bloquear" : "Enviar solicitud"}
      </button>
      {message && (
        <p role="status" className={message.ok ? "text-sm text-success" : "text-sm text-destructive"}>
          {message.text}
        </p>
      )}
    </form>
  );
}
