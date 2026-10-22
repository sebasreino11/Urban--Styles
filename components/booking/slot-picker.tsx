"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import type { Slot } from "@/lib/domain/types";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAYS_PER_PAGE = 5;

/** Selector de día y de hora compartido por la reserva y la reprogramación. */

export function DayStrip({
  days, selected, onSelect, timezone,
}: {
  days: { day: string; slotCount: number }[] | null; selected: string | null; onSelect: (d: string) => void; timezone: string;
}) {
  const [page, setPage] = useState(0);
  if (!days) {
    return (
      <SkeletonRegion label="Buscando días disponibles" className="flex items-center gap-1.5">
        <Skeleton className="h-[68px] w-8 shrink-0 rounded-lg" />
        <div className="grid flex-1 grid-cols-5 gap-1.5">
          {Array.from({ length: DAYS_PER_PAGE }, (_, i) => (
            <Skeleton key={i} className="h-[68px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[68px] w-8 shrink-0 rounded-lg" />
      </SkeletonRegion>
    );
  }
  if (days.length === 0) return null;
  const pages = Math.ceil(days.length / DAYS_PER_PAGE);
  const current = Math.min(page, pages - 1);
  const visible = days.slice(current * DAYS_PER_PAGE, (current + 1) * DAYS_PER_PAGE);
  const arrow = "flex h-[68px] w-8 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:border-gold disabled:opacity-30 disabled:hover:border-border";
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
                  "flex h-[68px] w-full flex-col items-center justify-center rounded-lg border leading-tight transition-colors",
                  isSel ? "border-gold bg-primary text-primary-foreground shadow-soft" : "border-border hover:border-gold",
                )}
              >
                <span className="text-xs capitalize">{formatDate(iso, timezone, { weekday: "short", day: undefined, month: undefined }).replace(".", "")}</span>
                <span className={cn("font-display text-2xl font-extrabold", isSel && "text-gold-light")}>{Number(day.slice(8))}</span>
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

export function SlotGrid({ slots, timezone, onSelect }: { slots: Slot[] | null; timezone: string; onSelect: (s: Slot) => void }) {
  if (!slots) {
    return (
      <SkeletonRegion label="Buscando horarios" className="grid gap-4">
        {[6, 4].map((count, g) => (
          <div key={g}>
            <Skeleton className="mb-2 h-4 w-16" />
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {Array.from({ length: count }, (_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </SkeletonRegion>
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
                  className="h-10 w-full rounded-lg border border-border text-sm font-medium tabular-nums transition-colors hover:border-gold hover:bg-gold hover:text-primary"
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
