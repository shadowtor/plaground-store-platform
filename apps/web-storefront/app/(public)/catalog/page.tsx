/**
 * Catalog page — product listing with search and filter.
 *
 * SSR-first with metadata and structured data.
 * Shows loading, empty, success, and error states.
 * Filters: material, category, price range, in-stock.
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductGrid } from "@/components/catalog/product-grid";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { ProductGridSkeleton } from "@/components/catalog/product-grid-skeleton";
import type { CatalogFilters as CatalogFiltersType } from "packages/contracts";

export const metadata: Metadata = {
  title: "Catalog — Browse 3D Prints",
  description:
    "Browse PLAground's catalog of premium 3D prints. Filter by material, price, and availability.",
  openGraph: {
    title: "Catalog — PLAground 3D Prints",
    description: "Browse our full catalog of PLA, PETG, and TPU 3D prints.",
  },
};

/** JSON-LD for catalog browsing */
function CatalogJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "PLAground Product Catalog",
    description: "Browse our catalog of premium 3D prints in PLA, PETG, and TPU.",
    url: `${process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://plaground.store"}/catalog`,
  };
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data, server-rendered
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;

  const filters: CatalogFiltersType = {
    q: typeof params["q"] === "string" ? params["q"] : undefined,
    categorySlug:
      typeof params["category"] === "string" ? params["category"] : undefined,
    material:
      typeof params["material"] === "string"
        ? [params["material"]]
        : Array.isArray(params["material"])
          ? params["material"]
          : undefined,
    inStockOnly: params["inStock"] === "true",
    limit: 24,
  };

  return (
    <>
      <CatalogJsonLd />

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-[var(--font-size-heading,2rem)] font-bold text-[var(--foreground)]">
            {filters.q
              ? `Search results for "${filters.q}"`
              : filters.categorySlug
                ? filters.categorySlug
                    .split("-")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")
                : "All products"}
          </h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filter sidebar — sticky on desktop, bottom-sheet on mobile */}
          <aside
            aria-label="Filter products"
            className="lg:w-56 lg:flex-shrink-0"
          >
            <CatalogFilters activeFilters={filters} />
          </aside>

          {/* Product grid with loading state */}
          <section aria-label="Products" className="flex-1 min-w-0">
            <Suspense fallback={<ProductGridSkeleton />}>
              <ProductGrid filters={filters} />
            </Suspense>
          </section>
        </div>
      </div>
    </>
  );
}
