import type { Metadata } from "next";
import { ServiceEditor } from "@/components/staff/service-editor";
import { PageHeader } from "@/components/staff/ui";
import { requireStaff } from "@/lib/domain/staff";
import type { Service } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServicesPage() {
  const ctx = await requireStaff("admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("id, name, description, duration_min, price_cop, active, sort_order")
    .eq("barbershop_id", ctx.shop.id)
    .order("sort_order")
    .order("name");
  const services = (data ?? []) as Service[];

  return (
    <>
      <PageHeader
        title="Servicios"
        description="Lo que ven los clientes al reservar. La duración define cuánto tiempo bloquea cada cita en la agenda."
      />
      <div className="grid grid-cols-1 gap-3">
        {services.map((s) => (
          <ServiceEditor key={s.id} service={s} />
        ))}
        <ServiceEditor nextSortOrder={(services.at(-1)?.sort_order ?? 0) + 1} />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Cambiar un precio no altera las citas ya agendadas: cada cita guarda el precio con el que se reservó. Desactivar un
        servicio lo oculta del portal sin borrar su historial.
      </p>
    </>
  );
}
