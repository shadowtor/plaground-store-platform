/**
 * ProductGridSkeleton — loading state for the product grid.
 *
 * Card skeletons matching image + title + price geometry.
 * Per the Four-State Contract: loading state must match the final layout.
 */

import { ProductCardSkeleton } from "packages/ui";

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      aria-label="Loading products..."
      aria-busy="true"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <ProductCardSkeleton />
        </div>
      ))}
    </div>
  );
}
