import { FormSkeleton, PageHeaderSkeleton, SectionTitleSkeleton, WeeklyHoursSkeleton } from "@/components/staff/skeletons";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Cargando barbería">
      <PageHeaderSkeleton />
      <div className="grid gap-14 lg:grid-cols-[1.2fr_1fr]">
        <FormSkeleton fields={7} />
        <section>
          <SectionTitleSkeleton className="mb-2 w-64" />
          <Skeleton className="mb-4 h-4 w-full max-w-sm" />
          <WeeklyHoursSkeleton />
        </section>
      </div>
    </SkeletonRegion>
  );
}
