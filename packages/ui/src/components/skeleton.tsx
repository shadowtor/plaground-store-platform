/**
 * Skeleton loading primitive.
 *
 * Skeletons must match the final layout geometry before content loads.
 * (Phase 1 UI Design Contract requirement — Four-State Contract § Loading)
 *
 * Usage: compose Skeleton elements to match the shape of the content
 * they replace (e.g., product card = image + title + price skeletons).
 *
 * Respects prefers-reduced-motion: animation is disabled when set.
 */

import * as React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={[
        "rounded-[var(--radius,10px)]",
        "bg-zinc-200 dark:bg-zinc-800",
        "motion-safe:animate-pulse",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
      {...props}
    />
  ),
);

Skeleton.displayName = "Skeleton";

/**
 * Product card skeleton — matches card image + title + price geometry.
 */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {/* Image placeholder — 4:3 aspect ratio */}
      <Skeleton className="aspect-[4/3] w-full" />
      {/* Title — 2 lines */}
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      {/* Price */}
      <Skeleton className="h-5 w-1/3" />
      {/* Lead time */}
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/**
 * Admin queue row skeleton — matches table row column widths.
 */
export function AdminQueueRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-32 flex-1" />
      <Skeleton className="h-5 w-20 rounded-[var(--radius-sm,6px)]" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-8 w-8 rounded-[var(--radius,10px)]" />
    </div>
  );
}

/**
 * KPI card skeleton — matches dashboard widget dimensions.
 */
export function KpiCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/**
 * Chart card skeleton — matches chart widget at card dimensions.
 * No spinner — skeleton at chart card dimensions per spec.
 */
export function ChartCardSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton style={{ height }} className="w-full" />
    </div>
  );
}
