import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { getBookingByToken } from "@/lib/domain/booking";
import { formatCOP, formatDate, formatTime } from "@/lib/format";
import { CancelButton } from "./cancel-button";
import { RescheduleButton } from "./reschedule-button";

export const metadata: Metadata = {
  title: "Tu cita",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Atendida",
  cancelled: "Cancelada",
  no_show: "No asististe",
};

export default async function AppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appt = await getBookingByToken(token);

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-12">
      {!appt ? (
        <div>
          <Logo size={64} />
          <h1 className="mt-6 font-display text-5xl font-black uppercase text-primary">Enlace no válido</h1>
          <p className="mt-3 text-muted-foreground">
            No encontramos una cita con este enlace. Copia el enlace completo del correo de confirmación.
          </p>
          <Link href="/" className="mt-6 inline-block font-medium text-gold-ink underline underline-offset-4">
            Ir a la página de la barbería
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card shadow-lift ring-2 ring-gold">
          <div className="barber-stripe h-2" aria-hidden />
          <div className="px-6 py-6">
            <p className="text-sm text-muted-foreground">
              {appt.shop_name} · {STATUS_LABEL[appt.status]}
            </p>
            <p
              className={`mt-2 font-display text-6xl font-black uppercase leading-[0.9] text-primary ${appt.status === "cancelled" ? "line-through decoration-destructive decoration-4" : ""}`}
            >
              {formatTime(appt.starts_at, appt.timezone)}
            </p>
            <p className="mt-1 text-lg capitalize">{formatDate(appt.starts_at, appt.timezone)}</p>

            <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Servicio</dt>
              <dd className="font-medium">{appt.service_name}</dd>
              <dt className="text-muted-foreground">Barbero</dt>
              <dd className="font-medium">{appt.barber_name}</dd>
              <dt className="text-muted-foreground">Valor</dt>
              <dd className="font-medium tabular-nums">{formatCOP(appt.price_cop)}</dd>
              {appt.shop_address && (
                <>
                  <dt className="text-muted-foreground">Dirección</dt>
                  <dd className="font-medium">{appt.shop_address}</dd>
                </>
              )}
            </dl>

            <div className="mt-8 border-t border-border pt-5">
              {appt.can_cancel ? (
                <div className="grid gap-5">
                  {appt.can_reschedule ? (
                    <RescheduleButton token={token} timezone={appt.timezone} currentStartsAt={appt.starts_at} />
                  ) : (
                    appt.rescheduled_at && (
                      <p className="text-sm text-muted-foreground">
                        Ya reprogramaste esta cita una vez, así que no se puede volver a mover en línea.
                        {appt.shop_phone && <> Si necesitas otro cambio, llama al {appt.shop_phone}.</>}
                      </p>
                    )
                  )}
                  <CancelButton token={token} />
                </div>
              ) : appt.status === "confirmed" || appt.status === "pending" ? (
                <p className="text-sm text-muted-foreground">
                  Ya no es posible cancelar ni reprogramar en línea (se permite hasta{" "}
                  {Math.round(appt.cancel_notice_min / 60)} h antes).
                  {appt.shop_phone && <> Llama al {appt.shop_phone}.</>}
                </p>
              ) : (
                <Link href="/#reservar" className="font-medium text-gold-ink underline underline-offset-4">
                  Reservar otra cita
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
