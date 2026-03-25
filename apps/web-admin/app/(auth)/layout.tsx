/**
 * Admin auth layout — wraps admin login and MFA pages.
 *
 * Dark-first: full-page dark background, centered card.
 * Visually distinct from the public storefront auth surface.
 * Uses PLA Blue accent (not PLA Red) to reinforce the operational context.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#121212] px-4 py-12">
      {/* Admin brand mark — visually distinct from storefront */}
      <div className="mb-8 flex flex-col items-center gap-1">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#005EB0] text-white font-bold text-lg"
          aria-hidden="true"
        >
          PL
        </div>
        <span className="text-xs font-medium text-[#a1a1aa] uppercase tracking-widest">
          Admin Portal
        </span>
      </div>

      {/* Auth card — admin dark style */}
      <div className="w-full max-w-sm rounded-[16px] border border-[#2a2a2a] bg-[#1a1a1a] p-8 shadow-xl">
        {children}
      </div>

      <p className="mt-6 text-xs text-[#71717a]">
        Authorized personnel only. All access is logged and monitored.
      </p>
    </div>
  );
}
