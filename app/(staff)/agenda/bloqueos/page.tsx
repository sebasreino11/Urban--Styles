import type { Metadata } from "next";
import { TimeOffForm } from "@/components/staff/time-off-form";
import { TimeOffList } from "@/components/staff/time-off-list";
import { PageHeader } from "@/components/staff/ui";
import { listTimeOff, requireStaff } from "@/lib/domain/staff";
import { localDate } from "@/lib/format";

export const metadata: Metadata = { title: "Días libres" };

export default async function TimeOffPage() {
  const ctx = await requireStaff("barber");
  const requests = await listTimeOff({ shopId: ctx.shop.id, barberId: ctx.barberId });

  return (
    <>
      <PageHeader
        title="Días libres"
        description={
          ctx.isAdmin
            ? "Como administrador, tus bloqueos se aplican de inmediato a la agenda."
            : "Pide vacaciones, días libres u horas bloqueadas. El administrador debe aprobarlas antes de que se cierre tu agenda."
        }
      />
      <div className="grid gap-12 lg:grid-cols-[22rem_1fr]">
        <TimeOffForm barberId={ctx.barberId!} today={localDate(new Date(), ctx.shop.timezone)} autoApproved={ctx.isAdmin} />
        <div>
          <h2 className="mb-4 font-display text-2xl font-extrabold uppercase text-primary">Mis solicitudes</h2>
          <TimeOffList requests={requests} timezone={ctx.shop.timezone} canWithdraw />
        </div>
      </div>
    </>
  );
}
