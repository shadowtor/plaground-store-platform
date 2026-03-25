/**
 * StorefrontFooter — site footer with navigation, legal, and brand info.
 */

import Link from "next/link";

export function StorefrontFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background-subtle)]">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <span
              className="font-bold text-lg text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-family-display, 'Coolvetica', sans-serif)" }}
            >
              PLAground
            </span>
            <p className="text-sm text-[var(--foreground-muted)]">
              Premium 3D printing for makers, designers, and businesses.
            </p>
          </div>

          {/* Browse */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Browse</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/catalog" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                  All products
                </Link>
              </li>
              <li>
                <Link href="/catalog?material=pla" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                  PLA prints
                </Link>
              </li>
              <li>
                <Link href="/catalog?material=petg" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                  PETG prints
                </Link>
              </li>
              <li>
                <Link href="/quote" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                  Get a quote
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Support</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/contact" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                  Contact us
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Legal</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/privacy" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                  Terms of service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--border)] pt-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--foreground-muted)]">
            &copy; {new Date().getFullYear()} PLAground. All rights reserved.
          </p>
          <p className="text-xs text-[var(--foreground-muted)]">
            ABN 00 000 000 000
          </p>
        </div>
      </div>
    </footer>
  );
}
