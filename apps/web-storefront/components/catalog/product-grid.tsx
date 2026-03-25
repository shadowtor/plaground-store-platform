/**
 * ProductGrid — async server component that fetches and renders the product listing.
 *
 * Four-state contract:
 *   - Loading: handled by parent Suspense + ProductGridSkeleton
 *   - Empty: EmptyState with "Nothing here yet." copy
 *   - Success: product cards grid
 *   - Error: caught by error.tsx boundary
 */

import Link from "next/link";
import Image from "next/image";
import { EmptyState, emptyStates } from "packages/ui";
import { formatPrice } from "@/lib/format";
import type { CatalogFilters, ProductListing } from "packages/contracts";

interface ProductGridProps {
  filters: CatalogFilters;
}

/**
 * Fetches the product listing from the API.
 * Returns empty array on error — error boundary handles thrown errors.
 */
async function fetchProducts(filters: CatalogFilters): Promise<ProductListing[]> {
  const apiUrl = process.env["NEXT_PUBLIC_API_URL"];
  if (!apiUrl) {
    // Dev: return stub data until the API is running
    return [];
  }

  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.categorySlug) params.set("categorySlug", filters.categorySlug);
  if (filters.material) filters.material.forEach((m) => params.append("material", m));
  if (filters.inStockOnly) params.set("inStockOnly", "true");
  params.set("limit", String(filters.limit ?? 24));

  const res = await fetch(`${apiUrl}/api/v1/catalog/products?${params.toString()}`, {
    // Next.js cache — revalidate every 60s
    next: { revalidate: 60, tags: ["catalog"] },
  });

  if (!res.ok) {
    throw new Error(`Catalog API error: ${res.status}`);
  }

  const data = (await res.json()) as { data: ProductListing[] };
  return data.data;
}

export async function ProductGrid({ filters }: ProductGridProps) {
  const products = await fetchProducts(filters);

  if (products.length === 0) {
    return (
      <EmptyState
        heading={emptyStates.productCatalog.heading}
        body={emptyStates.productCatalog.body}
        cta={{
          label: emptyStates.productCatalog.cta.label,
          href: "/catalog",
        }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: ProductListing }) {
  return (
    <article className="group relative flex flex-col rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-shadow hover:shadow-md">
      {/* Product image — 4:3 aspect ratio */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--background-subtle)]">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--foreground-muted)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        {/* Optional material badge — small chip in top-left corner */}
        {product.primaryMaterial && (
          <span className="absolute top-2 left-2 rounded-[var(--radius-sm)] bg-[var(--background)]/90 px-2 py-0.5 text-xs font-medium text-[var(--foreground-muted)] backdrop-blur-sm">
            {product.primaryMaterial}
          </span>
        )}

        {/* Hover actions overlay */}
        <div className="absolute inset-x-0 bottom-0 flex gap-2 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-[120ms]">
          <Link
            href={`/products/${product.slug}`}
            className="flex-1 flex items-center justify-center rounded-[var(--radius)] bg-[var(--background)]/95 px-3 py-2 text-xs font-medium text-[var(--foreground)] backdrop-blur-sm hover:bg-[var(--background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            View details
          </Link>
        </div>
      </div>

      {/* Product info */}
      <div className="flex flex-col gap-2 p-4">
        {/* Title — max 2 lines, truncate */}
        <Link
          href={`/products/${product.slug}`}
          className="font-semibold text-sm text-[var(--foreground)] line-clamp-2 hover:text-[var(--accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-sm"
        >
          {product.name}
        </Link>

        {/* Short spec line — material, color */}
        {product.shortDescription && (
          <p className="text-xs text-[var(--foreground-muted)] line-clamp-1">
            {product.shortDescription}
          </p>
        )}

        {/* Price in accent color + lead time */}
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold text-[var(--accent)]">
            {formatPrice(product.priceFromInCents, product.currency)}
          </span>
          {product.leadTime && (
            <span className="text-xs text-[var(--foreground-muted)]">
              {product.leadTime}
            </span>
          )}
        </div>

        {/* Add to cart CTA */}
        <Link
          href={`/products/${product.slug}`}
          className="mt-1 flex h-9 items-center justify-center rounded-[var(--radius)] bg-[var(--accent)] text-xs font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
        >
          Add to cart
        </Link>
      </div>
    </article>
  );
}
