"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  loadAvailableDays,
  loadAvailableSlots,
  submitBooking,
  type BookingConfirmation,
} from "@/app/(public)/actions";
import type { PublicBarber, Service, Slot } from "@/lib/domain/types";
import {
  addDays,
  formatCOP,
  formatDate,
  formatDuration,
  formatTime,
  localDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Turnstile } from "./turnstile";

const ANY = "any";
const DAYS_PER_PAGE = 5;

interface Props {
  services: Service[];
  barbers: PublicBarber[];
  timezone: string;
  horizonDays: number;
  initialServiceId?: string;
}

/**
 * El "tiquete de turno": flujo de reserva en cuatro pasos. Toda la
 * disponibilidad viene del servidor; aquí solo se presenta y se elige.
 */
export function BookingTicket({ services, barbers, timezone, horizonDays, initialServiceId }: Props) {
  const [serviceId, setServiceId] = useState<string | null>(
    services.some((s) => s.id === initialServiceId) ? initialServiceId! : null,
  );
  const [barberChoice, setBarberChoice] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);

  const [days, setDays] = useState<{ day: string; slotCount: number }[] | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [submitting, startSubmit] = useTransition();

  const service = services.find((s) => s.id === serviceId) ?? null;
  const barberId = barberChoice && barberChoice !== ANY ? barberChoice : null;
  const eligibleBarbers = useMemo(
    () => (serviceId ? barbers.filter((b) => b.service_ids.includes(serviceId)) : []),
    [barbers, serviceId],
  );
  const barberName = (id: string) => barbers.find((b) => b.id === id)?.display_name ?? "";

  // Días con disponibilidad para el servicio + barbero elegidos.
  useEffect(() => {
    if (!serviceId || !barberChoice) return;
    let cancelled = false;
    setDays(null);
    const today = localDate(new Date(), timezone);
    loadAvailableDays(serviceId, barberId, today, addDays(today, horizonDays)).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setDays(r.data);
        setDate((d) => (d && r.data.some((x) => x.day === d) ? d : (r.data[0]?.day ?? null)));
      } else {
        setDays([]);
        setNotice(r.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [serviceId, barberChoice, barberId, timezone, horizonDays]);

  const refreshSlots = useCallback(async () => {
    if (!serviceId || !barberChoice || !date) return;
    setSlots(null);
    const r = await loadAvailableSlots(serviceId, barberId, date);
    if (r.ok) setSlots(r.data);
    else setNotice(r.message);
  }, [serviceId, barberChoice, barberId, date]);

  useEffect(() => {
    setSlot(null);
    void refreshSlots();
  }, [refreshSlots]);

  const chooseService = (id: string) => {
    setServiceId(id);
    setNotice(null);
    // Si el barbero elegido no hace este servicio, se vuelve a preguntar.
    if (barberChoice && barberChoice !== ANY) {
      const b = barbers.find((x) => x.id === barberChoice);
      if (!b?.service_ids.includes(id)) setBarberChoice(null);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !slot) return;
    setNotice(null);
    startSubmit(async () => {
      const r = await submitBooking(
        { serviceId: service.id, barberId, startsAt: slot.startsAt, name, email },
        captcha,
      );
      if (r.ok) {
        setConfirmation(r.data);
        return;
      }
      setFieldErrors(r.fieldErrors ?? {});
      setNotice(r.message);
      if (r.code === "SLOT_TAKEN" || r.code === "SLOT_UNAVAILABLE") {
        setSlot(null);
        void refreshSlots();
      }
    });
  };

  if (confirmation) return <Confirmation c={confirmation} timezone={timezone} />;

  const step = !service ? 1 : !barberChoice ? 2 : !slot ? 3 : 4;

  return (
    <TicketShell>
      <form onSubmit={submit} noValidate>
        <Step n={1} title="Elige el servicio" active={step === 1} done={!!service}
          summary={service && `${service.name} · ${formatDuration(service.duration_min)} · ${formatCOP(service.price_cop)}`}
          onEdit={() => { setServiceId(null); setSlot(null); }}>
          <ul className="grid gap-1.5" role="radiogroup" aria-label="Servicio">
            {services.map((s) => (
              <li key={s.id}>
                <Choice selected={serviceId === s.id} onClick={() => chooseService(s.id)}>
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                    {formatDuration(s.duration_min)}
                  </span>
                  <span className="w-20 text-right font-semibold tabular-nums">{formatCOP(s.price_cop)}</span>
                </Choice>
              </li>
            ))}
          </ul>
        </Step>

        <Step n={2} title="¿Con quién?" active={step === 2} done={!!barberChoice}
          summary={barberChoice === ANY ? "El primero disponible" : barberChoice && barberName(barberChoice)}
          onEdit={() => { setBarberChoice(null); setSlot(null); }}>
          <ul className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Barbero">
            <li className="sm:col-span-2">
              <Choice selected={barberChoice === ANY} onClick={() => setBarberChoice(ANY)}>
                <span className="font-medium">El primero disponible</span>
                <span className="ml-auto text-sm text-muted-foreground">Más horarios</span>
              </Choice>
            </li>
            {eligibleBarbers.map((b) => (
              <li key={b.id}>
                <Choice selected={barberChoice === b.id} onClick={() => setBarberChoice(b.id)}>
                  <Monogram name={b.display_name} />
                  <span className="font-medium">{b.display_name}</span>
                </Choice>
              </li>
            ))}
          </ul>
        </Step>

        <Step n={3} title="Día y hora" active={step === 3} done={!!slot}
          summary={slot && `${formatDate(slot.startsAt, timezone)} · ${formatTime(slot.startsAt, timezone)}`}
          onEdit={() => setSlot(null)}>
          <DayStrip days={days} selected={date} onSelect={setDate} timezone={timezone} />
          <div className="mt-4" aria-live="polite">
            {days && days.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No quedan horarios en los próximos {horizonDays} días con esta combinación. Prueba con
                otro barbero o con “El primero disponible”.
              </p>
            ) : (
              <SlotGrid slots={slots} timezone={timezone} onSelect={setSlot} />
            )}
          </div>
        </Step>

        <Step n={4} title="Tus datos" active={step === 4} done={false} last>
          <div className="grid gap-3">
            <Field label="Nombre" error={fieldErrors.name?.[0]}>
              <input
                className={inputClass}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
              />
            </Field>
            <Field label="Correo" hint="Te enviamos ahí el resumen y el enlace para cancelar." error={fieldErrors.email?.[0]}>
              <input
                className={inputClass}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={120}
              />
            </Field>
            <Turnstile onToken={setCaptcha} />
            <button
              type="submit"
              disabled={submitting || !name || !email}
              className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 font-display text-xl font-extrabold uppercase tracking-wide text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="size-5 animate-spin" aria-hidden />}
              {submitting ? "Reservando" : "Reservar cita"}
            </button>
          </div>
        </Step>

        {notice && (
          <p role="alert" className="mx-5 mb-5 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-accent">
            {notice}
          </p>
        )}
      </form>
    </TicketShell>
  );
}

/* --------------------------------------------------------------------------- */

const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-base outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary";

function TicketShell({ children }: { children: React.ReactNode }) {
  return (
    <div id="reservar" className="relative scroll-mt-6 overflow-hidden rounded-lg bg-card text-card-foreground shadow-[0_1px_0_hsl(var(--border)),0_18px_40px_-24px_hsl(var(--primary)/0.45)]">
      <div className="barber-stripe h-2" aria-hidden />
      <div className="flex items-baseline justify-between px-5 pb-3 pt-4">
        <h2 className="font-display text-3xl font-black uppercase leading-none text-primary">Tu turno</h2>
        <span className="text-xs text-muted-foreground">Sin registro · 1 minuto</span>
      </div>
      <div className="ticket-perforation h-3 border-t border-dashed border-border" aria-hidden />
      {children}
    </div>
  );
}

function Step({
  n, title, active, done, summary, onEdit, last, children,
}: {
  n: number; title: string; active: boolean; done: boolean; summary?: string | null | false;
  onEdit?: () => void; last?: boolean; children: React.ReactNode;
}) {
  const open = active;
  return (
    <fieldset className={cn("min-w-0 px-5 py-4",!last && "border-b border-border")} disabled={!open && !done}>
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border font-display text-base font-extrabold",
            done && !open ? "border-primary bg-primary text-primary-foreground" : open ? "border-primary text-primary" : "border-border text-muted-foreground",
          )}
          aria-hidden
        >
          {done && !open ? <Check className="size-4" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold", !open && !done && "text-muted-foreground")}>{title}</p>
          {done && !open && summary && <p className="truncate text-sm text-muted-foreground">{summary}</p>}
        </div>
        {done && !open && onEdit && (
          <button type="button" onClick={onEdit} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Cambiar
          </button>
        )}
      </div>
      {open && <div className="mt-4">{children}</div>}
    </fieldset>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
        selected ? "border-primary bg-primary text-primary-foreground [&_.text-muted-foreground]:text-primary-foreground/70" : "border-border bg-background/40 hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

export function Monogram({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("");
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-extrabold uppercase text-primary", className)} aria-hidden>
      {initials}
    </span>
  );
}

function DayStrip({
  days, selected, onSelect, timezone,
}: {
  days: { day: string; slotCount: number }[] | null; selected: string | null; onSelect: (d: string) => void; timezone: string;
}) {
  const [page, setPage] = useState(0);
  if (!days) return <div className="h-[68px] animate-pulse rounded-md bg-muted" />;
  if (days.length === 0) return null;
  const pages = Math.ceil(days.length / DAYS_PER_PAGE);
  const current = Math.min(page, pages - 1);
  const visible = days.slice(current * DAYS_PER_PAGE, (current + 1) * DAYS_PER_PAGE);
  const arrow = "flex h-[68px] w-8 shrink-0 items-center justify-center rounded-md border border-border transition-colors hover:border-primary/50 disabled:opacity-30 disabled:hover:border-border";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label="Días anteriores" className={arrow} disabled={current === 0} onClick={() => setPage(current - 1)}>
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <ul className="grid min-w-0 flex-1 grid-cols-5 gap-1.5" role="radiogroup" aria-label="Día">
        {visible.map(({ day }) => {
          const iso = `${day}T17:00:00Z`; // mediodía local en América: evita saltos de fecha
          const isSel = selected === day;
          return (
            <li key={day}>
              <button
                type="button"
                role="radio"
                aria-checked={isSel}
                onClick={() => onSelect(day)}
                className={cn(
                  "flex h-[68px] w-full flex-col items-center justify-center rounded-md border leading-tight transition-colors",
                  isSel ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50",
                )}
              >
                <span className="text-xs capitalize">{formatDate(iso, timezone, { weekday: "short", day: undefined, month: undefined }).replace(".", "")}</span>
                <span className="font-display text-2xl font-extrabold">{Number(day.slice(8))}</span>
                <span className="text-[11px] capitalize opacity-70">{formatDate(iso, timezone, { month: "short", weekday: undefined, day: undefined }).replace(".", "")}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" aria-label="Días siguientes" className={arrow} disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function SlotGrid({ slots, timezone, onSelect }: { slots: Slot[] | null; timezone: string; onSelect: (s: Slot) => void }) {
  if (!slots) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Buscando horarios
      </div>
    );
  }
  if (slots.length === 0) return <p className="text-sm text-muted-foreground">Este día ya está lleno. Elige otro día.</p>;

  const hourOf = (s: Slot) =>
    Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(new Date(s.startsAt)));
  const groups = [
    { label: "Mañana", items: slots.filter((s) => hourOf(s) < 12) },
    { label: "Tarde", items: slots.filter((s) => hourOf(s) >= 12 && hourOf(s) < 17) },
    { label: "Noche", items: slots.filter((s) => hourOf(s) >= 17) },
  ].filter((g) => g.items.length);

  return (
    <div className="grid gap-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-2 text-sm text-muted-foreground">{g.label}</p>
          <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {g.items.map((s) => (
              <li key={s.startsAt}>
                <button
                  type="button"
                  onClick={() => onSelect(s)}
                  className="h-10 w-full rounded-md border border-border text-sm font-medium tabular-nums transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                >
                  {formatTime(s.startsAt, timezone)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? <span className="text-sm text-destructive">{error}</span> : hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Confirmation({ c, timezone }: { c: BookingConfirmation; timezone: string }) {
  return (
    <TicketShell>
      <div className="px-5 py-6" role="status">
        <p className="font-display text-5xl font-black uppercase leading-[0.9] text-primary">
          {formatTime(c.startsAt, timezone)}
        </p>
        <p className="mt-1 text-lg capitalize">{formatDate(c.startsAt, timezone)}</p>
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Servicio</dt>
          <dd className="font-medium">{c.serviceName}</dd>
          <dt className="text-muted-foreground">Barbero</dt>
          <dd className="font-medium">{c.barberName}</dd>
          <dt className="text-muted-foreground">Valor</dt>
          <dd className="font-medium tabular-nums">{formatCOP(c.priceCop)}</dd>
        </dl>
        <p className="mt-5 text-sm text-muted-foreground">
          Te enviamos la confirmación a <span className="font-medium text-foreground">{c.email}</span>. Si no la ves, revisa la carpeta de spam.
        </p>
        <Link href={`/cita/${c.manageToken}`} className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4">
          Ver o cancelar esta cita
        </Link>
      </div>
    </TicketShell>
  );
}
