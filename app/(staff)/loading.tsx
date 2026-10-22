import { AppointmentListSkeleton, PageHeaderSkeleton, StatsSkeleton } from "@/components/staff/skeletons";
import { SkeletonRegion } from "@/components/ui/skeleton";

/** Respaldo al cambiar entre /admin y /agenda (sus layouts verifican el rol). */
export default function Loading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton tabs />
      <StatsSkeleton className="mb-10" />
      <AppointmentListSkeleton />
    </SkeletonRegion>
  );
}
