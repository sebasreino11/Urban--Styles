"use client";

import { useEffect, useState, useTransition } from "react";
import { loadAvailableSlots } from "@/app/(public)/actions";
import { bookAsStaff } from "@/app/(staff)/actions";
import type { PublicBarber, Service, Slot } from "@/lib/domain/types";
import { formatCOP, formatDateTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonClass, Field, inputClass } from "./ui";

/**
 * Cita tomada por teléfono o en mostrador. Usa exactamente la misma
 * disponibilidad que el portal público.
 */
export function StaffBookingForm({
  services,
  barbers,
  timezone,
  today,
  defaultBarberId,
}: {
  services: Service[];
  barbers: PublicBarber[];
  timezone: string;
  today: string;
  defaultBarberId: string | null;
}) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [barberId, setBarberId] = useState<string>(defaultBarberId ?? "");
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!serviceId || !date) return;
    let cancelled = false;
    setSlots(null);
    setSlot(null);
    loadAvailableSlots(serviceId, barberId || null, date).then((r) => {
      if (cancelled) return;
      if (r.ok) setSlots(r.data);
      else {
        setSlots([]);
        setMessage({ ok: false, text: r.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId, barberId, date, reload]);

  const service = services.find((s) => s.id === serviceId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot) return;
    start(async () => {
      const r = await bookAsStaff({
        serviceId,
        barberId: barberId || null,
        startsAt: slot.startsAt,
        name,
        email,
        phone: phone || undefined,
      });
      if (r.ok) {
        setMessage({ ok: true, text: `Cita agendada con ${r.data.barberName}: ${formatDateTime(r.data.startsAt, timezone)}. El cliente recibirá el correo.` });
        setName("");
        setEmail("");
        setPhone("");
      } else setMessage({ ok: false, text: r.message });
      setReload((n) => n + 1);
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <Field label="Servicio">
          <select className={inputClass} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.duration_min} min · {formatCOP(s.price_cop)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Barbero">
          <select className={inputClass} value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            <option value="">El primero disponible</option>
            {barbers
              .filter((b) => b.service_ids.includes(serviceId))
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.display_name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Día">
          <input type="date" className={inputClass} value={date} min={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium">Hora</p>
          {!slots ? (
            <p className="text-sm text-muted-foreground">Buscando horarios…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay horarios libres ese día.</p>
          ) : (
            <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
              {slots.map((s) => (
                <li key={s.startsAt}>
                  <button
                    type="button"
                    onClick={() => setSlot(s)}
                    aria-pressed={slot?.startsAt === s.startsAt}
                    className={cn(
                      "h-9 w-full rounded-md border text-sm tabular-nums",
                      slot?.startsAt === s.startsAt ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
                    )}
                  >
                    {formatTime(s.startsAt, timezone)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid content-start gap-4 rounded-lg border border-border bg-card p-5">
        <Field label="Nombre del cliente">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </Field>
        <Field label="Correo" hint="Le enviamos la confirmación y el enlace para cancelar.">
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Teléfono (opcional)">
          <input type="tel" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <button className={buttonClass.primary} disabled={pending || !slot || !service}>
          {pending ? "Agendando" : slot ? `Agendar ${formatTime(slot.startsAt, timezone)}` : "Elige una hora"}
        </button>
        {message && (
          <p role="status" className={message.ok ? "text-sm text-success" : "text-sm text-destructive"}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
