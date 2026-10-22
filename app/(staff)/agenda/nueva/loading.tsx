import { PageHeaderSkeleton, StaffBookingFormSkeleton } from "@/components/staff/skeletons";
import { SkeletonRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton />
      <StaffBookingFormSkeleton />
    </SkeletonRegion>
  );
}
