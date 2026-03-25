/**
 * ProductDetailContent — product detail page content.
 *
 * Layout per design contract:
 *   - Image gallery first (left column ≥768px)
 *   - Stable buy box (right column): material/color → size/variant → quantity
 *   - Trust blocks below buy box: shipping, QA, support, returns
 *
 * Variants: material/color first, then size.
 * Pricing shown in accent color.
 * Lead time shown in muted text below price.
 */

"use client";

import * as React from "react";
import Image from "next/image";
import { formatPrice } from "@/lib/format";
import type { Product, ProductVariant } from "packages/contracts";

interface ProductDetailContentProps {
  product: Product;
}

const trustBlocks = [
  {
    icon: "🚀",
    heading: "Fast dispatch",
    body: "Orders dispatched within 3–5 business days.",
  },
  {
    icon: "🎯",
    heading: "Precision guaranteed",
    body: "±0.2mm tolerance on all standard prints.",
  },
  {
    icon: "🔄",
    heading: "Quality guarantee",
    body: "Not happy? We'll reprint or refund.",
  },
];

export function ProductDetailContent({ product }: ProductDetailContentProps) {
  const [selectedVariant, setSelectedVariant] = React.useState<ProductVariant>(
    product.variants[0]!,
  );
  const [quantity, setQuantity] = React.useState(1);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);

  const images =
    product.images.length > 0
      ? product.images
      : product.imageUrl
        ? [product.imageUrl]
        : [];

  // Group variants by material for the material selector
  const materialGroups = product.variants.reduce<Record<string, ProductVariant[]>>(
    (acc, v) => {
      const mat = v.material;
      if (!acc[mat]) acc[mat] = [];
      acc[mat]!.push(v);
      return acc;
    },
    {},
  );

  const isInStock =
    selectedVariant.stockStatus === "in_stock" ||
    selectedVariant.stockStatus === "low_stock";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
      {/* Left column: image gallery */}
      <div className="flex flex-col gap-3">
        {/* Main image */}
        <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-lg)] bg-[var(--background-subtle)]">
          {images[activeImageIndex] ? (
            <Image
              src={images[activeImageIndex]!}
              alt={`${product.name} — image ${activeImageIndex + 1}`}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--foreground-muted)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {images.slice(0, 4).map((img, i) => (
              <button
                key={i}
                type="button"
                aria-label={`View image ${i + 1}`}
                aria-pressed={activeImageIndex === i}
                onClick={() => setActiveImageIndex(i)}
                className={[
                  "relative aspect-square w-full overflow-hidden rounded-[var(--radius)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                  activeImageIndex === i
                    ? "ring-2 ring-[var(--accent)]"
                    : "hover:opacity-80",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Image
                  src={img}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="100px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right column: buy box */}
      <div className="flex flex-col gap-6">
        {/* Product name + category breadcrumb */}
        <div>
          {product.categoryName && (
            <p className="text-sm text-[var(--foreground-muted)] mb-1">
              {product.categoryName}
            </p>
          )}
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {product.name}
          </h1>
          {product.shortDescription && (
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">
              {product.shortDescription}
            </p>
          )}
        </div>

        {/* Price in accent color + lead time in muted text */}
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-bold text-[var(--accent)]">
            {formatPrice(selectedVariant.priceInCents, selectedVariant.currency)}
          </span>
          {selectedVariant.leadTime && (
            <span className="text-sm text-[var(--foreground-muted)]">
              {selectedVariant.leadTime}
            </span>
          )}
        </div>

        {/* Variant selector — material/color first, then size/variant */}
        <div className="flex flex-col gap-4">
          {/* Material selector */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--foreground)]">
              Material
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(materialGroups).map((material) => {
                const isActive = selectedVariant.material === material;
                return (
                  <button
                    key={material}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      const first = materialGroups[material]?.[0];
                      if (first) setSelectedVariant(first);
                    }}
                    className={[
                      "min-h-[2.75rem] rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
                      isActive
                        ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--background-subtle)]",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {material}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color/variant selector within selected material */}
          {materialGroups[selectedVariant.material] &&
            (materialGroups[selectedVariant.material]?.length ?? 0) > 1 && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[var(--foreground)]">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {materialGroups[selectedVariant.material]!.map((variant) => {
                    const isActive = selectedVariant.id === variant.id;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setSelectedVariant(variant)}
                        className={[
                          "flex items-center gap-2 min-h-[2.75rem] rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
                          isActive
                            ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                            : "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--background-subtle)]",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {variant.colorHex && (
                          <span
                            className="h-4 w-4 rounded-full border border-[var(--border)]"
                            style={{ backgroundColor: variant.colorHex }}
                            aria-hidden="true"
                          />
                        )}
                        {variant.color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Quantity selector */}
          <div className="flex flex-col gap-2">
            <label htmlFor="quantity" className="text-sm font-medium text-[var(--foreground)]">
              Quantity
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background-subtle)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span aria-hidden="true">−</span>
              </button>
              <input
                id="quantity"
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1) setQuantity(val);
                }}
                className="h-10 w-16 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] text-center text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              />
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={quantity >= 100}
                onClick={() => setQuantity((q) => Math.min(100, q + 1))}
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background-subtle)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stock status */}
        <div>
          {selectedVariant.stockStatus === "out_of_stock" && (
            <p className="text-sm text-[var(--destructive)]" role="status">
              Out of stock
            </p>
          )}
          {selectedVariant.stockStatus === "low_stock" && (
            <p className="text-sm text-amber-600 dark:text-amber-400" role="status">
              Low stock — order soon
            </p>
          )}
        </div>

        {/* Primary CTA — Add to cart */}
        <button
          type="button"
          disabled={!isInStock}
          className="flex h-12 w-full items-center justify-center rounded-[var(--radius)] bg-[var(--accent)] text-base font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          {isInStock ? "Add to cart" : "Out of stock"}
        </button>

        {/* Get a custom quote CTA */}
        {product.acceptsCustomQuote && (
          <a
            href="/quote"
            className="flex h-11 w-full items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-transparent text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--background-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            Get an instant quote for custom sizes
          </a>
        )}

        {/* Trust blocks */}
        <div className="flex flex-col gap-3 pt-4 border-t border-[var(--border)]">
          {trustBlocks.map((block) => (
            <div key={block.heading} className="flex items-start gap-3">
              <span className="text-base leading-none pt-0.5" aria-hidden="true">
                {block.icon}
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {block.heading}
                </p>
                <p className="text-xs text-[var(--foreground-muted)]">
                  {block.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
