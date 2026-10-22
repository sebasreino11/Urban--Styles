import { AppointmentListSkeleton, PageHeaderSkeleton, StatsSkeleton } from "@/components/staff/skeletons";
import { SkeletonRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Cargando agenda">
      <PageHeaderSkeleton tabs />
      <StatsSkeleton className="mb-10 sm:grid-cols-4" />
      <AppointmentListSkeleton days={1} rows={4} />
    </SkeletonRegion>
  );
}
