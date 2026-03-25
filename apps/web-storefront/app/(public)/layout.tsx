/**
 * Public storefront layout — wraps all public-facing pages.
 *
 * Includes:
 * - Site header with navigation and theme toggle
 * - Site footer
 * - Max content width: 1280px, centered
 */

import type { Metadata } from "next";
import { StorefrontHeader } from "@/components/layout/storefront-header";
import { StorefrontFooter } from "@/components/layout/storefront-footer";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <StorefrontHeader />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <StorefrontFooter />
    </div>
  );
}
