import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentList } from "@/components/staff/appointment-list";
import { buttonClass, PageHeader, Tabs } from "@/components/staff/ui";
import { getPublicCatalog } from "@/lib/domain/shop";
import { listAppointments, requireStaff } from "@/lib/domain/staff";
import { addDays, localDate, zonedToUtc } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Citas" };

type Filter = "hoy" | "semana" | "abiertas" | "pasadas";

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; barbero?: string }>;
}) {
  const ctx = await requireStaff("admin");
  const { estado, barbero } = await searchParams;
  const filter: Filter = (["hoy", "semana", "abiertas", "pasadas"] as const).find((f) => f === estado) ?? "hoy";
  const tz = ctx.shop.timezone;
  const { barbers } = await getPublicCatalog(ctx.shop.id);
  const barberId = barbers.some((b) => b.id === barbero) ? barbero! : null;

  const today = localDate(new Date(), tz);
  const startToday = zonedToUtc(today, "00:00", tz);
  const base = { shopId: ctx.shop.id, barberId };
  const appointments =
    filter === "hoy"
      ? await listAppointments({ ...base, from: startToday, to: zonedToUtc(addDays(today, 1), "00:00", tz) })
      : filter === "semana"
        ? await listAppointments({ ...base, from: startToday, to: zonedToUtc(addDays(today, 7), "00:00", tz) })
        : filter === "abiertas"
          ? (await listAppointments({ ...base, to: new Date().toISOString(), statuses: ["confirmed", "pending"], ascending: false })).filter(
              (a) => new Date(a.ends_at).getTime() < Date.now(),
            )
          : await listAppointments({ ...base, to: startToday, ascending: false, limit: 150 });

  const href = (f: Filter, b: string | null = barberId) =>
    `/admin/citas?estado=${f}${b ? `&barbero=${b}` : ""}`;

  return (
    <>
      <PageHeader title="Citas" description="Todas las citas de todos los barberos.">
        <Link href="/admin/citas/nueva" className={buttonClass.primary}>Agendar cita</Link>
      </PageHeader>

      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          current={filter}
          items={[
            { key: "hoy", label: "Hoy", href: href("hoy") },
            { key: "semana", label: "Próximos 7 días", href: href("semana") },
            { key: "abiertas", label: "Sin cerrar", href: href("abiertas") },
            { key: "pasadas", label: "Historial", href: href("pasadas") },
          ]}
        />
        <div className="flex flex-wrap gap-1.5 text-sm">
          {[{ id: null, display_name: "Todos" }, ...barbers].map((b) => (
            <Link
              key={b.id ?? "all"}
              href={href(filter, b.id)}
              className={cn(
                "rounded-full border px-3 py-1",
                barberId === b.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50",
              )}
            >
              {b.display_name}
            </Link>
          ))}
        </div>
      </div>

      <AppointmentList
        appointments={appointments}
        timezone={tz}
        showBarber
        emptyTitle={filter === "abiertas" ? "Todas las citas pasadas están cerradas" : "No hay citas en este periodo"}
      />
    </>
  );
}
