import { FormSkeleton, PageHeaderSkeleton, RowListSkeleton, SectionTitleSkeleton } from "@/components/staff/skeletons";
import { SkeletonRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Cargando días libres">
      <PageHeaderSkeleton />
      <div className="grid gap-12 lg:grid-cols-[22rem_1fr]">
        <FormSkeleton fields={3} />
        <div>
          <SectionTitleSkeleton />
          <RowListSkeleton rows={3} />
        </div>
      </div>
    </SkeletonRegion>
  );
}
