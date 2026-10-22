"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadRescheduleDays, loadRescheduleSlots, rescheduleBooking } from "@/app/(public)/actions";
import { DayStrip, SlotGrid } from "@/components/booking/slot-picker";
import type { Slot } from "@/lib/domain/types";
import { formatDate, formatTime } from "@/lib/format";

interface Props {
  token: string;
  timezone: string;
  currentStartsAt: string;
}

export function RescheduleButton({ token, timezone, currentStartsAt }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<{ day: string; slotCount: number }[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Días con cupo (mismo servicio y barbero; la propia cita no cuenta como ocupada).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadRescheduleDays(token).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setDays(r.data);
        setDate((d) => (d && r.data.some((x) => x.day === d) ? d : (r.data[0]?.day ?? null)));
      } else {
        setDays([]);
        setError(r.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  const refreshSlots = useCallback(async () => {
    if (!date) return;
    setSlots(null);
    const r = await loadRescheduleSlots(token, date);
    if (r.ok) setSlots(r.data.filter((s) => s.startsAt !== new Date(currentStartsAt).toISOString()));
    else setError(r.message);
  }, [token, date, currentStartsAt]);

  useEffect(() => {
    setSlot(null);
    void refreshSlots();
  }, [refreshSlots]);

  const close = () => {
    setOpen(false);
    setDays(null);
    setDate(null);
    setSlots(null);
    setSlot(null);
    setError(null);
  };

  if (!open) {
    return (
      <div className="grid justify-items-start gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-gold-ink underline underline-offset-4"
        >
          Reprogramar esta cita
        </button>
        <p className="text-xs text-muted-foreground">Puedes reprogramarla una sola vez.</p>
      </div>
    );
  }

  const confirm = () => {
    if (!slot) return;
    setError(null);
    start(async () => {
      const r = await rescheduleBooking(token, slot.startsAt);
      if (r.ok) {
        close();
        router.refresh();
        return;
      }
      setError(r.message);
      // Ya se reprogramó (p. ej. desde otra pestaña): la página dejará de ofrecerlo.
      if (r.code === "ALREADY_RESCHEDULED") router.refresh();
      if (r.code === "SLOT_TAKEN" || r.code === "SLOT_UNAVAILABLE") {
        setSlot(null);
        void refreshSlots();
      }
    });
  };

  return (
    <div className="grid gap-4">
      <p className="text-sm font-medium">Elige el nuevo día y hora</p>
      <DayStrip days={days} selected={date} onSelect={setDate} timezone={timezone} />
      <div aria-live="polite">
        {days && days.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay otros horarios disponibles con tu barbero en los próximos días.
          </p>
        ) : (
          !slot && <SlotGrid slots={slots} timezone={timezone} onSelect={setSlot} />
        )}
      </div>

      {slot && (
        <div className="grid gap-3 rounded-lg border border-border bg-background/40 p-3">
          <p className="text-sm">
            ¿Mover tu cita al <span className="font-medium capitalize">{formatDate(slot.startsAt, timezone)}</span> a las{" "}
            <span className="font-medium">{formatTime(slot.startsAt, timezone)}</span>?
          </p>
          <p className="text-xs text-muted-foreground">Después no podrás volver a reprogramarla en línea.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={confirm}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-gold-light shadow-soft disabled:opacity-50"
            >
              {pending ? "Reprogramando" : "Sí, reprogramar"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setSlot(null)}
              className="h-10 rounded-lg border border-input px-4 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Elegir otra hora
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <button
        type="button"
        onClick={close}
        disabled={pending}
        className="justify-self-start text-sm font-medium text-muted-foreground underline underline-offset-4"
      >
        No reprogramar
      </button>
    </div>
  );
}
