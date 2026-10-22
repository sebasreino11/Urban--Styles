import { PageHeaderSkeleton, SectionTitleSkeleton, StatsSkeleton } from "@/components/staff/skeletons";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

const BAR_HEIGHTS = [35, 60, 45, 80, 55, 70, 40, 90, 65, 50, 75, 30, 85, 60];

function HBarsSkeleton() {
  return (
    <ul className="grid gap-3">
      {[90, 70, 55, 40].map((w) => (
        <li key={w} className="grid gap-1">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-3" style={{ width: `${w}%` }} />
        </li>
      ))}
    </ul>
  );
}

export default function Loading() {
  return (
    <SkeletonRegion label="Cargando resumen">
      <PageHeaderSkeleton tabs />
      <StatsSkeleton />

      <section className="mt-12">
        <SectionTitleSkeleton className="mb-2" />
        <Skeleton className="mb-4 h-4 w-32" />
        <div className="flex h-40 items-end gap-[2px] border-b border-border">
          {BAR_HEIGHTS.map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-b-none rounded-t-[4px]" style={{ height: `${h}%` }} />
          ))}
        </div>
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <section>
          <SectionTitleSkeleton />
          <HBarsSkeleton />
        </section>
        <section>
          <SectionTitleSkeleton />
          <HBarsSkeleton />
        </section>
      </div>
    </SkeletonRegion>
  );
}
