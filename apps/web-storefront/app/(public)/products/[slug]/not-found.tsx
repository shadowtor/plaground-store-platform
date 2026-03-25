/**
 * Product not-found page — shown when a product slug doesn't exist.
 * Four-state contract: empty state.
 */

import Link from "next/link";
import { EmptyState } from "packages/ui";

export default function ProductNotFound() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16">
      <EmptyState
        heading="Product not found."
        body="This product may have been removed or the link may be incorrect."
        cta={{ label: "Browse all products", href: "/catalog" }}
      />
    </div>
  );
}

// Suppress unused import — EmptyState is used via JSX above
void Link;
