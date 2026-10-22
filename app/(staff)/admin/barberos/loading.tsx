import { CardFormSkeleton, PageHeaderSkeleton, RowListSkeleton, SectionTitleSkeleton } from "@/components/staff/skeletons";
import { SkeletonRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Cargando equipo">
      <PageHeaderSkeleton />
      <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
        <div>
          <SectionTitleSkeleton className="mb-3" />
          <RowListSkeleton rows={4} avatar />
        </div>
        <div className="grid content-start gap-6">
          <CardFormSkeleton fields={2} />
          <CardFormSkeleton fields={1} />
        </div>
      </div>
    </SkeletonRegion>
  );
}
