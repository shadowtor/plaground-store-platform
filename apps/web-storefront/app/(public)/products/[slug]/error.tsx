/**
 * Product detail page error boundary.
 * Four-state contract: error state.
 */

"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProductError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[Product] Page error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center gap-4 text-center">
      <h2 className="text-xl font-bold text-[var(--foreground)]">
        Something went wrong.
      </h2>
      <p className="text-sm text-[var(--foreground-muted)] max-w-sm">
        We hit an unexpected error loading this product. If this keeps
        happening, contact support.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-transparent px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Try again
        </button>
        <a
          href="/contact"
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-transparent px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Contact us
        </a>
      </div>
    </div>
  );
}
