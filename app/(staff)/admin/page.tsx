import type { Metadata } from "next";
import Link from "next/link";
import { DailyBars, HBar } from "@/components/staff/charts";
import { PageHeader, Stat, Tabs } from "@/components/staff/ui";
import { requireStaff } from "@/lib/domain/staff";
import type { Insights } from "@/lib/domain/types";
import { addDays, formatCOP, localDate, zonedToUtc } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Resumen del negocio" };

const RANGES = { "7": 7, "30": 30, "90": 90 } as const;
type RangeKey = keyof typeof RANGES;

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const ctx = await requireStaff("admin");
  const { dias } = await searchParams;
  const range: RangeKey = dias && dias in RANGES ? (dias as RangeKey) : "30";
  const tz = ctx.shop.timezone;

  const today = localDate(new Date(), tz);
  const fromDate = addDays(today, -RANGES[range] + 1);
  const from = zonedToUtc(fromDate, "00:00", tz);
  const to = zonedToUtc(addDays(today, 1), "00:00", tz);
  const nextWeekTo = zonedToUtc(addDays(today, 8), "00:00", tz);

  const supabase = await createClient();
  const [{ data, error }, { data: upcoming }] = await Promise.all([
    supabase.rpc("shop_insights", { p_shop: ctx.shop.id, p_from: from, p_to: to }),
    supabase.rpc("shop_insights", { p_shop: ctx.shop.id, p_from: to, p_to: nextWeekTo }),
  ]);
  if (error) throw error;
  const i = data as Insights;
  const next = upcoming as Insights | null;

  const closed = i.completed + i.no_show;
  const maxService = Math.max(1, ...i.top_services.map((s) => s.count));
  const maxBarber = Math.max(1, ...i.by_barber.map((b) => b.revenue_cop));

  return (
    <>
      <PageHeader title="Resumen" description="Cómo va el negocio, con base en las citas de la agenda.">
        <Tabs
          current={range}
          items={[
            { key: "7", label: "7 días", href: "/admin?dias=7" },
            { key: "30", label: "30 días", href: "/admin?dias=30" },
            { key: "90", label: "90 días", href: "/admin?dias=90" },
          ]}
        />
      </PageHeader>

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Stat label="Ingresos (atendidas)" value={formatCOP(i.revenue_cop)} hint={`${i.completed} citas atendidas`} />
        <Stat label="Citas agendadas" value={String(i.total - i.cancelled)} hint={`${i.total} incluyendo canceladas`} />
        <Stat label="Tasa de cancelación" value={pct(i.cancellation_rate)} hint={`${i.cancelled} canceladas`} />
        <Stat label="No asistieron" value={pct(i.no_show_rate)} hint={closed ? `${i.no_show} de ${closed} cerradas` : "Aún no hay citas cerradas"} />
      </div>

      {i.overdue > 0 && (
        <p className="mt-6 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          Hay {i.overdue} {i.overdue === 1 ? "cita pasada sin cerrar" : "citas pasadas sin cerrar"} (atendida o no vino).
          Ciérralas para que los ingresos sean exactos.{" "}
          <Link href="/admin/citas?estado=abiertas" className="font-medium underline underline-offset-4">Ver citas</Link>
        </p>
      )}

      <section className="mt-12">
        <h2 className="font-display text-2xl font-extrabold uppercase text-primary">Citas por día</h2>
        <p className="mb-4 text-sm text-muted-foreground">Sin contar canceladas.</p>
        <DailyBars daily={i.daily} fromDate={fromDate} days={RANGES[range]} timezone={tz} />
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 font-display text-2xl font-extrabold uppercase text-primary">Servicios más pedidos</h2>
          {i.top_services.length ? (
            <ul className="grid gap-3">
              {i.top_services.map((s) => (
                <li key={s.name}>
                  <HBar label={s.name} value={s.count} max={maxService} display={`${s.count}`} detail={formatCOP(s.revenue_cop)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay citas en este periodo.</p>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-display text-2xl font-extrabold uppercase text-primary">Por barbero</h2>
          {i.by_barber.length ? (
            <ul className="grid gap-3">
              {i.by_barber.map((b) => (
                <li key={b.id}>
                  <HBar
                    label={b.name}
                    value={b.revenue_cop}
                    max={maxBarber}
                    display={formatCOP(b.revenue_cop)}
                    detail={`${b.completed} atendidas de ${b.booked}`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay citas en este periodo.</p>
          )}
        </section>
      </div>

      {next && (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="font-display text-2xl font-extrabold uppercase text-primary">Próximos 7 días</h2>
          <div className="mt-4 grid grid-cols-2 gap-6 lg:grid-cols-4">
            <Stat label="Citas confirmadas" value={String(next.upcoming)} />
            <Stat label="Ingreso esperado" value={formatCOP(next.expected_cop)} />
          </div>
        </section>
      )}
    </>
  );
}
