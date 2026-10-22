import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarberProfileForm, LinkAccountForm, MemberRolesForm } from "@/components/staff/team-forms";
import { PageHeader } from "@/components/staff/ui";
import { WeeklyHoursEditor } from "@/components/staff/weekly-hours-editor";
import { requireStaff } from "@/lib/domain/staff";
import type { Service } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Barbero" };

export default async function BarberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff("admin");
  const { id } = await params;
  const supabase = await createClient();

  const { data: barber } = await supabase
    .from("barbers")
    .select("id, display_name, bio, photo_url, active, membership_id")
    .eq("id", id)
    .eq("barbershop_id", ctx.shop.id)
    .maybeSingle();
  if (!barber) notFound();

  const [{ data: services }, { data: links }, { data: schedule }, { data: members }, { data: linkedBarbers }] = await Promise.all([
    supabase.from("services").select("id, name, description, duration_min, price_cop, active, sort_order").eq("barbershop_id", ctx.shop.id).order("sort_order"),
    supabase.from("barber_services").select("service_id").eq("barber_id", id),
    supabase.from("barber_schedules").select("weekday, starts_at, ends_at").eq("barber_id", id),
    supabase.from("memberships").select("id, email, roles, active, user_id").eq("barbershop_id", ctx.shop.id),
    supabase.from("barbers").select("membership_id").eq("barbershop_id", ctx.shop.id).not("membership_id", "is", null),
  ]);

  const membership = members?.find((m) => m.id === barber.membership_id) ?? null;
  const taken = new Set((linkedBarbers ?? []).map((b) => b.membership_id));
  const freeAccounts = (members ?? []).filter((m) => !taken.has(m.id) && (m.roles as string[]).includes("barber"));

  return (
    <>
      <Link href="/admin/barberos" className="text-sm text-muted-foreground hover:text-foreground">Equipo</Link>
      <PageHeader title={barber.display_name} />
      <div className="grid gap-14 lg:grid-cols-2">
        <div className="grid content-start gap-12">
          <section>
            <h2 className="mb-4 font-display text-2xl font-extrabold uppercase text-primary">Perfil</h2>
            <BarberProfileForm
              barber={barber}
              services={(services ?? []) as Service[]}
              serviceIds={(links ?? []).map((l) => l.service_id)}
            />
          </section>
          <section>
            <h2 className="mb-4 font-display text-2xl font-extrabold uppercase text-primary">Acceso</h2>
            {membership ? (
              <MemberRolesForm membership={membership} isSelf={membership.user_id === ctx.userId} />
            ) : (
              <LinkAccountForm barberId={barber.id} accounts={freeAccounts} />
            )}
          </section>
        </div>
        <section>
          <h2 className="font-display text-2xl font-extrabold uppercase text-primary">Horario de trabajo</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Solo se ofrecen horarios donde coinciden este horario y el de la barbería.
          </p>
          <WeeklyHoursEditor
            target={{ kind: "barber", barberId: barber.id }}
            initial={(schedule ?? []).map((s) => ({ weekday: s.weekday, start: s.starts_at, end: s.ends_at }))}
          />
        </section>
      </div>
    </>
  );
}
