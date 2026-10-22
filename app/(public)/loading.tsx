import { Logo } from "@/components/brand";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

/** Misma estructura que la página de la barbería: banda, hero y tiquete de turno. */
export default function Loading() {
  return (
    <SkeletonRegion label="Cargando la barbería" className="min-h-svh">
      <header className="relative z-10 border-b border-gold/70 bg-gradient-to-b from-[hsl(30_17%_19%)] to-primary text-primary-foreground shadow-[0_14px_32px_-14px_hsl(var(--primary)/0.6)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={72} className="size-14 ring-1 ring-gold/70 sm:size-[72px]" />
            <Skeleton className="h-6 w-40 bg-primary-foreground/15 sm:w-56" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg bg-gold/40" />
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:pb-24 lg:pt-14">
        <div className="flex flex-col">
          <Skeleton className="h-[clamp(4.5rem,17vw,10rem)] w-4/5 rounded-lg" />
          <Skeleton className="mt-3 h-[clamp(4.5rem,17vw,10rem)] w-3/5 rounded-lg" />
          <Skeleton className="mt-7 h-1 w-40" />
          <Skeleton className="mt-6 h-6 w-full max-w-md" />
          <Skeleton className="mt-2 h-6 w-2/3 max-w-sm" />
          <div className="mt-8 grid max-w-md gap-3">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-card shadow-lift ring-2 ring-gold">
          <div className="barber-stripe h-2" aria-hidden />
          <div className="flex items-baseline justify-between gap-3 px-5 pb-3 pt-5">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="ticket-perforation h-3 border-t border-dashed border-border" aria-hidden />
          <div className="grid gap-1.5 px-5 py-4">
            <div className="mb-2 flex items-center gap-3">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-5 w-40" />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 border-t border-border px-5 py-4">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </section>
    </SkeletonRegion>
  );
}
