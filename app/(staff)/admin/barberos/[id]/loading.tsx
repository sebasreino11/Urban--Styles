import { FormSkeleton, PageHeaderSkeleton, SectionTitleSkeleton, WeeklyHoursSkeleton } from "@/components/staff/skeletons";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Cargando barbero">
      <Skeleton className="mb-2 h-4 w-16" />
      <PageHeaderSkeleton description={false} />
      <div className="grid gap-14 lg:grid-cols-2">
        <div className="grid content-start gap-12">
          <section>
            <SectionTitleSkeleton />
            <FormSkeleton fields={3} />
          </section>
          <section>
            <SectionTitleSkeleton />
            <FormSkeleton fields={1} />
          </section>
        </div>
        <section>
          <SectionTitleSkeleton className="mb-2" />
          <Skeleton className="mb-4 h-4 w-full max-w-sm" />
          <WeeklyHoursSkeleton />
        </section>
      </div>
    </SkeletonRegion>
  );
}
