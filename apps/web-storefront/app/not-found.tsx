/**
 * Global 404 page — shown for any unmatched route.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-white dark:bg-[#121212]">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <h1 className="text-6xl font-bold text-[#B81D20]">404</h1>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Page not found
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link
            href="/"
            className="mt-2 inline-flex h-10 items-center justify-center rounded-[10px] bg-[#B81D20] px-4 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B81D20] focus-visible:ring-offset-2"
          >
            Go home
          </Link>
        </div>
      </body>
    </html>
  );
}
