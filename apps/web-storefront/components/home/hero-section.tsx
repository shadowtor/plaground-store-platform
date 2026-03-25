/**
 * HeroSection — storefront home page hero.
 *
 * Full-bleed background, constrained content to 1280px.
 * Primary CTA: "Start your order"
 * Secondary CTA: "Get an instant quote"
 * Coolvetica for the display headline.
 */

import Link from "next/link";

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative w-full overflow-hidden bg-[var(--background)]"
    >
      {/* Full-bleed accent strip */}
      <div
        className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-[var(--space-3xl,4rem)] sm:py-24">
        <div className="flex flex-col gap-6 max-w-2xl">
          {/* Display headline — Coolvetica, 48px */}
          <h1
            id="hero-heading"
            className="text-5xl font-bold leading-[1.1] tracking-tight text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-family-display, 'Coolvetica', sans-serif)" }}
          >
            Premium 3D printing,
            <br />
            <span className="text-[var(--accent)]">made to order.</span>
          </h1>

          <p className="text-lg text-[var(--foreground-muted)] leading-relaxed max-w-xl">
            Upload your model for an instant quote, or browse our catalog of
            quality PLA, PETG, and TPU prints. Fast turnaround. Transparent pricing.
          </p>

          {/* CTA pair — primary CTA visible above fold */}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/catalog"
              className="inline-flex h-12 items-center justify-center rounded-[var(--radius)] bg-[var(--accent)] px-6 text-base font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              Start your order
            </Link>
            <Link
              href="/quote"
              className="inline-flex h-12 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-transparent px-6 text-base font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              Get an instant quote
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
