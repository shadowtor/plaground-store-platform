/**
 * StorefrontHeader — site navigation and theme toggle.
 *
 * Responsive: mobile menu collapses to hamburger.
 * Includes skip-to-content link for keyboard accessibility.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const navLinks = [
  { href: "/catalog", label: "Browse" },
  { href: "/catalog?material=pla", label: "PLA" },
  { href: "/catalog?material=petg", label: "PETG" },
  { href: "/catalog?material=tpu", label: "TPU" },
  { href: "/contact", label: "Contact" },
];

export function StorefrontHeader() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <>
      {/* Skip-to-content link — keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius)] focus:bg-[var(--background)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-[var(--accent)]"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Brand mark */}
            <Link
              href="/"
              className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 rounded-sm"
            >
              <span
                className="font-bold text-xl tracking-tight"
                style={{ fontFamily: "var(--font-family-display, 'Coolvetica', sans-serif)" }}
              >
                PLAground
              </span>
            </Link>

            {/* Desktop nav */}
            <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 rounded-sm"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right side: theme toggle + CTA + mobile menu */}
            <div className="flex items-center gap-3">
              <ThemeToggle />

              <Link
                href="/quote"
                className="hidden md:inline-flex h-9 items-center justify-center rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              >
                Get an instant quote
              </Link>

              {/* Mobile menu toggle */}
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                className="flex md:hidden items-center justify-center h-10 w-10 rounded-[var(--radius)] text-[var(--foreground)] hover:bg-[var(--background-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <nav
              id="mobile-menu"
              aria-label="Mobile navigation"
              className="md:hidden border-t border-[var(--border)] py-4"
            >
              <ul className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block rounded-[var(--radius)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li className="pt-2">
                  <Link
                    href="/quote"
                    className="block rounded-[var(--radius)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-foreground)] text-center"
                    onClick={() => setMenuOpen(false)}
                  >
                    Get an instant quote
                  </Link>
                </li>
              </ul>
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
