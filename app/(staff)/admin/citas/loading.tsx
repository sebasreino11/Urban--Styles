import { AppointmentListSkeleton, PageHeaderSkeleton } from "@/components/staff/skeletons";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Cargando citas">
      <PageHeaderSkeleton action />
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-9 w-80 max-w-full rounded-lg" />
        <div className="flex flex-wrap gap-1.5">
          {[16, 20, 24, 20].map((w, i) => (
            <Skeleton key={i} className="h-7 rounded-full" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
      </div>
      <AppointmentListSkeleton />
    </SkeletonRegion>
  );
}
