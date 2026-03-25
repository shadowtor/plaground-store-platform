/**
 * CatalogFilters — filter sidebar for the product listing page.
 *
 * Desktop: sticky left sidebar.
 * Mobile: simplified filter row (bottom-sheet in Phase 2).
 *
 * Filters: material, in-stock toggle, search query.
 * Updates URL search params for SSR-friendly filtering.
 */

"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { CatalogFilters as CatalogFiltersType } from "packages/contracts";

interface CatalogFiltersProps {
  activeFilters: CatalogFiltersType;
}

const materials = [
  { value: "pla", label: "PLA" },
  { value: "petg", label: "PETG" },
  { value: "tpu", label: "TPU" },
  { value: "abs", label: "ABS" },
  { value: "asa", label: "ASA" },
];

export function CatalogFilters({ activeFilters }: CatalogFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeMaterials = activeFilters.material ?? [];
  const inStockOnly = activeFilters.inStockOnly ?? false;
  const query = activeFilters.q ?? "";

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleMaterial(material: string) {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.getAll("material");
    if (current.includes(material)) {
      // Remove this material
      params.delete("material");
      current.filter((m) => m !== material).forEach((m) => params.append("material", m));
    } else {
      params.append("material", material);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search input */}
      <div className="flex flex-col gap-2">
        <label htmlFor="catalog-search" className="text-sm font-medium text-[var(--foreground)]">
          Search
        </label>
        <div className="relative">
          <input
            id="catalog-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search products..."
            className="h-10 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateParam("q", (e.target as HTMLInputElement).value);
              }
            }}
          />
        </div>
      </div>

      {/* Material filter */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-[var(--foreground)]">
          Material
        </span>
        <div className="flex flex-wrap lg:flex-col gap-2">
          {materials.map((mat) => {
            const isActive = activeMaterials.includes(mat.value);
            return (
              <button
                key={mat.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => toggleMaterial(mat.value)}
                className={[
                  "flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
                  isActive
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--background-subtle)]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {mat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* In-stock filter */}
      <div className="flex items-center gap-2">
        <input
          id="in-stock-filter"
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => updateParam("inStock", e.target.checked ? "true" : null)}
          className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        />
        <label htmlFor="in-stock-filter" className="text-sm text-[var(--foreground)]">
          In stock only
        </label>
      </div>

      {/* Clear filters */}
      {(activeMaterials.length > 0 || inStockOnly || query) && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] underline text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
