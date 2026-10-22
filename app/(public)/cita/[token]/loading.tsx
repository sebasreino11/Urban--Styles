import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-12">
      <SkeletonRegion label="Cargando tu cita" className="overflow-hidden rounded-xl bg-card shadow-lift ring-2 ring-gold">
        <div className="barber-stripe h-2" aria-hidden />
        <div className="px-6 py-6">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-3 h-14 w-48" />
          <Skeleton className="mt-2 h-6 w-56" />
          <div className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
            {[40, 32, 24, 48].map((w, i) => (
              <div key={i} className="contents">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4" style={{ width: `${w * 4}px` }} />
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-3 border-t border-border pt-5">
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </SkeletonRegion>
    </main>
  );
}
