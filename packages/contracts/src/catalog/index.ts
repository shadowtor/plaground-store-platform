/**
 * Catalog contract types — product browsing, categories, and search.
 *
 * These types represent the public catalog API surface for storefront
 * consumption. The storefront imports ONLY from packages/contracts —
 * never from apps/api source directly.
 *
 * These are hand-authored placeholders until the API is built and
 * contracts:generate is wired. They must match the OpenAPI spec shape.
 */

import { z } from "zod";

// =============================================================================
// Category
// =============================================================================

export const categorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  /** URL path to the category thumbnail image */
  imageUrl: z.string().url().optional(),
  /** Number of visible products in this category */
  productCount: z.number().int().nonnegative(),
});

export type Category = z.infer<typeof categorySchema>;

// =============================================================================
// Product variant
// =============================================================================

export const productVariantSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1),
  /** Human-readable variant label (e.g., "PLA — White / 100mm") */
  label: z.string().min(1),
  /** Material (e.g., PLA, PETG, TPU) */
  material: z.string().min(1),
  /** Color name */
  color: z.string().min(1),
  /** Hex color value for swatch rendering */
  colorHex: z.string().optional(),
  /** Price in cents (to avoid floating point) */
  priceInCents: z.number().int().nonnegative(),
  /** Currency ISO 4217 code */
  currency: z.string().length(3),
  /** Stock status */
  stockStatus: z.enum(["in_stock", "low_stock", "out_of_stock", "discontinued"]),
  /** Estimated lead time display string (e.g., "3–5 business days") */
  leadTime: z.string().optional(),
});

export type ProductVariant = z.infer<typeof productVariantSchema>;

// =============================================================================
// Product
// =============================================================================

export const productSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  /** Short one-line description for product cards */
  shortDescription: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().optional(),
  categoryName: z.string().optional(),
  /** Featured/hero image URL */
  imageUrl: z.string().url().optional(),
  /** All product images */
  images: z.array(z.string().url()).default([]),
  variants: z.array(productVariantSchema).min(1),
  /** Whether custom quote upload is available for this product */
  acceptsCustomQuote: z.boolean().default(false),
  /** Tags for filtering and search */
  tags: z.array(z.string()).default([]),
  /** SEO metadata */
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

export type Product = z.infer<typeof productSchema>;

// =============================================================================
// Product listing (catalog page result)
// =============================================================================

export const productListingSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  shortDescription: z.string().optional(),
  categorySlug: z.string().optional(),
  imageUrl: z.string().url().optional(),
  /** Price range display — lowest variant price */
  priceFromInCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  /** Lead time from lowest-lead-time variant */
  leadTime: z.string().optional(),
  /** Primary material label */
  primaryMaterial: z.string().optional(),
  stockStatus: z.enum(["in_stock", "low_stock", "out_of_stock", "discontinued"]),
  acceptsCustomQuote: z.boolean().default(false),
});

export type ProductListing = z.infer<typeof productListingSchema>;

// =============================================================================
// Catalog search/filter params
// =============================================================================

export const catalogFiltersSchema = z.object({
  categorySlug: z.string().optional(),
  q: z.string().optional(),
  material: z.array(z.string()).optional(),
  minPriceCents: z.number().int().nonnegative().optional(),
  maxPriceCents: z.number().int().nonnegative().optional(),
  inStockOnly: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(24),
});

export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;

// =============================================================================
// Contact form
// =============================================================================

export const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
});

export type ContactForm = z.infer<typeof contactFormSchema>;
