import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Esqueletos del portal de staff. Imitan la forma de PageHeader, Stat,
 * AppointmentList y los formularios para que la página no salte al cargar.
 */

export function PageHeaderSkeleton({ tabs = false, action = false, description = true }: {
  tabs?: boolean;
  action?: boolean;
  description?: boolean;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-3">
        <Skeleton className="h-10 w-56 sm:h-12 sm:w-72" />
        {description && <Skeleton className="h-4 w-full max-w-md" />}
      </div>
      {tabs && <Skeleton className="h-9 w-64 rounded-lg" />}
      {action && <Skeleton className="h-10 w-36 rounded-lg" />}
    </div>
  );
}

export function SectionTitleSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("mb-4 h-7 w-48", className)} />;
}

export function StatsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-6 lg:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid gap-2 border-l-2 border-gold/40 pl-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function AppointmentListSkeleton({ days = 2, rows = 3 }: { days?: number; rows?: number }) {
  return (
    <div className="grid gap-8">
      {Array.from({ length: days }, (_, d) => (
        <section key={d}>
          <div className="mb-2 flex items-baseline justify-between border-b border-border pb-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-28" />
          </div>
          <ul className="divide-y divide-border">
            {Array.from({ length: rows }, (_, r) => (
              <li key={r} className="grid gap-3 py-4 sm:grid-cols-[7.5rem_1fr_auto] sm:items-start">
                <div className="grid gap-1.5">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-4 w-44" />
                </div>
                <Skeleton className="h-8 w-28" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Filas tipo lista dividida (equipo, historial de solicitudes). */
export function RowListSkeleton({ rows = 4, avatar = false }: { rows?: number; avatar?: boolean }) {
  return (
    <ul className="divide-y divide-border border-y border-border">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-4 py-3">
          {avatar && <Skeleton className="size-10 shrink-0 rounded-full" />}
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <Skeleton className="h-4 w-14" />
        </li>
      ))}
    </ul>
  );
}

/** Formulario genérico: etiquetas + campos + botón. */
export function FormSkeleton({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: fields }, (_, i) => (
        <FieldSkeleton key={i} />
      ))}
      <Skeleton className="h-10 w-36 rounded-lg" />
    </div>
  );
}

export function CardFormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <Skeleton className="mb-4 h-6 w-40" />
      <FormSkeleton fields={fields} />
    </div>
  );
}

/** Editor de horario semanal: una fila por día. */
export function WeeklyHoursSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 flex-1 rounded-lg" />
        </div>
      ))}
      <Skeleton className="mt-2 h-10 w-36 rounded-lg" />
    </div>
  );
}

/** Misma forma que StaffBookingForm: cita a la izquierda, cliente a la derecha. */
export function StaffBookingFormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
        <div>
          <Skeleton className="mb-2 h-4 w-12" />
          <SlotButtonsSkeleton />
        </div>
      </div>
      <div className="grid content-start gap-4 rounded-lg border border-border bg-card p-5">
        <FormSkeleton fields={3} />
      </div>
    </div>
  );
}

function FieldSkeleton() {
  return (
    <div className="grid gap-1.5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

/** Rejilla de horas libres (agendar cita desde el staff). */
export function SlotButtonsSkeleton({ count = 10, className }: { count?: number; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-4 gap-1.5 sm:grid-cols-5", className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <Skeleton className="h-9 w-full" />
        </li>
      ))}
    </ul>
  );
}
