import type { Metadata } from "next";
import { ReviewTimeOff } from "@/components/staff/review-time-off";
import { TimeOffList } from "@/components/staff/time-off-list";
import { EmptyState, PageHeader } from "@/components/staff/ui";
import { listTimeOff, requireStaff } from "@/lib/domain/staff";
import { formatDateTime, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Solicitudes" };

export default async function RequestsPage() {
  const ctx = await requireStaff("admin");
  const tz = ctx.shop.timezone;
  const [pending, history] = await Promise.all([
    listTimeOff({ shopId: ctx.shop.id, statuses: ["pending"] }),
    listTimeOff({ shopId: ctx.shop.id, statuses: ["approved", "rejected"] }),
  ]);

  // Citas ya agendadas que chocarían con cada solicitud.
  const supabase = await createClient();
  const conflicts = await Promise.all(
    pending.map(async (r) => {
      const { data } = await supabase.rpc("time_off_conflicts", { p_request: r.id });
      return (data ?? []) as { id: string; starts_at: string; service_name: string }[];
    }),
  );

  return (
    <>
      <PageHeader
        title="Solicitudes"
        description="Días libres y horas bloqueadas que pide el equipo. Nada se cierra en la agenda hasta que lo apruebes."
      />

      {pending.length === 0 ? (
        <EmptyState title="No hay solicitudes pendientes" />
      ) : (
        <ul className="grid gap-4">
          {pending.map((r, idx) => (
            <li key={r.id} className="grid gap-4 rounded-lg border border-border bg-card p-5 lg:grid-cols-[1fr_22rem]">
              <div>
                <p className="font-display text-2xl font-extrabold uppercase text-primary">{r.barber?.display_name}</p>
                <p className="mt-1 text-sm capitalize">
                  {formatDateTime(r.starts_at, tz)} → {formatDateTime(r.ends_at, tz)}
                </p>
                <p className="mt-2">“{r.reason}”</p>
                {conflicts[idx].length > 0 ? (
                  <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
                    <p className="font-medium">
                      Tiene {conflicts[idx].length} {conflicts[idx].length === 1 ? "cita agendada" : "citas agendadas"} en ese tiempo.
                    </p>
                    <p className="text-muted-foreground">Aprobar no las cancela: tendrás que reasignarlas o cancelarlas en Citas.</p>
                    <ul className="mt-2 list-disc pl-5">
                      {conflicts[idx].slice(0, 5).map((c) => (
                        <li key={c.id}>
                          <span className="capitalize">{formatDateTime(c.starts_at, tz).split(" · ")[0]}</span>, {formatTime(c.starts_at, tz)} · {c.service_name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">No choca con citas ya agendadas.</p>
                )}
              </div>
              <ReviewTimeOff id={r.id} />
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-4 mt-14 font-display text-2xl font-extrabold uppercase text-primary">Historial</h2>
      <TimeOffList requests={history} timezone={tz} />
    </>
  );
}
