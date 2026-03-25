/**
 * ProductDetailSkeleton — loading state for the product detail page.
 *
 * Matches image gallery + buy box geometry before content loads.
 */

import { Skeleton } from "packages/ui";

export function ProductDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Left: image gallery */}
      <div className="flex flex-col gap-3">
        <Skeleton className="aspect-square w-full" />
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      </div>

      {/* Right: buy box */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-20" />
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-20" />
            ))}
          </div>
        </div>

        <Skeleton className="h-12 w-full" />

        {/* Trust blocks */}
        <div className="flex flex-col gap-3 pt-4 border-t border-[var(--border)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-5 w-5 flex-shrink-0" />
              <div className="flex flex-col gap-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
