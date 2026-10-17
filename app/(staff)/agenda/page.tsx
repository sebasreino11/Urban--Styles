import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentList } from "@/components/staff/appointment-list";
import { PageHeader, Stat, Tabs } from "@/components/staff/ui";
import { listAppointments, requireStaff } from "@/lib/domain/staff";
import { addDays, formatCOP, localDate, zonedToUtc } from "@/lib/format";

export const metadata: Metadata = { title: "Mi agenda" };

type View = "hoy" | "semana" | "todas";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const ctx = await requireStaff("barber");
  const { vista } = await searchParams;
  const view: View = vista === "semana" || vista === "todas" ? vista : "hoy";
  const tz = ctx.shop.timezone;

  const today = localDate(new Date(), tz);
  const startToday = zonedToUtc(today, "00:00", tz);
  const startTomorrow = zonedToUtc(addDays(today, 1), "00:00", tz);
  const startWeekEnd = zonedToUtc(addDays(today, 7), "00:00", tz);

  // Las tres consultas pasan por RLS: aunque se manipule barberId, la BD
  // solo devuelve citas de este barbero.
  const base = { shopId: ctx.shop.id, barberId: ctx.barberId };
  const [todayAppts, weekAppts, list, history] = await Promise.all([
    listAppointments({ ...base, from: startToday, to: startTomorrow }),
    listAppointments({ ...base, from: startToday, to: startWeekEnd }),
    view === "todas"
      ? listAppointments({ ...base, from: startToday })
      : listAppointments({ ...base, from: startToday, to: view === "hoy" ? startTomorrow : startWeekEnd }),
    view === "todas" ? listAppointments({ ...base, to: startToday, ascending: false, limit: 100 }) : Promise.resolve([]),
  ]);

  const active = (xs: typeof todayAppts) => xs.filter((a) => a.status === "confirmed" || a.status === "pending");
  const todayActive = active(todayAppts);
  const next = todayActive.find((a) => new Date(a.ends_at).getTime() > Date.now());

  return (
    <>
      <PageHeader title="Mi agenda" description={`Hola, ${ctx.barberName?.split(" ")[0]}. Así va tu día.`}>
        <Tabs
          current={view}
          items={[
            { key: "hoy", label: "Hoy", href: "/agenda" },
            { key: "semana", label: "Próximos 7 días", href: "/agenda?vista=semana" },
            { key: "todas", label: "Todas", href: "/agenda?vista=todas" },
          ]}
        />
      </PageHeader>

      <div className="mb-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Citas hoy" value={String(todayActive.length)} />
        <Stat label="Próximos 7 días" value={String(active(weekAppts).length)} />
        <Stat label="Estimado hoy" value={formatCOP(todayActive.reduce((s, a) => s + a.price_cop, 0))} />
        <Stat
          label="Siguiente"
          value={next ? new Intl.DateTimeFormat("es-CO", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(next.starts_at)) : "—"}
          hint={next ? `${next.customer?.name ?? ""} · ${next.service_name}` : "Sin más citas hoy"}
        />
      </div>

      <AppointmentList
        appointments={list}
        timezone={tz}
        emptyTitle={view === "hoy" ? "Hoy no tienes citas" : "No tienes citas en este periodo"}
      />

      {view === "todas" && history.length > 0 && (
        <div className="mt-14">
          <h2 className="mb-4 font-display text-3xl font-black uppercase text-muted-foreground">Anteriores</h2>
          <AppointmentList appointments={history} timezone={tz} />
        </div>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        ¿Necesitas un día libre?{" "}
        <Link href="/agenda/bloqueos" className="font-medium text-primary underline underline-offset-4">
          Solicítalo aquí
        </Link>
        .
      </p>
    </>
  );
}
