import { Mail, Phone } from "lucide-react";
import type { StaffAppointment } from "@/lib/domain/types";
import { formatCOP, formatDate, formatTime, localDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AppointmentActions } from "./appointment-actions";
import { AppointmentStatusBadge, EmptyState } from "./ui";

/**
 * Lista de citas agrupada por día. La usan la agenda del barbero y la vista
 * de citas del admin (showBarber).
 */
export function AppointmentList({
  appointments,
  timezone,
  showBarber = false,
  emptyTitle = "No hay citas en este periodo",
}: {
  appointments: StaffAppointment[];
  timezone: string;
  showBarber?: boolean;
  emptyTitle?: string;
}) {
  if (!appointments.length) return <EmptyState title={emptyTitle} />;

  const groups = new Map<string, StaffAppointment[]>();
  for (const a of appointments) {
    const day = localDate(a.starts_at, timezone);
    groups.set(day, [...(groups.get(day) ?? []), a]);
  }
  const now = Date.now();

  return (
    <div className="grid gap-8">
      {[...groups.entries()].map(([day, items]) => {
        const active = items.filter((a) => a.status !== "cancelled");
        return (
          <section key={day}>
            <div className="mb-2 flex items-baseline justify-between border-b border-border pb-2">
              <h2 className="font-display text-2xl font-extrabold uppercase text-primary">
                {formatDate(items[0].starts_at, timezone)}
              </h2>
              <p className="text-sm text-muted-foreground tabular-nums">
                {active.length} {active.length === 1 ? "cita" : "citas"} ·{" "}
                {formatCOP(active.reduce((s, a) => s + a.price_cop, 0))}
              </p>
            </div>
            <ul className="divide-y divide-border">
              {items.map((a) => {
                const started = new Date(a.starts_at).getTime() <= now;
                return (
                  <li
                    key={a.id}
                    className={cn(
                      "grid gap-3 py-4 sm:grid-cols-[7.5rem_1fr_auto] sm:items-start",
                      a.status === "cancelled" && "opacity-60",
                    )}
                  >
                    <div className="tabular-nums">
                      <p className="text-lg font-semibold">{formatTime(a.starts_at, timezone)}</p>
                      <p className="text-xs text-muted-foreground">hasta {formatTime(a.ends_at, timezone)}</p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{a.customer?.name ?? "Cliente"}</p>
                        <AppointmentStatusBadge status={a.status} />
                        {a.source === "staff" && <span className="text-xs text-muted-foreground">Agendada por el equipo</span>}
                      </div>
                      <p className="text-sm">
                        {a.service_name} · <span className="tabular-nums">{formatCOP(a.price_cop)}</span>
                        {showBarber && a.barber && <span className="text-muted-foreground"> · con {a.barber.display_name}</span>}
                      </p>
                      {a.customer && (
                        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <a href={`mailto:${a.customer.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                            <Mail className="size-3.5" aria-hidden /> {a.customer.email}
                          </a>
                          {a.customer.phone && (
                            <a href={`tel:${a.customer.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                              <Phone className="size-3.5" aria-hidden /> {a.customer.phone}
                            </a>
                          )}
                        </p>
                      )}
                      {a.status === "cancelled" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.cancelled_by === "customer" ? "Cancelada por el cliente" : "Cancelada por el equipo"}
                          {a.cancel_reason && a.cancelled_by !== "customer" && `: ${a.cancel_reason}`}
                        </p>
                      )}
                    </div>
                    <AppointmentActions id={a.id} status={a.status} started={started} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
