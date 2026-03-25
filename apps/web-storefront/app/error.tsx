/**
 * Global error boundary — catches unhandled errors in the app.
 *
 * Four-state contract: error state.
 * Message: human-readable, actionable, no internal details exposed.
 */

"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log to observability service when wired in a later phase
    console.error("[Global] Unhandled error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-white dark:bg-[#121212] px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Something went wrong.
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            We hit an unexpected error. If this keeps happening, contact
            support.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 inline-flex h-10 items-center justify-center rounded-[10px] border border-gray-200 dark:border-gray-700 bg-transparent px-4 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B81D20]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
