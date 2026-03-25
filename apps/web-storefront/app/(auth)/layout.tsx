/**
 * Auth layout — wraps all storefront auth pages (login, register, reset).
 *
 * Minimal layout: no header/footer, centered card on clean background.
 * Maintains the PLAground brand through the logo mark and accent color.
 * Supports light and dark mode via CSS variable tokens.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  robots: { index: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex flex-col items-center gap-1 text-[var(--foreground)] hover:opacity-80 transition-opacity"
          aria-label="PLAground home"
        >
          {/* Logo placeholder — replaced with actual SVG logo in a later plan */}
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#B81D20] text-white font-bold text-lg"
            aria-hidden="true"
          >
            PL
          </span>
          <span className="text-sm font-medium text-[var(--foreground-muted)]">
            PLAground
          </span>
        </Link>
      </div>

      {/* Auth card */}
      <div className="w-full max-w-md rounded-[16px] border border-[var(--border)] bg-[var(--background-subtle)] p-8 shadow-sm">
        {children}
      </div>

      {/* Footer links */}
      <p className="mt-6 text-sm text-[var(--foreground-muted)]">
        &copy; {new Date().getFullYear()} PLAground.{" "}
        <Link href="/privacy" className="underline hover:no-underline">
          Privacy
        </Link>{" "}
        &middot;{" "}
        <Link href="/terms" className="underline hover:no-underline">
          Terms
        </Link>
      </p>
    </div>
  );
}
