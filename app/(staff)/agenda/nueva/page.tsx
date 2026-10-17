import type { Metadata } from "next";
import { StaffBookingForm } from "@/components/staff/staff-booking-form";
import { PageHeader } from "@/components/staff/ui";
import { getPublicCatalog } from "@/lib/domain/shop";
import { requireStaff } from "@/lib/domain/staff";
import { localDate } from "@/lib/format";

export const metadata: Metadata = { title: "Agendar cita" };

export default async function NewAppointmentPage() {
  const ctx = await requireStaff("barber");
  const { services, barbers } = await getPublicCatalog(ctx.shop.id);

  return (
    <>
      <PageHeader title="Agendar cita" description="Para clientes que llaman o llegan sin reserva." />
      <StaffBookingForm
        services={services}
        barbers={barbers}
        timezone={ctx.shop.timezone}
        today={localDate(new Date(), ctx.shop.timezone)}
        defaultBarberId={ctx.barberId}
      />
    </>
  );
}
