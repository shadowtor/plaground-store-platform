/**
 * FeaturedCategories — home page category navigation grid.
 *
 * Links to /catalog?material=* filtering.
 * Supports loading state (skeleton cards).
 */

import Link from "next/link";

const categories = [
  {
    slug: "pla",
    name: "PLA Prints",
    description: "Versatile, vibrant, and precise.",
    href: "/catalog?material=pla",
    accentColor: "#B81D20",
  },
  {
    slug: "petg",
    name: "PETG Prints",
    description: "Durable with excellent clarity.",
    href: "/catalog?material=petg",
    accentColor: "#005EB0",
  },
  {
    slug: "tpu",
    name: "TPU Prints",
    description: "Flexible and impact-resistant.",
    href: "/catalog?material=tpu",
    accentColor: "#FBC70E",
  },
  {
    slug: "custom",
    name: "Custom Quotes",
    description: "Upload any STL or 3MF file.",
    href: "/quote",
    accentColor: "#181818",
  },
] as const;

export function FeaturedCategories() {
  return (
    <section
      aria-labelledby="categories-heading"
      className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-[var(--space-2xl,3rem)]"
    >
      <h2
        id="categories-heading"
        className="text-2xl font-bold text-[var(--foreground)] mb-6"
      >
        Browse by material
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={cat.href}
            className="group flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-6 transition-colors hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            {/* Accent indicator */}
            <div
              className="h-1 w-8 rounded-full"
              style={{ backgroundColor: cat.accentColor }}
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                {cat.name}
              </span>
              <span className="text-sm text-[var(--foreground-muted)]">
                {cat.description}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
