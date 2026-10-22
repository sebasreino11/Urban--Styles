import type { Metadata } from "next";
import { ShopProfileForm } from "@/components/staff/shop-profile-form";
import { PageHeader } from "@/components/staff/ui";
import { WeeklyHoursEditor } from "@/components/staff/weekly-hours-editor";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/domain/staff";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Barbería" };

export default async function ShopSettingsPage() {
  const ctx = await requireStaff("admin");
  const supabase = await createClient();
  const [{ data: shop }, { data: hours }] = await Promise.all([
    supabase.from("barbershops").select("*").eq("id", ctx.shop.id).single(),
    supabase.from("business_hours").select("weekday, opens_at, closes_at").eq("barbershop_id", ctx.shop.id),
  ]);
  if (!shop) notFound();

  return (
    <>
      <PageHeader title="Barbería" description="La información que ven tus clientes y las reglas de reserva." />
      <div className="grid gap-14 lg:grid-cols-[1.2fr_1fr]">
        <ShopProfileForm shop={shop} />
        <section>
          <h2 className="font-display text-2xl font-semibold text-primary">Horario de atención</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Nadie puede reservar fuera de este horario, aunque el barbero tenga turno.
          </p>
          <WeeklyHoursEditor
            target={{ kind: "shop" }}
            initial={(hours ?? []).map((h) => ({ weekday: h.weekday, start: h.opens_at, end: h.closes_at }))}
          />
        </section>
      </div>
    </>
  );
}
