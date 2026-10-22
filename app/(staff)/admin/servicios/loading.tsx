import { PageHeaderSkeleton } from "@/components/staff/skeletons";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Cargando servicios">
      <PageHeaderSkeleton />
      <div className="grid gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    </SkeletonRegion>
  );
}
