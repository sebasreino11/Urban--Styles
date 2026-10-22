import { FormSkeleton, PageHeaderSkeleton } from "@/components/staff/skeletons";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton />
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <FormSkeleton fields={1} />
      </div>
    </SkeletonRegion>
  );
}
