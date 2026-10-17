import type { Metadata } from "next";
import Link from "next/link";
import { Monogram } from "@/components/booking/booking-ticket";
import { CreateBarberProfile, InviteStaffForm } from "@/components/staff/team-forms";
import { PageHeader } from "@/components/staff/ui";
import { requireStaff } from "@/lib/domain/staff";
import type { AppRole } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Equipo" };

const ROLE_LABEL: Record<AppRole, string> = { admin: "Administrador", barber: "Barbero" };

export default async function TeamPage() {
  const ctx = await requireStaff("admin");
  const supabase = await createClient();
  const [{ data: barbers }, { data: members }] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, display_name, active, membership_id, sort_order")
      .eq("barbershop_id", ctx.shop.id)
      .order("sort_order")
      .order("display_name"),
    supabase
      .from("memberships")
      .select("id, email, roles, active, user_id")
      .eq("barbershop_id", ctx.shop.id)
      .order("created_at"),
  ]);
  const memberById = new Map((members ?? []).map((m) => [m.id, m]));
  const linked = new Set((barbers ?? []).map((b) => b.membership_id).filter(Boolean));
  const accountsWithoutProfile = (members ?? []).filter((m) => !linked.has(m.id));

  return (
    <>
      <PageHeader title="Equipo" description="Barberos, sus cuentas de acceso y sus roles. Una persona tiene una sola cuenta aunque sea barbero y administrador." />

      <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
        <div>
          <h2 className="mb-3 font-display text-2xl font-extrabold uppercase text-primary">Barberos</h2>
          <ul className="divide-y divide-border border-y border-border">
            {(barbers ?? []).map((b) => {
              const m = b.membership_id ? memberById.get(b.membership_id) : null;
              return (
                <li key={b.id}>
                  <Link href={`/admin/barberos/${b.id}`} className={cn("flex items-center gap-4 py-3 hover:bg-card", !b.active && "opacity-60")}>
                    <Monogram name={b.display_name} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {b.display_name}
                        {m?.user_id === ctx.userId && <span className="ml-2 text-xs font-normal text-muted-foreground">Tú</span>}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {m ? `${m.email ?? "Cuenta"} · ${(m.roles as AppRole[]).map((r) => ROLE_LABEL[r]).join(" y ")}` : "Sin cuenta de acceso"}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">{b.active ? "Visible" : "Oculto"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {accountsWithoutProfile.length > 0 && (
            <>
              <h2 className="mb-3 mt-10 font-display text-2xl font-extrabold uppercase text-primary">Cuentas sin perfil de barbero</h2>
              <ul className="divide-y divide-border border-y border-border text-sm">
                {accountsWithoutProfile.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-3">
                    <span>{m.email}</span>
                    <span className="text-muted-foreground">
                      {(m.roles as AppRole[]).map((r) => ROLE_LABEL[r]).join(" y ")}
                      {!m.active && " · Desactivada"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Para vincularla a un barbero existente, abre el barbero y elige la cuenta.</p>
            </>
          )}
        </div>

        <div className="grid content-start gap-6">
          <InviteStaffForm />
          <CreateBarberProfile />
        </div>
      </div>
    </>
  );
}
