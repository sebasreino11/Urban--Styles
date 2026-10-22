import { PageHeaderSkeleton, RowListSkeleton, SectionTitleSkeleton } from "@/components/staff/skeletons";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Cargando solicitudes">
      <PageHeaderSkeleton />
      <ul className="grid gap-4">
        {[0, 1].map((i) => (
          <li key={i} className="grid gap-4 rounded-lg border border-border bg-card p-5 lg:grid-cols-[1fr_22rem]">
            <div className="grid content-start gap-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-4 w-72 max-w-full" />
              <Skeleton className="h-5 w-56" />
              <Skeleton className="mt-1 h-4 w-48" />
            </div>
            <div className="grid content-start gap-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-28 rounded-lg" />
                <Skeleton className="h-10 w-28 rounded-lg" />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <SectionTitleSkeleton className="mt-14" />
      <RowListSkeleton rows={3} />
    </SkeletonRegion>
  );
}
